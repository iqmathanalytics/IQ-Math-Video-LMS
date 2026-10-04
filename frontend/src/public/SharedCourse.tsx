import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { ChevronDown, ChevronUp, Lock } from "lucide-react";
import API_BASE_URL from "../config";
import CourseCover from "../components/CourseCover";
import CourseFacts from "../components/CourseFacts";
import PublicShell from "./PublicShell";
import { getValidSession } from "../utils/session";

type Lesson = { id: number; title: string; type?: string; duration?: number | null; locked?: boolean };
type Module = { id: number; title: string; locked?: boolean; lessons: Lesson[] };
type Shared = {
  id: number;
  title: string;
  description?: string;
  price?: number;
  image_url?: string | null;
  language?: string | null;
  course_type?: string | null;
  modules: Module[];
  module_count?: number;
  lesson_count?: number;
  preview?: boolean;
};

const typeLabel = (type?: string) => {
  const value = (type || "lesson").toLowerCase();
  if (value.includes("assign")) return "Assignment";
  if (value.includes("quiz") || value.includes("test")) return "Assessment";
  if (value.includes("code")) return "Coding";
  return "Lesson";
};

const SharedCourse = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Shared | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">("loading");
  const [modulesOpen, setModulesOpen] = useState(false);
  const session = getValidSession();
  const signedIn = Boolean(session?.token && session.role === "student");
  const sharePath = `/share/courses/${courseId || ""}`;
  const loginPath = `/login?next=${encodeURIComponent(sharePath)}`;
  const continuePath = signedIn ? "/courses" : loginPath;

  useEffect(() => {
    if (!courseId) {
      setStatus("missing");
      return;
    }
    setStatus("loading");
    const headers = session?.token ? { Authorization: `Bearer ${session.token}` } : undefined;
    axios.get(`${API_BASE_URL}/public/courses/${courseId}`, { headers })
      .then((res) => {
        setCourse(res.data);
        setStatus("ready");
      })
      .catch(() => {
        setCourse(null);
        setStatus("missing");
      });
  }, [courseId, session?.token]);

  if (status === "loading") {
    return (
      <PublicShell title="Course">
        <div className="mx-auto max-w-3xl px-4 py-16">
          <p className="text-sm iq-muted">Loading course…</p>
        </div>
      </PublicShell>
    );
  }

  if (status === "missing" || !course) {
    return (
      <PublicShell title="Course">
        <div className="mx-auto max-w-3xl px-4 py-16">
          <h1 className="text-3xl font-semibold" style={{ fontFamily: '"Space Grotesk", Inter, sans-serif' }}>This course is not available</h1>
          <p className="mt-3 text-sm iq-muted">It may be hidden, or the share link is incorrect.</p>
          <Link to="/" className="mt-6 inline-flex rounded-full iq-accent-bg px-4 py-2 text-sm font-semibold">Back to home</Link>
        </div>
      </PublicShell>
    );
  }

  const preview = course.preview !== false && !signedIn;
  const goLogin = () => navigate(loginPath);

  return (
    <PublicShell title={course.title}>
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-4xl font-semibold" style={{ fontFamily: '"Space Grotesk", Inter, sans-serif' }}>{course.title}</h1>
        <p className="mt-2 text-sm iq-muted">
          {Number(course.price) > 0 ? `₹${course.price}` : "Free"}
          {course.language ? ` · ${course.language}` : ""}
          {` · ${course.module_count ?? course.modules.length} modules · ${course.lesson_count ?? course.modules.reduce((n, m) => n + m.lessons.length, 0)} lessons`}
        </p>
        <div className="mt-6 overflow-hidden rounded-2xl border iq-line">
          <CourseCover title={course.title} imageUrl={course.image_url} className="rounded-none" size="medium" priority />
        </div>
        <div className="mt-4">
          <CourseFacts
            description={course.description}
            onSyllabusClick={preview ? (event) => { event.preventDefault(); goLogin(); } : undefined}
          />
        </div>

        <section className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold" style={{ fontFamily: '"Space Grotesk", Inter, sans-serif' }}>Curriculum</h2>
              <p className="mt-2 text-sm iq-muted">
                {preview
                  ? "Preview the first lessons. Sign in to view the full course."
                  : "Modules and lessons in this course."}
              </p>
            </div>
            {course.modules.length > 0 && (
              <button
                type="button"
                onClick={() => setModulesOpen((open) => !open)}
                className="inline-flex items-center gap-2 rounded-full border iq-line px-4 py-2 text-sm font-semibold iq-subtle"
                aria-expanded={modulesOpen}
              >
                {modulesOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                {modulesOpen ? "Hide modules" : "Expand modules"}
              </button>
            )}
          </div>

          {!modulesOpen && course.modules.length > 0 && (
            <button
              type="button"
              onClick={() => setModulesOpen(true)}
              className="mt-6 w-full rounded-2xl border iq-line iq-surface p-5 text-left"
            >
              <p className="text-sm font-semibold">
                {course.module_count ?? course.modules.length} modules · {course.lesson_count ?? course.modules.reduce((n, m) => n + m.lessons.length, 0)} lessons
              </p>
              <p className="mt-1 text-sm iq-muted">Click Expand modules to view the curriculum.</p>
            </button>
          )}

          {course.modules.length === 0 && (
            <p className="mt-6 rounded-2xl border iq-line p-5 text-sm iq-muted">Modules will appear here once the instructor adds them.</p>
          )}

          {modulesOpen && (
            <>
              <ol className="mt-6 space-y-4">
                {course.modules.map((module, index) => {
                  const moduleLocked = preview && (module.locked || index > 0);
                  return (
                    <li
                      key={module.id}
                      className={`relative overflow-hidden rounded-2xl border iq-line iq-surface ${moduleLocked ? "p-3" : "p-5"}`}
                    >
                      {moduleLocked ? (
                        <button type="button" onClick={goLogin} className="block w-full text-left">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs uppercase tracking-[0.14em] iq-faint">Module {index + 1}</p>
                              <h3 className="mt-1 truncate text-base font-semibold blur-[3px] select-none" aria-hidden>Locked module title</h3>
                            </div>
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border iq-line px-2.5 py-1 text-xs iq-muted">
                              <Lock size={12} /> Sign in to view
                            </span>
                          </div>
                          <ul className="mt-2 max-h-16 space-y-1 overflow-hidden opacity-70">
                            {(module.lessons.length ? module.lessons : [{ id: -1, title: "Locked", locked: true }]).slice(0, 2).map((lesson) => (
                              <li key={lesson.id} className="truncate text-sm blur-[3px] select-none" aria-hidden>
                                Session title locked
                              </li>
                            ))}
                          </ul>
                        </button>
                      ) : (
                        <>
                          <p className="text-xs uppercase tracking-[0.14em] iq-faint">Module {index + 1}</p>
                          <h3 className="mt-1 text-lg font-semibold">{module.title}</h3>
                          <ul className="mt-3 space-y-2">
                            {module.lessons.map((lesson, lessonIndex) => {
                              const lessonLocked = preview && (lesson.locked || lessonIndex >= 2);
                              if (lessonLocked) {
                                return (
                                  <li key={lesson.id}>
                                    <button
                                      type="button"
                                      onClick={goLogin}
                                      className="flex w-full items-center justify-between gap-3 border-t iq-line pt-2 text-left text-sm"
                                    >
                                      <span className="min-w-0 flex-1 truncate blur-[3px] select-none iq-subtle" aria-hidden>
                                        Locked session title
                                      </span>
                                      <span className="inline-flex shrink-0 items-center gap-1 text-xs iq-faint">
                                        <Lock size={12} /> Sign in to view
                                      </span>
                                    </button>
                                  </li>
                                );
                              }
                              return (
                                <li key={lesson.id} className="flex items-start justify-between gap-3 border-t iq-line pt-2 text-sm">
                                  <span className="iq-subtle">
                                    <span className="mr-2 tabular-nums iq-faint">{lessonIndex + 1}.</span>
                                    {lesson.title}
                                  </span>
                                  <span className="shrink-0 text-xs iq-faint">{typeLabel(lesson.type)}</span>
                                </li>
                              );
                            })}
                            {module.lessons.length === 0 && <li className="text-sm iq-muted">No lessons in this module yet.</li>}
                          </ul>
                        </>
                      )}
                    </li>
                  );
                })}
              </ol>
              {preview && (
                <div className="mt-4 rounded-2xl border iq-line p-4 text-center">
                  <p className="text-sm iq-muted">Sign in to view the full course.</p>
                  <Link to={loginPath} className="mt-3 inline-flex rounded-full iq-accent-bg px-5 py-2.5 text-sm font-semibold">
                    Sign in to view
                  </Link>
                </div>
              )}
            </>
          )}
        </section>

        <div className="mt-10 rounded-2xl border iq-line p-5">
          <h2 className="text-lg font-semibold">Ready to learn?</h2>
          <p className="mt-2 text-sm iq-muted">
            {signedIn
              ? "Open the course catalogue to enroll and continue learning."
              : "Sign in with your learner account to enroll and access lessons."}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link to={continuePath} className="rounded-full iq-accent-bg px-5 py-2.5 text-sm font-semibold">
              {signedIn ? "Continue to courses" : "Sign in to continue"}
            </Link>
            {!signedIn && (
              <Link to={`/signup?next=${encodeURIComponent(sharePath)}`} className="rounded-full border iq-line px-5 py-2.5 text-sm font-semibold">
                Create a learner account
              </Link>
            )}
          </div>
        </div>
      </div>
    </PublicShell>
  );
};

export default SharedCourse;
