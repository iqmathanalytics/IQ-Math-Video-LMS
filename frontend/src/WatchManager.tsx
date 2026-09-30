import { FormEvent, useEffect, useState } from "react";
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
    if (!youtubeIdFromLink(link)) { setError("Paste a YouTube link, such as https://www.youtube.com/watch?v=…"); return; }
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
      <h2 className="text-2xl font-bold text-slate-800">Watch</h2>
      <p className="mt-2 text-sm text-slate-500">Add a YouTube link. The public site plays it in the Courses section. The video stays on YouTube.</p>
      <form onSubmit={addLesson} className="mt-6 space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
        <label className="block text-sm font-medium text-slate-700">Lesson title
          <input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3" placeholder="Introduction to the course" />
        </label>
        <label className="block text-sm font-medium text-slate-700">YouTube link
          <input value={link} onChange={(event) => setLink(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3" placeholder="https://www.youtube.com/watch?v=" />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {message && <p className="text-sm text-green-700">{message}</p>}
        <button disabled={busy} className="rounded-xl bg-[#005EB8] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Saving…" : "Add lesson"}</button>
      </form>
      <ul className="mt-6 space-y-3">
        {lessons.map((lesson) => (
          <li key={lesson.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
            <div>
              <p className="font-semibold text-slate-800">{lesson.title}</p>
              <a className="text-sm text-[#005EB8]" href={`https://www.youtube.com/watch?v=${lesson.youtube_id}`} target="_blank" rel="noreferrer">Open on YouTube</a>
            </div>
            <button type="button" onClick={() => removeLesson(lesson.id)} className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600">Remove</button>
          </li>
        ))}
        {lessons.length === 0 && <li className="text-sm text-slate-500">No lessons yet.</li>}
      </ul>
    </div>
  );
};

export default WatchManager;
