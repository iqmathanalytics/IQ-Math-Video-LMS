import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { ChevronDown, ChevronUp } from "lucide-react";
import API_BASE_URL from "../config";
import CourseCover from "../components/CourseCover";
import CourseFacts from "../components/CourseFacts";
import PublicShell from "./PublicShell";
import { getValidSession } from "../utils/session";

type Module = { id: number; title: string; lesson_count?: number; lessons?: { id: number }[] };
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
};

const SharedCourse = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Shared | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">("loading");
  const [modulesOpen, setModulesOpen] = useState(false);
  const session = getValidSession();
  const signedIn = Boolean(session?.token && session.role === "student");
  const coursesPath = courseId ? `/courses?course=${encodeURIComponent(courseId)}` : "/courses";
  const loginPath = `/login?next=${encodeURIComponent(coursesPath)}`;

  useEffect(() => {
    if (!courseId) {
      setStatus("missing");
      return;
    }
    // Always load the public teaser (no auth) so the share page stays a curriculum preview.
    setStatus("loading");
    axios.get(`${API_BASE_URL}/public/courses/${courseId}`)
      .then((res) => {
        setCourse(res.data);
        setStatus("ready");
      })
      .catch(() => {
        setCourse(null);
        setStatus("missing");
      });
  }, [courseId]);

  if (!courseId) {
    return (
      <PublicShell title="Course">
        <div className="mx-auto max-w-3xl px-4 py-16">
          <h1 className="text-3xl font-semibold" style={{ fontFamily: '"Space Grotesk", Inter, sans-serif' }}>This course is not available</h1>
          <Link to="/" className="mt-6 inline-flex rounded-full iq-accent-bg px-4 py-2 text-sm font-semibold">Back to home</Link>
        </div>
      </PublicShell>
    );
  }

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

  const continuePath = signedIn ? coursesPath : loginPath;
  const goContinue = () => navigate(continuePath);
  const moduleCount = course.module_count ?? course.modules.length;
  const lessonCount = course.lesson_count ?? course.modules.reduce((n, m) => n + (m.lesson_count ?? m.lessons?.length ?? 0), 0);

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
            onSyllabusClick={(event) => { event.preventDefault(); goContinue(); }}
          />
        </div>

        <section className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold" style={{ fontFamily: '"Space Grotesk", Inter, sans-serif' }}>Curriculum</h2>
              <p className="mt-2 text-sm iq-muted">
                {signedIn
                  ? "Module names preview. Open Courses to enroll and access lessons."
                  : "Module names only. Sign in to open this course and enroll."}
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
                    <button type="button" onClick={goContinue} className="w-full text-left">
                      <p className="text-xs uppercase tracking-[0.14em] iq-faint">Module {index + 1}</p>
                      <h3 className="mt-1 text-lg font-semibold iq-link">{module.title}</h3>
                      <p className="mt-1 text-xs iq-muted">
                        {(module.lesson_count ?? module.lessons?.length) || 0} lessons ·{" "}
                        {signedIn ? "Open in Courses" : "Sign in to open in Courses"}
                      </p>
                    </button>
                  </li>
                ))}
              </ol>

              {!signedIn && (
                <div className="mt-4 rounded-2xl border iq-line p-4 text-center">
                  <p className="text-sm iq-muted">Sign in to open this course in your catalogue.</p>
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
              ? "Continue in Courses to enroll and open lessons for this course."
              : "Sign in with your learner account to open this course, enroll, and access lessons."}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link to={continuePath} className="rounded-full iq-accent-bg px-5 py-2.5 text-sm font-semibold">
              {signedIn ? "Go to this course" : "Sign in to continue"}
            </Link>
            {!signedIn && (
              <Link to={`/signup?next=${encodeURIComponent(coursesPath)}`} className="rounded-full border iq-line px-5 py-2.5 text-sm font-semibold">
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
