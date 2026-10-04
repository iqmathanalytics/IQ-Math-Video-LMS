import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import API_BASE_URL from "../config";
import { getValidSession } from "../utils/session";
import { parseYouTubeUrl } from "../utils/youtube";

export type Recording = {
  id: number;
  section: string;
  title: string;
  description: string;
  youtube_id: string;
  channel_name: string;
  channel_url: string;
  start_seconds: number;
  chapters: { title: string; seconds: number }[];
  required: boolean;
  is_completed: boolean;
  last_position: number;
  content_item_id?: number | null;
};

const headers = () => {
  const session = getValidSession();
  return session?.token ? { Authorization: `Bearer ${session.token}` } : {};
};

export const RecordingLibrary = () => {
  const { courseId = "" } = useParams();
  const [rows, setRows] = useState<Recording[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    axios.get(`${API_BASE_URL}/courses/${courseId}/recordings`, { headers: headers() })
      .then((res) => { setRows(Array.isArray(res.data) ? res.data : []); setStatus("ready"); })
      .catch(() => setStatus("error"));
  }, [courseId]);

  const shown = useMemo(() => rows.filter((row) => {
    if (query.trim() && !`${row.title} ${row.description} ${row.section}`.toLowerCase().includes(query.trim().toLowerCase())) return false;
    if (filter === "Watched" && !row.is_completed) return false;
    if (filter === "Unwatched" && row.is_completed) return false;
    return true;
  }), [rows, query, filter]);

  const sections = useMemo(() => {
    const groups = new Map<string, Recording[]>();
    shown.forEach((row) => {
      const list = groups.get(row.section) || [];
      list.push(row);
      groups.set(row.section, list);
    });
    return Array.from(groups.entries());
  }, [shown]);

  const next = rows.find((row) => !row.is_completed) || rows[0];
  const watched = rows.filter((row) => row.is_completed).length;

  return (
    <div>
      <p className="text-sm iq-muted"><Link to={`/my-courses/${courseId}`} className="iq-link">Back to course</Link></p>
      <h1 className="mt-2 text-3xl font-semibold">Recordings</h1>
      <p className="mt-2 max-w-2xl text-sm iq-muted">{watched} of {rows.length} watched. Videos play on IQNex. The creator stays on the player.</p>
      {next && (
        <Link to={`/my-courses/${courseId}/recordings/${next.id}`} className="mt-4 inline-flex rounded-full iq-accent-bg px-4 py-3 text-sm font-semibold">
          {next.is_completed ? "Watch again" : "Continue"}: {next.title}
        </Link>
      )}
      <div className="mt-5 flex flex-wrap gap-3">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search recordings" className="w-full max-w-sm rounded-xl border iq-line iq-surface px-3 py-3 text-sm" />
        <select value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-xl border iq-line iq-surface px-3 py-3 text-sm" aria-label="Filter">
          <option>All</option>
          <option>Unwatched</option>
          <option>Watched</option>
        </select>
      </div>
      {status === "loading" && <p className="mt-6 text-sm iq-muted">Loading recordings…</p>}
      {status === "error" && <p className="mt-6 text-sm iq-muted">Recordings could not be loaded. Enroll in this course to watch them.</p>}
      {status === "ready" && rows.length === 0 && <p className="mt-6 rounded-2xl border iq-line p-5 text-sm iq-muted">Recordings will appear here once they are published.</p>}
      <div className="mt-6 space-y-6">
        {sections.map(([section, items]) => (
          <section key={section}>
            <h2 className="font-semibold">{section}</h2>
            <ul className="mt-3 grid gap-3 md:grid-cols-2">
              {items.map((item) => (
                <li key={item.id}>
                  <Link to={`/my-courses/${courseId}/recordings/${item.id}`} className="block rounded-2xl border iq-line p-4">
                    <p className="text-xs uppercase tracking-[0.14em] iq-faint">{item.is_completed ? "Watched" : item.last_position > 0 ? "In progress" : "New"}</p>
                    <h3 className="mt-1 font-semibold">{item.title}</h3>
                    <p className="mt-1 text-sm iq-muted">{item.channel_name || "IQNex"}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
};

export const RecordingPlayer = () => {
  const { courseId = "", recordingId = "" } = useParams();
  const [rows, setRows] = useState<Recording[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [fromStart, setFromStart] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    axios.get(`${API_BASE_URL}/courses/${courseId}/recordings`, { headers: headers() })
      .then((res) => { setRows(Array.isArray(res.data) ? res.data : []); setStatus("ready"); })
      .catch(() => setStatus("error"));
  }, [courseId]);

  const item = rows.find((row) => String(row.id) === recordingId);
  const index = rows.findIndex((row) => String(row.id) === recordingId);
  const previous = index > 0 ? rows[index - 1] : null;
  const next = index >= 0 && index < rows.length - 1 ? rows[index + 1] : null;
  const resumeAt = !fromStart && item && item.last_position > (item.start_seconds || 0) ? item.last_position : item?.start_seconds || 0;

  useEffect(() => {
    if (!item) return;
    setNote(localStorage.getItem(`iqnex-note:${courseId}:rec-${item.id}`) || "");
  }, [item?.id, courseId]);

  useEffect(() => {
    if (!item) return;
    const timer = window.setTimeout(() => localStorage.setItem(`iqnex-note:${courseId}:rec-${item.id}`, note), 800);
    return () => window.clearTimeout(timer);
  }, [note, item?.id, courseId]);

  const markWatched = async () => {
    if (!item) return;
    await axios.post(`${API_BASE_URL}/recordings/${item.id}/progress`, { position: resumeAt, completed: true }, { headers: headers() });
    setRows((current) => current.map((row) => row.id === item.id ? { ...row, is_completed: true } : row));
  };

  if (status === "loading") return <p className="text-sm iq-muted">Opening the recording…</p>;
  if (status === "error") return <p className="text-sm iq-muted">This recording could not be opened.</p>;
  if (!item || !item.youtube_id) return <p className="text-sm iq-muted">This recording is not available.</p>;

  const watchUrl = `https://www.youtube.com/watch?v=${item.youtube_id}`;
  const embed = `https://www.youtube-nocookie.com/embed/${item.youtube_id}?start=${resumeAt}&rel=0`;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
      <section>
        <p className="text-sm iq-muted"><Link to={`/my-courses/${courseId}/recordings`} className="iq-link">All recordings</Link></p>
        <h1 className="mt-2 text-2xl font-semibold">{item.title}</h1>
        <div className="mt-4 overflow-hidden rounded-2xl border iq-line bg-black">
          <iframe key={`${item.id}-${resumeAt}`} className="aspect-video w-full" src={embed} title={item.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <button type="button" onClick={markWatched} className="rounded-full iq-accent-bg px-4 py-2 font-semibold">{item.is_completed ? "Watched" : "Mark as watched"}</button>
          {item.last_position > 0 && !fromStart && <button type="button" className="iq-link" onClick={() => setFromStart(true)}>Start over</button>}
          {previous && <Link className="iq-link" to={`/my-courses/${courseId}/recordings/${previous.id}`}>Previous</Link>}
          {next && <Link className="iq-link" to={`/my-courses/${courseId}/recordings/${next.id}`}>Next</Link>}
          <a className="iq-link" href={watchUrl} target="_blank" rel="noreferrer">Watch on IQNex</a>
        </div>
        <p className="mt-3 text-sm iq-muted">
          {item.channel_name ? <>By {item.channel_url ? <a className="iq-link" href={item.channel_url} target="_blank" rel="noreferrer">{item.channel_name}</a> : item.channel_name}. </> : null}
          Played on IQNex. IQNex does not host this video.
        </p>
        {item.last_position > 0 && !fromStart && <p className="mt-2 text-sm iq-muted">Resumed at {Math.floor(item.last_position / 60)}:{String(item.last_position % 60).padStart(2, "0")}.</p>}
        {item.description && <p className="mt-4 whitespace-pre-wrap text-sm">{item.description}</p>}
        {item.chapters.length > 0 && (
          <ul className="mt-4 space-y-1 text-sm">
            {item.chapters.map((chapter) => (
              <li key={`${chapter.seconds}-${chapter.title}`}>
                <a className="iq-link" href={`https://www.youtube-nocookie.com/embed/${item.youtube_id}?start=${chapter.seconds}`} target="_blank" rel="noreferrer">{chapter.title}</a>
                <span className="iq-muted"> · {Math.floor(chapter.seconds / 60)}:{String(chapter.seconds % 60).padStart(2, "0")}</span>
              </li>
            ))}
          </ul>
        )}
        <label className="iq-notes-panel mt-6 block rounded-2xl border iq-line p-4 text-sm">
          <span className="iq-notes-title">Notes for this recording</span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={5}
            className="iq-notes-field mt-2"
            placeholder="Write what you want to remember from this recording."
          />
        </label>
        <p className="mt-1 text-xs iq-muted">Saved on this device.</p>
      </section>
      <aside className="rounded-2xl border iq-line p-3">
        <h2 className="px-2 text-sm font-semibold">In this course</h2>
        <ul className="mt-2 space-y-1">
          {rows.map((row) => (
            <li key={row.id}>
              <Link to={`/my-courses/${courseId}/recordings/${row.id}`} className={`block rounded-lg px-2 py-2 text-sm ${row.id === item.id ? "iq-accent" : "iq-subtle"}`}>{row.title}</Link>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
};

export const RecordingAdmin = () => {
  const { courseId = "" } = useParams();
  const [rows, setRows] = useState<Recording[]>([]);
  const [link, setLink] = useState("");
  const [title, setTitle] = useState("");
  const [section, setSection] = useState("Week 1");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState("");

  const load = () => {
    axios.get(`${API_BASE_URL}/courses/${courseId}/recordings`, { headers: headers() })
      .then((res) => setRows(Array.isArray(res.data) ? res.data : []))
      .catch(() => setMessage("Recordings could not be loaded."));
  };

  useEffect(() => { load(); }, [courseId]);

  const onLink = (value: string) => {
    setLink(value);
    const parsed = parseYouTubeUrl(value);
    setPreview(parsed?.type === "video" ? parsed.videoId : "");
    if (parsed?.type === "playlist") setMessage("Paste each video link. A playlist URL is not added as one recording.");
    else setMessage("");
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");
    try {
      await axios.post(`${API_BASE_URL}/courses/${courseId}/recordings`, { link, title, section, description }, { headers: headers() });
      setLink("");
      setTitle("");
      setDescription("");
      setPreview("");
      setMessage("Recording added to this course.");
      load();
    } catch (err: unknown) {
      const detail = axios.isAxiosError(err) ? err.response?.data?.detail : "";
      setMessage(typeof detail === "string" ? detail : "This recording could not be added.");
    }
  };

  const remove = async (id: number) => {
    const res = await axios.delete(`${API_BASE_URL}/recordings/${id}`, { headers: headers() });
    setMessage(res.data?.message || "Updated.");
    load();
  };

  return (
    <div className="text-slate-800">
      <h2 className="text-2xl font-semibold">Recordings</h2>
      <p className="mt-1 max-w-2xl text-sm text-slate-600">Each link becomes a lesson in this course. Use a public or unlisted IQNex video. Private videos cannot be embedded. Chapters can be written as lines like 00:00 Introduction.</p>
      <form onSubmit={save} className="mt-5 grid gap-3 rounded-2xl border border-slate-300 bg-white p-5">
        <label className="text-sm">IQNex link
          <input value={link} onChange={(event) => onLink(event.target.value)} required className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" placeholder="https://" />
        </label>
        <label className="text-sm">Title
          <input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" placeholder="Uses the IQNex title if left empty" />
        </label>
        <label className="text-sm">Section
          <input value={section} onChange={(event) => setSection(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
        </label>
        <label className="text-sm">Description and chapters
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
        </label>
        <button className="rounded-full bg-[#005EB8] px-4 py-2 text-sm font-semibold text-white">Add recording</button>
      </form>
      {preview && (
        <div className="mt-4 max-w-xl overflow-hidden rounded-2xl border border-slate-300 bg-black">
          <iframe className="aspect-video w-full" src={`https://www.youtube-nocookie.com/embed/${preview}`} title="Preview" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
        </div>
      )}
      {message && <p className="mt-3 text-sm text-slate-600">{message}</p>}
      <ul className="mt-6 space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-400">{row.section}</p>
              <p className="font-semibold">{row.title}</p>
              <p className="text-sm text-slate-500">{row.channel_name}</p>
            </div>
            <button type="button" onClick={() => remove(row.id)} className="text-sm text-red-600">Remove</button>
          </li>
        ))}
      </ul>
    </div>
  );
};
