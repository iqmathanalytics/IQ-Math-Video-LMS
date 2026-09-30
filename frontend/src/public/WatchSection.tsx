import { useEffect, useState } from "react";
import axios from "axios";
import API_BASE_URL from "../config";

export type WatchLesson = { id: number; title: string; youtube_id: string };

const WatchSection = () => {
  const [lessons, setLessons] = useState<WatchLesson[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    axios.get<WatchLesson[]>(`${API_BASE_URL}/watch`)
      .then((res) => {
        if (cancelled) return;
        const rows = Array.isArray(res.data) ? res.data : [];
        setLessons(rows);
        setActiveId(rows[0]?.id ?? null);
        setStatus("ready");
      })
      .catch(() => { if (!cancelled) setStatus("error"); });
    return () => { cancelled = true; };
  }, []);

  const active = lessons.find((lesson) => lesson.id === activeId) ?? lessons[0];

  return (
    <section id="courses" className="scroll-mt-24 mx-auto max-w-6xl px-4 pb-8">
      <p className="text-xs uppercase tracking-[0.18em] iq-accent">Watch</p>
      <h2 className="mt-2 text-3xl font-semibold" style={{ fontFamily: '"Space Grotesk", Inter, sans-serif' }}>Courses</h2>
      <p className="mt-3 max-w-2xl text-sm iq-muted">Demo lessons play here on IQNex. An instructor adds the link, and the player on this page uses that video. Nothing is downloaded or re-hosted.</p>

      {status === "loading" && <p className="mt-6 text-sm iq-muted">Loading lessons…</p>}
      {status === "error" && <p className="mt-6 text-sm iq-muted">Lessons could not be loaded. Refresh the page when the learner service is running.</p>}
      {status === "ready" && lessons.length === 0 && (
        <p className="mt-6 rounded-2xl border iq-line iq-surface p-6 text-sm iq-muted">No demo lesson yet. An instructor can add an IQNex link from Watch in the instructor account.</p>
      )}
      {status === "ready" && active && (
        <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
          <div className="overflow-hidden rounded-2xl border iq-line bg-black">
            <iframe
              key={active.youtube_id}
              className="aspect-video w-full"
              src={`https://www.youtube-nocookie.com/embed/${active.youtube_id}`}
              title={active.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
          <div className="rounded-2xl border iq-line iq-surface p-4">
            <p className="text-sm font-semibold">Play</p>
            <ul className="mt-3 space-y-2">
              {lessons.map((lesson) => (
                <li key={lesson.id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(lesson.id)}
                    className={`w-full rounded-xl border px-3 py-3 text-left text-sm ${lesson.id === active.id ? "iq-accent-border iq-accent" : "iq-line iq-subtle"}`}
                  >
                    {lesson.title}
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs iq-faint">Playing on IQNex. The creator’s player stays visible.</p>
            <a className="mt-2 inline-block text-sm iq-link" href={`https://www.youtube.com/watch?v=${active.youtube_id}`} target="_blank" rel="noreferrer">Watch on IQNex</a>
          </div>
        </div>
      )}
    </section>
  );
};

export default WatchSection;
