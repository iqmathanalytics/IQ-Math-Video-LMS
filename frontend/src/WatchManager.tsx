import { useEffect, useState, type FormEvent } from "react";
import axios from "axios";
import API_BASE_URL from "./config";
import { getValidSession } from "./utils/session";
import { youtubeIdFromLink } from "./utils/youtube";

type WatchLesson = { id: number; title: string; youtube_id: string };

const WatchManager = () => {
  const [lessons, setLessons] = useState<WatchLesson[]>([]);
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const res = await axios.get<WatchLesson[]>(`${API_BASE_URL}/watch`);
    setLessons(Array.isArray(res.data) ? res.data : []);
  };

  useEffect(() => { load().catch(() => setError("Could not load the watch list.")); }, []);

  const addLesson = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (title.trim().length < 2) { setError("Enter a lesson title."); return; }
    if (!youtubeIdFromLink(link)) { setError("Paste a public IQNex lesson link."); return; }
    const session = getValidSession();
    if (!session?.token) { setError("Sign in again as an instructor."); return; }
    setBusy(true);
    try {
      await axios.post(`${API_BASE_URL}/watch`, { title: title.trim(), youtube_url: link.trim() }, {
        headers: { Authorization: `Bearer ${session.token}` },
      });
      setTitle("");
      setLink("");
      setMessage("Lesson added. It is now on the public Watch section.");
      await load();
    } catch (err: unknown) {
      const detail = axios.isAxiosError(err) ? err.response?.data?.detail : "";
      setError(typeof detail === "string" ? detail : "The lesson was not saved.");
    } finally {
      setBusy(false);
    }
  };

  const removeLesson = async (id: number) => {
    const session = getValidSession();
    if (!session?.token) return;
    setError("");
    try {
      await axios.delete(`${API_BASE_URL}/watch/${id}`, { headers: { Authorization: `Bearer ${session.token}` } });
      setLessons((current) => current.filter((lesson) => lesson.id !== id));
    } catch {
      setError("That lesson could not be removed.");
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="text-3xl font-semibold" style={{ fontFamily: '"Space Grotesk", Inter, sans-serif' }}>Watch</h2>
      <p className="mt-2 text-sm iq-muted">Add an IQNex link for a watch lesson. The video stays on IQNex.</p>
      <form onSubmit={addLesson} className="mt-6 space-y-3 rounded-2xl border iq-line iq-surface p-5">
        <label className="block text-sm font-medium">Lesson title
          <input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 w-full rounded-xl border iq-line bg-transparent px-3 py-3" placeholder="Introduction to the course" />
        </label>
        <label className="block text-sm font-medium">IQNex link
          <input value={link} onChange={(event) => setLink(event.target.value)} className="mt-1 w-full rounded-xl border iq-line bg-transparent px-3 py-3" placeholder="https://" />
        </label>
        {error && <p className="text-sm text-red-500">{error}</p>}
        {message && <p className="text-sm iq-accent">{message}</p>}
        <button disabled={busy} className="rounded-full iq-accent-bg px-4 py-3 text-sm font-semibold disabled:opacity-60">{busy ? "Saving…" : "Add lesson"}</button>
      </form>
      <ul className="mt-6 space-y-3">
        {lessons.map((lesson) => (
          <li key={lesson.id} className="flex items-center justify-between gap-3 rounded-2xl border iq-line iq-surface p-4">
            <div>
              <p className="font-semibold">{lesson.title}</p>
              <a className="text-sm iq-link" href={`https://www.youtube.com/watch?v=${lesson.youtube_id}`} target="_blank" rel="noreferrer">Open on IQNex</a>
            </div>
            <button type="button" onClick={() => removeLesson(lesson.id)} className="rounded-full border border-red-400/40 px-3 py-2 text-sm text-red-500">Remove</button>
          </li>
        ))}
        {lessons.length === 0 && <li className="text-sm iq-muted">No lessons yet.</li>}
      </ul>
    </div>
  );
};

export default WatchManager;
