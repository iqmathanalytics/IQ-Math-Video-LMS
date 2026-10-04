import { useEffect, useState, type FormEvent } from "react";
import { Link, NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { Bell, Trash2, X } from "lucide-react";
import API_BASE_URL from "../config";
import BrandLogo from "../components/BrandLogo";
import { useDayTheme } from "../public/useDayTheme";
import { clearSession, getValidSession } from "../utils/session";
import { embedSrcFromLink, youtubeIdFromLink } from "../utils/youtube";
import CourseFacts from "../components/CourseFacts";
import CourseCover from "../components/CourseCover";

type Notice = { id: number; title: string; message: string; is_read?: boolean };

type CourseCard = {
  id: string;
  title: string;
  description: string;
  image_url?: string | null;
  demo?: boolean;
  has_certificate?: boolean;
  lessonCount?: number;
  doneCount?: number;
};

type Lesson = {
  id: string;
  title: string;
  type: string;
  url: string;
  instructions?: string | null;
  is_completed?: boolean;
  duration?: number | null;
};

type ModuleBlock = { id: string; title: string; lessons: Lesson[] };

const authHeaders = () => {
  const session = getValidSession();
  return session?.token ? { Authorization: `Bearer ${session.token}` } : {};
};

const notesKey = (courseId: string, lessonId: string) => `iqnex-note:${courseId}:${lessonId}`;
const demoDoneKey = "iqnex-demo-done";

const demoDone = (): string[] => {
  try { return JSON.parse(localStorage.getItem(demoDoneKey) || "[]"); } catch { return []; }
};

const Shell = () => {
  const theme = useDayTheme();
  const navigate = useNavigate();
  const [offline, setOffline] = useState(!navigator.onLine);
  const [noticesOpen, setNoticesOpen] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [noticesBusy, setNoticesBusy] = useState(false);

  const loadNotices = async () => {
    const res = await axios.get(`${API_BASE_URL}/notifications`, { headers: authHeaders() });
    setNotices(Array.isArray(res.data) ? res.data : []);
  };

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    loadNotices().catch(() => setNotices([]));
    const timer = window.setInterval(() => { loadNotices().catch(() => undefined); }, 30000);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      window.clearInterval(timer);
    };
  }, []);

  const openNotices = async () => {
    const next = !noticesOpen;
    setNoticesOpen(next);
    if (!next) return;
    setNoticesBusy(true);
    try {
      await loadNotices();
      await axios.patch(`${API_BASE_URL}/notifications/read`, {}, { headers: authHeaders() });
      setNotices((rows) => rows.map((row) => ({ ...row, is_read: true })));
    } catch {
      /* keep the panel open even if mark-read fails */
    } finally {
      setNoticesBusy(false);
    }
  };

  const removeNotice = async (id: number) => {
    await axios.delete(`${API_BASE_URL}/notifications/${id}`, { headers: authHeaders() });
    setNotices((rows) => rows.filter((row) => row.id !== id));
  };

  const unread = notices.filter((row) => !row.is_read).length;
  const item = "px-3 py-2 rounded-full text-sm iq-subtle";
  const active = "iq-surface iq-accent";

  return (
    <div data-theme={theme} className="iq-page min-h-screen" style={{ fontFamily: "Inter, sans-serif" }}>
      <header className="sticky top-0 z-30 border-b iq-line iq-header backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/home" aria-label="Home"><BrandLogo tone={theme === "dark" ? "onDark" : "ink"} size="sm" /></Link>
          <nav className="hidden flex-wrap items-center gap-1 lg:flex" aria-label="Student">
            <NavLink to="/home" className={({ isActive }) => `${item} ${isActive ? active : ""}`}>Home</NavLink>
            <NavLink to="/courses" className={({ isActive }) => `${item} ${isActive ? active : ""}`}>Courses</NavLink>
            <NavLink to="/my-courses" className={({ isActive }) => `${item} ${isActive ? active : ""}`}>My learning</NavLink>
            <NavLink to="/certificates" className={({ isActive }) => `${item} ${isActive ? active : ""}`}>Certificates</NavLink>
            <NavLink to="/programs" className={({ isActive }) => `${item} ${isActive ? active : ""}`}>Programs</NavLink>
            <NavLink to="/profile" className={({ isActive }) => `${item} ${isActive ? active : ""}`}>Profile</NavLink>
          </nav>
          <div className="relative flex items-center gap-3">
            <button type="button" aria-label="Notifications" className="relative rounded-full border iq-line p-2 iq-muted iq-hover" onClick={() => void openNotices()}>
              <Bell size={18} />
              {unread > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full iq-accent-bg px-1 text-[10px] font-bold">{unread > 9 ? "9+" : unread}</span>}
            </button>
            <button type="button" className="text-sm iq-muted" onClick={() => { clearSession(); navigate("/login"); }}>Sign out</button>
            {noticesOpen && (
              <>
                <button type="button" aria-label="Close notifications" className="fixed inset-0 z-40 cursor-default bg-transparent" onClick={() => setNoticesOpen(false)} />
                <div className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border iq-line iq-surface p-3 shadow-2xl">
                  <div className="mb-2 flex items-center justify-between gap-2 border-b iq-line pb-2">
                    <p className="text-sm font-semibold">Notifications</p>
                    <button type="button" className="iq-btn iq-btn-icon" aria-label="Close" onClick={() => setNoticesOpen(false)}><X size={14} /></button>
                  </div>
                  {noticesBusy && notices.length === 0 && <p className="py-6 text-center text-sm iq-muted">Loading…</p>}
                  {!noticesBusy && notices.length === 0 && <p className="py-6 text-center text-sm iq-muted">No notifications yet.</p>}
                  <ul className="max-h-80 space-y-2 overflow-y-auto">
                    {notices.map((notice) => (
                      <li key={notice.id} className="rounded-xl border iq-line p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold">{notice.title}</p>
                            <p className="mt-1 text-xs iq-muted">{notice.message}</p>
                          </div>
                          <button type="button" className="shrink-0 text-red-500" aria-label="Delete notification" onClick={() => void removeNotice(notice.id)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>
        </div>
      </header>
      {offline && <p className="mx-auto max-w-6xl px-4 pt-4 text-sm">You are offline. Notes already on this device stay here. Course lists need a connection.</p>}
      <main className="mx-auto max-w-6xl px-4 py-8 pb-24 lg:pb-8"><Outlet /></main>
      <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t iq-line iq-header px-2 py-2 text-xs lg:hidden" aria-label="Student">
        <NavLink to="/home" className={({ isActive }) => `px-2 py-2 ${isActive ? "iq-accent" : "iq-muted"}`}>Home</NavLink>
        <NavLink to="/courses" className={({ isActive }) => `px-2 py-2 ${isActive ? "iq-accent" : "iq-muted"}`}>Courses</NavLink>
        <NavLink to="/my-courses" className={({ isActive }) => `px-2 py-2 ${isActive ? "iq-accent" : "iq-muted"}`}>Learning</NavLink>
        <button type="button" className={`px-2 py-2 ${noticesOpen ? "iq-accent" : "iq-muted"}`} onClick={() => void openNotices()}>Alerts{unread > 0 ? ` (${unread})` : ""}</button>
        <NavLink to="/profile" className={({ isActive }) => `px-2 py-2 ${isActive ? "iq-accent" : "iq-muted"}`}>Profile</NavLink>
      </nav>
    </div>
  );
};

const loadCourses = async (): Promise<CourseCard[]> => {
  const headers = authHeaders();
  const mine = await axios.get(`${API_BASE_URL}/my-courses`, { headers }).catch(() => ({ data: [] }));
  return (Array.isArray(mine.data) ? mine.data : [])
        .map((course: { id: number; title: string; description: string; has_certificate?: boolean; image_url?: string | null; lessons_total?: number; lessons_done?: number }) => ({
      id: String(course.id),
      title: course.title,
      description: course.description || "Lessons, practice, and a certificate when you finish.",
      image_url: course.image_url,
      has_certificate: course.has_certificate,
      lessonCount: course.lessons_total ?? 0,
      doneCount: course.lessons_done ?? 0,
    }));
};

const MyCourses = () => {
  const [courses, setCourses] = useState<CourseCard[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [query, setQuery] = useState("");

  useEffect(() => {
    loadCourses().then((rows) => { setCourses(rows); setStatus("ready"); }).catch(() => setStatus("error"));
  }, []);

  const shown = courses.filter((course) => course.title.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div>
      <h1 className="text-3xl font-semibold" style={{ fontFamily: '"Space Grotesk", Inter, sans-serif' }}>My courses</h1>
      <p className="mt-2 max-w-2xl text-sm iq-muted">Open a course to see progress, continue a lesson, keep notes, and take assessments.</p>
      <label className="mt-6 block max-w-sm text-sm">Search
        <input value={query} onChange={(event) => setQuery(event.target.value)} className="mt-1 w-full rounded-xl border iq-line iq-surface px-3 py-3" />
      </label>
      {status === "loading" && <p className="mt-8 text-sm iq-muted">Loading your courses…</p>}
      {status === "error" && <p className="mt-8 text-sm iq-muted">Courses could not be loaded. Check your connection and refresh.</p>}
      {status === "ready" && shown.length === 0 && <p className="mt-8 rounded-2xl border iq-line p-6 text-sm iq-muted">No published course is on your account yet.</p>}
      <ul className="mt-6 grid gap-4 md:grid-cols-2">
        {shown.map((course) => (
          <li key={course.id}>
            <div className="rounded-2xl border iq-line iq-surface p-5">
              <Link to={`/my-courses/${course.id}`} className="block">
                <CourseCover title={course.title} imageUrl={course.image_url} />
                <p className="mt-3 text-xs uppercase tracking-[0.14em] iq-faint">{course.demo ? "Watch" : course.has_certificate ? "Certificate earned" : "In progress"}</p>
                <h2 className="mt-2 text-xl font-semibold">{course.title}</h2>
                <CourseFacts description={course.description} />
                {course.lessonCount != null && <p className="mt-3 text-sm tabular-nums">{course.doneCount}/{course.lessonCount} lessons done</p>}
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

const courseModules = async (courseId: string): Promise<{ title: string; modules: ModuleBlock[] }> => {
  if (courseId === "demos") {
    const res = await axios.get(`${API_BASE_URL}/watch`);
    const rows = Array.isArray(res.data) ? res.data : [];
    const done = new Set(demoDone());
    return {
      title: "Demo lessons",
      modules: [{
        id: "demo",
        title: "Watch",
        lessons: rows.map((lesson: { id: number; title: string; youtube_id: string }) => ({
          id: String(lesson.id),
          title: lesson.title,
          type: "video",
          url: `https://www.youtube.com/watch?v=${lesson.youtube_id}`,
          is_completed: done.has(String(lesson.id)),
        })),
      }],
    };
  }
  const res = await axios.get(`${API_BASE_URL}/courses/${courseId}/player`, { headers: authHeaders() });
  return {
    title: res.data.title,
    modules: (res.data.modules || []).map((module: { id: number; title: string; lessons: Lesson[] }) => ({
      id: String(module.id),
      title: module.title,
      lessons: (module.lessons || []).map((lesson) => ({ ...lesson, id: String(lesson.id) })),
    })),
  };
};

const progressOf = (modules: ModuleBlock[]) => {
  const lessons = modules.flatMap((module) => module.lessons);
  const done = lessons.filter((lesson) => lesson.is_completed).length;
  const total = lessons.length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  const assessments = lessons.filter((lesson) => /quiz|test|assignment|code/i.test(`${lesson.type} ${lesson.title}`));
  const checks = assessments.length > 0 ? assessments : lessons;
  const checksDone = checks.filter((lesson) => lesson.is_completed).length;
  const ready = checks.length > 0 && checksDone === checks.length;
  return { lessons, done, total, percent, assessments, checksDone, checksTotal: checks.length, ready };
};

const downloadCertificate = async (courseId: string, title: string) => {
  const claim = await axios.post(`${API_BASE_URL}/courses/${courseId}/claim-certificate`, {}, { headers: authHeaders() });
  if (claim.data?.status === "error") throw new Error(claim.data.message || "The certificate is not ready.");
  const pdf = await axios.get(`${API_BASE_URL}/generate-pdf/${courseId}`, { headers: authHeaders(), responseType: "blob" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(pdf.data);
  link.download = `${title.replace(/\s+/g, "_")}_Certificate.pdf`;
  link.click();
};

const CourseDashboard = () => {
  const { courseId = "" } = useParams();
  const [title, setTitle] = useState("");
  const [modules, setModules] = useState<ModuleBlock[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    courseModules(courseId).then((data) => { setTitle(data.title); setModules(data.modules); setStatus("ready"); }).catch(() => setStatus("error"));
  }, [courseId]);

  const { lessons, done, total, percent } = progressOf(modules);
  const next = lessons.find((lesson) => !lesson.is_completed) || lessons[0];

  return (
    <div>
      {status === "loading" && <p className="text-sm iq-muted">Loading the course…</p>}
      {status === "error" && <p className="text-sm iq-muted">This course could not be opened.</p>}
      {status === "ready" && (
        <>
          <p className="text-sm iq-muted"><Link to="/my-courses" className="iq-link">My courses</Link></p>
          <h1 className="mt-2 text-3xl font-semibold" style={{ fontFamily: '"Space Grotesk", Inter, sans-serif' }}>{title}</h1>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <article className="rounded-2xl border iq-line iq-surface p-5 lg:col-span-2">
              <p className="text-4xl font-semibold tabular-nums">{percent}%</p>
              <p className="mt-1 text-sm iq-muted" title="Completed lessons divided by all lessons in the course.">{done} of {total} lessons complete. Progress is lessons finished, not minutes skipped.</p>
              <div className="mt-4 h-2 overflow-hidden rounded-full iq-track"><div className="h-full iq-fill" style={{ width: `${percent}%` }} /></div>
              {next && <Link to={`/course/${courseId}/player?lesson=${next.id}`} className="mt-5 inline-flex rounded-full iq-accent-bg px-4 py-3 text-sm font-semibold">Continue: {next.title}</Link>}
            </article>
            <article className="rounded-2xl border iq-line p-5">
              <h2 className="font-semibold">Certificate</h2>
              <ul className="mt-3 space-y-2 text-sm iq-muted">
                <li>Finish every module in this course</li>
                <li>Submit the assessment, then download the certificate</li>
              </ul>
              <Link to={`/my-courses/${courseId}/certificate`} className="mt-4 inline-block text-sm iq-link">View certificate</Link>
            </article>
          </div>
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <Link className="rounded-full iq-accent-bg px-4 py-2 font-semibold" to={`/my-courses/${courseId}/recordings`}>Recordings</Link>
            <Link className="rounded-full border iq-line px-4 py-2" to={`/my-courses/${courseId}/notes`}>Notebook</Link>
            <Link className="rounded-full border iq-line px-4 py-2" to={`/my-courses/${courseId}/assessments`}>Assessments</Link>
          </div>
          <ol className="mt-8 space-y-4">
            {modules.map((module) => {
              const first = module.lessons[0];
              return (
              <li key={module.id} className="rounded-2xl border iq-line p-4">
                <h2 className="font-semibold">
                  {first ? <Link className="iq-link" to={`/course/${courseId}/player?lesson=${first.id}`}>{module.title}</Link> : module.title}
                </h2>
                {module.lessons.length === 0 && <p className="mt-2 text-sm iq-muted">This topic has no lesson yet.</p>}
                <ul className="mt-3 space-y-2">
                  {module.lessons.map((lesson) => (
                    <li key={lesson.id}>
                      <Link to={`/course/${courseId}/player?lesson=${lesson.id}`} className="flex items-center justify-between rounded-xl px-2 py-2 iq-hover">
                        <span>{lesson.title}</span>
                        <span className="text-xs iq-faint">{lesson.is_completed ? "Done" : lesson.type}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
              );
            })}
          </ol>
        </>
      )}
    </div>
  );
};

const LearnPage = () => {
  const { courseId = "", lessonId = "" } = useParams();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [siblings, setSiblings] = useState<Lesson[]>([]);
  const [note, setNote] = useState("");
  const [noteLesson, setNoteLesson] = useState("");
  const [saved, setSaved] = useState("Saved");
  const [focus, setFocus] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    courseModules(courseId).then((data) => {
      const lessons = data.modules.flatMap((module) => module.lessons);
      setTitle(data.title);
      setSiblings(lessons);
      setLesson(lessons.find((item) => item.id === lessonId) || null);
      setStatus("ready");
      if (courseId === "demos") {
        setNote(localStorage.getItem(notesKey(courseId, lessonId)) || "");
        setNoteLesson(lessonId);
        return;
      }
      axios.get(`${API_BASE_URL}/courses/${courseId}/notes`, { headers: authHeaders() })
        .then((res) => {
          const rows = Array.isArray(res.data) ? res.data : [];
          const found = rows.find((row: { lesson_id: number; body?: string }) => String(row.lesson_id) === lessonId);
          setNote(found?.body || localStorage.getItem(notesKey(courseId, lessonId)) || "");
          setNoteLesson(lessonId);
        })
        .catch(() => {
          setNote(localStorage.getItem(notesKey(courseId, lessonId)) || "");
          setNoteLesson(lessonId);
        });
    }).catch(() => setStatus("error"));
  }, [courseId, lessonId]);

  useEffect(() => {
    if (status !== "ready" || noteLesson !== lessonId) return;
    setSaved("Saving…");
    const timer = window.setTimeout(() => {
      localStorage.setItem(notesKey(courseId, lessonId), note);
      if (courseId === "demos") {
        setSaved("Saved on this device");
        return;
      }
      axios.put(`${API_BASE_URL}/courses/${courseId}/notes/${lessonId}`, { body: note }, { headers: authHeaders() })
        .then(() => setSaved("Saved on your account"))
        .catch(() => setSaved("Saved on this device"));
    }, 800);
    return () => window.clearTimeout(timer);
  }, [note, courseId, lessonId, status, noteLesson]);

  const videoId = lesson ? youtubeIdFromLink(lesson.url || "") : "";
  const embedSrc = lesson ? embedSrcFromLink(lesson.url || "") : "";
  const index = siblings.findIndex((item) => item.id === lessonId);
  const previous = index > 0 ? siblings[index - 1] : null;
  const next = index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null;

  const markDone = async () => {
    if (!lesson) return;
    if (courseId === "demos") {
      const nextDone = Array.from(new Set([...demoDone(), lesson.id]));
      localStorage.setItem(demoDoneKey, JSON.stringify(nextDone));
      setLesson({ ...lesson, is_completed: true });
      return;
    }
    await axios.post(`${API_BASE_URL}/content/${lesson.id}/complete`, {}, { headers: authHeaders() });
    setLesson({ ...lesson, is_completed: true });
  };

  return (
    <div className={focus ? "fixed inset-0 z-50 flex h-screen flex-col overflow-hidden iq-page p-4 lg:p-6" : ""}>
      {status === "loading" && <p className="text-sm iq-muted">Opening the lesson…</p>}
      {status === "error" && <p className="text-sm iq-muted">This lesson could not be opened.</p>}
      {status === "ready" && !lesson && <p className="text-sm iq-muted">That lesson is not in this course.</p>}
      {lesson && (
        <div className={focus ? "grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]" : "grid gap-4 lg:grid-cols-[16rem_1fr_18rem]"}>
          <aside className={focus ? "hidden" : "rounded-2xl border iq-line p-3 lg:max-h-[80vh] lg:overflow-auto"}>
            <Link to={`/my-courses/${courseId}`} className="text-sm iq-link">{title}</Link>
            <ul className="mt-3 space-y-1">
              {siblings.map((item) => (
                <li key={item.id}>
                  <Link to={`/learn/${courseId}/${item.id}`} className={`block rounded-lg px-2 py-2 text-sm ${item.id === lesson.id ? "iq-accent" : "iq-subtle"}`}>{item.title}</Link>
                </li>
              ))}
            </ul>
          </aside>
          <section className={focus ? "flex min-h-0 flex-col items-center justify-center" : ""}>
            <div className={focus ? "w-full max-w-4xl" : ""}>
              {focus && siblings.length > 1 && (
                <label className="mb-3 block text-sm">
                  Lesson
                  <select
                    aria-label="Lesson"
                    className="mt-1 w-full rounded-xl border iq-line iq-surface px-3 py-2"
                    value={lesson.id}
                    onChange={(event) => navigate(`/learn/${courseId}/${event.target.value}`)}
                  >
                    {siblings.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                  </select>
                </label>
              )}
              {embedSrc ? (
                <div className="overflow-hidden rounded-2xl border iq-line bg-black">
                  <iframe key={embedSrc} className="aspect-video w-full" src={embedSrc} title={lesson.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
                </div>
              ) : (
                <div className="whitespace-pre-wrap rounded-2xl border iq-line p-6 text-sm">
                  {lesson.instructions || "This lesson has no embedded video."}
                  {lesson.url && <p className="mt-3"><a className="iq-link" href={lesson.url} target="_blank" rel="noreferrer">{lesson.url}</a></p>}
                </div>
              )}
              <h1 className="mt-4 text-2xl font-semibold">{lesson.title}</h1>
              {videoId && <p className="mt-1 text-sm iq-muted">Playing on IQNex. <a className="iq-link" href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noreferrer">Watch on IQNex</a></p>}
              <div className="mt-4 flex flex-wrap gap-2 text-sm">
                {previous && <Link className="rounded-full border iq-line px-3 py-2" to={`/learn/${courseId}/${previous.id}`}>Previous</Link>}
                {next && <Link className="rounded-full border iq-line px-3 py-2" to={`/learn/${courseId}/${next.id}`}>Next</Link>}
                <button type="button" className="rounded-full iq-accent-bg px-3 py-2 font-semibold" onClick={markDone}>{lesson.is_completed ? "Completed" : "Mark complete"}</button>
                <button type="button" className="rounded-full border iq-line px-3 py-2" onClick={() => setFocus((value) => !value)}>{focus ? "Exit focus" : "Focus"}</button>
              </div>
            </div>
          </section>
          <aside className={`rounded-2xl border iq-line p-4 ${focus ? "flex min-h-0 flex-col" : ""}`}>
            <div className="flex items-center justify-between"><h2 className="font-semibold">Notes</h2><span className="text-xs iq-faint">{saved}</span></div>
            <p className="mt-1 text-xs iq-muted">Saved on your account, and kept in this browser if you are offline.</p>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={focus ? undefined : 12} className={`mt-3 w-full rounded-xl border iq-line iq-surface px-3 py-3 text-sm ${focus ? "min-h-48 flex-1 resize-none" : ""}`} placeholder="Write what you want to remember." />
            <Link to={`/course/${courseId}/player?lesson=${lesson.id}`} className="mt-3 inline-block text-sm iq-link">Open assignments, quizzes, and code for this lesson</Link>
            <Link to={`/my-courses/${courseId}/notes`} className="mt-3 inline-block text-sm iq-link">Open notebook</Link>
          </aside>
        </div>
      )}
    </div>
  );
};

const Notebook = () => {
  const { courseId = "" } = useParams();
  const [rows, setRows] = useState<{ lessonId: string; title: string; note: string }[]>([]);

  useEffect(() => {
    courseModules(courseId).then(async (data) => {
      const lessons = data.modules.flatMap((module) => module.lessons);
      const saved: Record<string, string> = {};
      if (courseId !== "demos") {
        try {
          const res = await axios.get(`${API_BASE_URL}/courses/${courseId}/notes`, { headers: authHeaders() });
          for (const row of Array.isArray(res.data) ? res.data : []) saved[String(row.lesson_id)] = row.body || "";
        } catch { /* local notes remain available */ }
      }
      setRows(lessons.map((lesson) => ({
        lessonId: lesson.id,
        title: lesson.title,
        note: saved[lesson.id] || localStorage.getItem(notesKey(courseId, lesson.id)) || "",
      })).filter((row) => row.note.trim()));
    }).catch(() => setRows([]));
  }, [courseId]);

  const download = () => {
    const body = rows.map((row) => `# ${row.title}\n\n${row.note}`).join("\n\n");
    const blob = new Blob([body], { type: "text/markdown" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "notes.md";
    link.click();
  };

  return (
    <div>
      <p className="text-sm iq-muted"><Link to={`/my-courses/${courseId}`} className="iq-link">Back to course</Link></p>
      <h1 className="mt-2 text-3xl font-semibold">Notebook</h1>
      <button type="button" onClick={download} className="mt-4 rounded-full border iq-line px-4 py-2 text-sm">Download Markdown</button>
      {rows.length === 0 && <p className="mt-6 text-sm iq-muted">Notes you write beside a lesson will collect here.</p>}
      <ul className="mt-6 space-y-4">
        {rows.map((row) => (
          <li key={row.lessonId} className="rounded-2xl border iq-line p-4">
            <Link className="font-semibold iq-link" to={`/learn/${courseId}/${row.lessonId}`}>{row.title}</Link>
            <p className="mt-2 whitespace-pre-wrap text-sm iq-muted">{row.note}</p>
          </li>
        ))}
      </ul>
    </div>
  );
};

const Assessments = () => {
  const { courseId = "" } = useParams();
  const [link, setLink] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [savedName, setSavedName] = useState("");
  const [savedLink, setSavedLink] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [modules, setModules] = useState<ModuleBlock[]>([]);
  const [progressState, setProgressState] = useState<"loading" | "ready">("loading");

  useEffect(() => {
    if (courseId === "demos") return;
    courseModules(courseId).then((data) => setModules(data.modules)).catch(() => setMessage("Course progress could not be loaded.")).finally(() => setProgressState("ready"));
    axios.get(`${API_BASE_URL}/courses/${courseId}/assessment`, { headers: authHeaders() })
      .then((res) => {
        setSubmitted(Boolean(res.data?.submitted));
        setSavedName(res.data?.file_name || "");
        setSavedLink(res.data?.link || "");
      })
      .catch(() => setMessage("The assessment could not be loaded."));
  }, [courseId]);

  const lessons = modules.flatMap((module) => module.lessons);
  const modulesOpen = modules.filter((module) => module.lessons.some((lesson) => !lesson.is_completed));
  const modulesComplete = lessons.length > 0 && modulesOpen.length === 0;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (courseId === "demos") {
      setMessage("Demo lessons do not take an assessment.");
      return;
    }
    if (!modulesComplete) {
      setMessage("Finish every module before submitting the assessment.");
      return;
    }
    if (!file && !link.trim()) {
      setMessage("Upload a file or paste the project folder link.");
      return;
    }
    setBusy(true);
    setMessage("");
    const body = new FormData();
    if (file) body.append("file", file);
    if (link.trim()) body.append("link", link.trim());
    try {
      const res = await axios.post(`${API_BASE_URL}/courses/${courseId}/assessment`, body, { headers: authHeaders() });
      setSubmitted(true);
      setSavedName(res.data?.file_name || "");
      setSavedLink(res.data?.link || "");
      setFile(null);
      setLink("");
      setMessage("Submitted. The certificate can be downloaded.");
    } catch (err: unknown) {
      const detail = axios.isAxiosError(err) ? err.response?.data?.detail : "";
      setMessage(typeof detail === "string" ? detail : "The assessment could not be submitted.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p className="text-sm iq-muted"><Link to={`/my-courses/${courseId}`} className="iq-link">Back to course</Link></p>
      <h1 className="mt-2 text-3xl font-semibold">Assessment</h1>
      <p className="mt-2 max-w-2xl text-sm iq-muted">Finish every module first. The assessment opens after that, and the certificate follows the submission.</p>
      {!modulesComplete && progressState === "ready" && (
        <div className="mt-4 rounded-2xl border iq-line p-4 text-sm">
          <p>The assessment stays closed until every module is complete.</p>
          {modulesOpen.length > 0 && <p className="mt-2 iq-muted">Still open: {modulesOpen.map((module) => module.title).join(", ")}</p>}
        </div>
      )}
      {submitted && (
        <p className="mt-4 rounded-2xl border iq-line p-4 text-sm">
          Submitted{savedName ? `: ${savedName}` : ""}{savedLink ? ` · ${savedLink}` : ""}.{" "}
          <Link className="iq-link" to={`/my-courses/${courseId}/certificate`}>Download certificate</Link>
        </p>
      )}
      <form onSubmit={submit} className="mt-6 max-w-xl space-y-4">
        <label className="block text-sm">Project file
          <input type="file" disabled={!modulesComplete} accept=".pdf,.zip,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.txt" onChange={(event) => setFile(event.target.files?.[0] || null)} className="mt-1 block w-full text-sm disabled:opacity-50" />
        </label>
        <label className="block text-sm">Project folder link
          <input value={link} disabled={!modulesComplete} onChange={(event) => setLink(event.target.value)} placeholder="https://" className="mt-1 w-full rounded-xl border iq-line iq-surface px-3 py-3 disabled:opacity-50" />
        </label>
        <button disabled={busy || progressState === "loading" || !modulesComplete || courseId === "demos"} className="rounded-full iq-accent-bg px-4 py-3 text-sm font-semibold disabled:opacity-50">{busy ? "Submitting…" : progressState === "loading" ? "Checking modules…" : !modulesComplete ? "Finish the modules first" : submitted ? "Submit again" : "Submit assessment"}</button>
      </form>
      {message && <p className="mt-3 text-sm iq-muted">{message}</p>}
    </div>
  );
};

const CertificatePage = () => {
  const { courseId = "" } = useParams();
  const [title, setTitle] = useState("");
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (courseId === "demos") return;
    Promise.all([
      courseModules(courseId).catch(() => ({ title: "Course" })),
      axios.get(`${API_BASE_URL}/courses/${courseId}/assessment`, { headers: authHeaders() }).catch(() => ({ data: { submitted: false } })),
    ]).then(([course, assessment]) => {
      setTitle(course.title || "Course");
      const mods = "modules" in course ? course.modules : [];
      const progress = progressOf(mods || []);
      setReady(Boolean(assessment.data?.submitted) && progress.total > 0 && progress.done === progress.total);
    });
  }, [courseId]);

  const download = async () => {
    if (courseId === "demos") {
      setMessage("Demo lessons do not issue a certificate.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await downloadCertificate(courseId, title);
    } catch (err: unknown) {
      const text = err instanceof Error ? err.message : "";
      const detail = axios.isAxiosError(err) ? err.response?.data : null;
      setMessage(text || (typeof detail?.detail === "string" ? detail.detail : "Submit the assessments before downloading the certificate."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p className="text-sm iq-muted"><Link to={`/my-courses/${courseId}`} className="iq-link">Back to course</Link></p>
      <h1 className="mt-2 text-3xl font-semibold">Certificate</h1>
      <p className="mt-2 max-w-2xl text-sm iq-muted">
        {title}. {ready
          ? "Every lesson is complete and the assessment is submitted. Download the certificate."
          : "Finish every lesson and submit the assessment before the certificate is issued."}
      </p>
      <button type="button" disabled={busy || !ready || courseId === "demos"} onClick={download} className="mt-6 rounded-full iq-accent-bg px-4 py-3 text-sm font-semibold disabled:opacity-50">{busy ? "Preparing…" : "Download certificate"}</button>
      {message && <p className="mt-3 text-sm iq-muted">{message}</p>}
    </div>
  );
};

const StudentSettings = () => {
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 8) { setMessage("Use at least 8 characters."); return; }
    try {
      await axios.post(`${API_BASE_URL}/user/change-password`, { current_password: current, new_password: password }, { headers: authHeaders() });
      setCurrent("");
      setPassword("");
      setMessage("Password updated.");
    } catch (err: unknown) {
      const detail = axios.isAxiosError(err) ? err.response?.data?.detail : "";
      setMessage(typeof detail === "string" ? detail : "The password could not be updated.");
    }
  };

  return (
    <form onSubmit={save} className="max-w-md">
      <h1 className="text-3xl font-semibold">Settings</h1>
      <label className="mt-6 block text-sm">Current password
        <input type="password" value={current} onChange={(event) => setCurrent(event.target.value)} autoComplete="current-password" className="mt-1 w-full rounded-xl border iq-line iq-surface px-3 py-3" />
      </label>
      <label className="mt-4 block text-sm">New password
        <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" className="mt-1 w-full rounded-xl border iq-line iq-surface px-3 py-3" />
      </label>
      <button className="mt-4 rounded-full iq-accent-bg px-4 py-3 text-sm font-semibold">Update password</button>
      {message && <p className="mt-3 text-sm iq-muted">{message}</p>}
    </form>
  );
};

export { Shell as StudentShell, MyCourses, CourseDashboard, LearnPage, Notebook, Assessments, CertificatePage, StudentSettings };
