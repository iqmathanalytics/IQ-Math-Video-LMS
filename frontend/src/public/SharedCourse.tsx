import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { ChevronDown, ChevronUp } from "lucide-react";
import API_BASE_URL from "../config";
import CourseCover from "../components/CourseCover";
import CourseFacts from "../components/CourseFacts";
import PublicShell from "./PublicShell";
import { getValidSession } from "../utils/session";

type Lesson = { id: number; title: string; type?: string; duration?: number | null };
type Module = { id: number; title: string; lesson_count?: number; lessons: Lesson[] };
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
  const coursesPath = "/courses";

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
  const goCourses = () => navigate(coursesPath);
  const moduleCount = course.module_count ?? course.modules.length;
  const lessonCount = course.lesson_count ?? course.modules.reduce((n, m) => n + (m.lesson_count ?? m.lessons.length), 0);

  return (
    <PublicShell title={course.title}>
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-4xl font-semibold" style={{ fontFamily: '"Space Grotesk", Inter, sans-serif' }}>{course.title}</h1>
        <p className="mt-2 text-sm iq-muted">
          {Number(course.price) > 0 ? `₹${course.price}` : "Free"}
          {course.language ? ` · ${course.language}` : ""}
          {` · ${moduleCount} modules · ${lessonCount} lessons`}
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
                  ? "Module names only. Sign in to open lessons and enroll."
                  : "Open a module or lesson to continue in your courses."}
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
              <p className="text-sm font-semibold">{moduleCount} modules · {lessonCount} lessons</p>
              <p className="mt-1 text-sm iq-muted">Click Expand modules to view the list.</p>
            </button>
          )}

          {course.modules.length === 0 && (
            <p className="mt-6 rounded-2xl border iq-line p-5 text-sm iq-muted">Modules will appear here once the instructor adds them.</p>
          )}

          {modulesOpen && (
            <>
              <ol className="mt-6 space-y-3">
                {course.modules.map((module, index) => (
                  <li key={module.id} className="rounded-2xl border iq-line iq-surface p-4">
                    {preview ? (
                      <div>
                        <p className="text-xs uppercase tracking-[0.14em] iq-faint">Module {index + 1}</p>
                        <h3 className="mt-1 text-lg font-semibold">{module.title}</h3>
                        <p className="mt-1 text-xs iq-muted">
                          {(module.lesson_count ?? module.lessons.length) || 0} lessons · Sign in to view details
                        </p>
                      </div>
                    ) : (
                      <div>
                        <button type="button" onClick={goCourses} className="w-full text-left">
                          <p className="text-xs uppercase tracking-[0.14em] iq-faint">Module {index + 1}</p>
                          <h3 className="mt-1 text-lg font-semibold iq-link">{module.title}</h3>
                        </button>
                        <ul className="mt-3 space-y-2">
                          {module.lessons.map((lesson, lessonIndex) => (
                            <li key={lesson.id}>
                              <button
                                type="button"
                                onClick={goCourses}
                                className="flex w-full cursor-pointer items-start justify-between gap-3 border-t iq-line pt-2 text-left text-sm"
                              >
                                <span className="iq-subtle">
                                  <span className="mr-2 tabular-nums iq-faint">{lessonIndex + 1}.</span>
                                  {lesson.title}
                                </span>
                                <span className="shrink-0 text-xs iq-faint">{typeLabel(lesson.type)}</span>
                              </button>
                            </li>
                          ))}
                          {module.lessons.length === 0 && <li className="text-sm iq-muted">No lessons in this module yet.</li>}
                        </ul>
                      </div>
                    )}
                  </li>
                ))}
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
              ? "Continue in your course catalogue to enroll and open lessons."
              : "Sign in with your learner account to enroll and access lessons."}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link to={signedIn ? coursesPath : loginPath} className="rounded-full iq-accent-bg px-5 py-2.5 text-sm font-semibold">
              {signedIn ? "Go to courses" : "Sign in to continue"}
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
