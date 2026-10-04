import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  Award,
  BarChart3,
  BookOpen,
  Brain,
  Cloud,
  Code2,
  Compass,
  GraduationCap,
  Laptop,
  Menu,
  PenLine,
  Play,
  Route,
  Sparkles,
  X,
} from "lucide-react";
import BrandLogo from "./components/BrandLogo";
import CourseCover from "./components/CourseCover";
import CourseFacts from "./components/CourseFacts";
import { FAQS } from "./public/catalog";
import { useDayTheme } from "./public/useDayTheme";
import API_BASE_URL from "./config";

const heading = { fontFamily: '"Space Grotesk", Inter, sans-serif' };

const nav = [
  { label: "Home", href: "#top" },
  { label: "Explore Courses", href: "#courses" },
  { label: "Learning Paths", href: "#journey" },
  { label: "About Us", href: "#about" },
  { label: "Certifications", href: "#certification" },
  { label: "Contact", href: "/contact" },
];

const categories = [
  { title: "Artificial Intelligence & Machine Learning", text: "Structured study of models, methods, and the decisions they support in professional work.", icon: Brain },
  { title: "Data Science & Data Analytics", text: "Foundations for reading data, answering a question, and presenting a result you can defend.", icon: BarChart3 },
  { title: "Generative AI & Large Language Models", text: "How modern language tools work, and how to apply them with a clear task and a reviewable outcome.", icon: Sparkles },
  { title: "Programming & Software Development", text: "Practice that sits with the lesson: write, run, and improve code in a defined sequence.", icon: Code2 },
  { title: "Cloud Computing & Data Engineering", text: "The systems that store, move, and prepare data for teams that need them to stay reliable.", icon: Cloud },
  { title: "Business Analytics & Professional Skills", text: "The analytical habits and professional tools used to make a case from evidence.", icon: BookOpen },
];

const advantages = [
  { title: "Industry-Aligned Curriculum", text: "Learn concepts and tools relevant to modern professional environments through structured, application-oriented course content.", icon: Compass },
  { title: "Expert-Led Training", text: "Gain insights from experienced trainers who simplify complex concepts and connect learning with practical use cases.", icon: GraduationCap },
  { title: "Hands-On Learning", text: "Strengthen your understanding through practical exercises, assignments, projects, and real-world problem-solving.", icon: PenLine },
  { title: "Course-Based Certification", text: "Earn a course completion certificate upon meeting the applicable learning and assessment requirements, providing a record of your learning achievement.", icon: Award },
  { title: "Structured Learning Pathways", text: "Progress through organized modules and learning milestones that help you develop skills systematically.", icon: Route },
  { title: "Flexible Digital Learning", text: "Access your learning journey through a digital platform designed to support learners across locations and schedules.", icon: Laptop },
];

const journey = [
  { n: "01", title: "Discover", text: "Explore courses that align with your interests, learning goals, and professional aspirations." },
  { n: "02", title: "Learn", text: "Build your understanding through structured modules and expert-led instruction." },
  { n: "03", title: "Practice", text: "Apply your knowledge through exercises, assessments, and practical projects." },
  { n: "04", title: "Get Certified", text: "Complete the required course milestones and earn your course certificate." },
  { n: "05", title: "Advance", text: "Continue building your capabilities and prepare for new professional opportunities." },
];

type WatchLesson = { id: number; title: string; youtube_id: string };
type LiveCourse = { id: number; title: string; description: string; price: number; image_url?: string | null };

const Reveal = ({ children, className = "", delay = 0, as: Tag = "div" }: { children: ReactNode; className?: string; delay?: number; as?: "div" | "li" }) => {
  const ref = useRef<HTMLDivElement | HTMLLIElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setShown(true);
    }, { threshold: 0.12 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    <Tag ref={ref as never} className={`iq-reveal ${shown ? "is-in" : ""} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </Tag>
  );
};

const LandingPage = () => {
  const theme = useDayTheme();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);
  const [lessons, setLessons] = useState<WatchLesson[]>([]);
  const [watchStatus, setWatchStatus] = useState<"loading" | "ready" | "error">("loading");
  const [activeId, setActiveId] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [courses, setCourses] = useState<LiveCourse[]>([]);

  useEffect(() => {
    document.title = "IQNex | Industry-Oriented Courses & Professional Learning";
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "EducationalOrganization",
      name: "IQNex",
      parentOrganization: "IQMath Technologies",
      description: "A professional learning platform by IQMath Technologies for industry-oriented courses, expert-led training, and course-based certification.",
      slogan: "Intelligence • Innovation • Next",
      email: "contact@iqmath.in",
      telephone: "+91-93609-60219",
    });
    document.head.appendChild(script);
    return () => { script.remove(); };
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    axios.get<WatchLesson[]>(`${API_BASE_URL}/watch`)
      .then((res) => {
        const rows = Array.isArray(res.data) ? res.data : [];
        setLessons(rows);
        setActiveId(rows[0]?.id ?? null);
        setWatchStatus("ready");
      })
      .catch(() => setWatchStatus("error"));
    axios.get<LiveCourse[]>(`${API_BASE_URL}/public/courses`)
      .then((res) => setCourses(Array.isArray(res.data) ? res.data : []))
      .catch(() => setCourses([]));
  }, []);

  const active = lessons.find((lesson) => lesson.id === activeId) ?? lessons[0];
  const chooseLesson = (id: number) => {
    setActiveId(id);
    setPlaying(false);
  };

  return (
    <div id="top" data-theme={theme} className="iq-page min-h-screen" style={{ fontFamily: "Inter, sans-serif" }}>
      <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[80] focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-slate-900">Skip to content</a>

      <header className={`sticky top-0 z-50 border-b transition-colors ${scrolled ? "iq-line iq-header backdrop-blur-xl" : "border-transparent bg-transparent"}`}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" aria-label="IQNex home"><BrandLogo tone={theme === "dark" ? "onDark" : "ink"} size="sm" /></Link>
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
            {nav.map((item) => item.href.startsWith("/")
              ? <Link key={item.label} to={item.href} className="rounded-lg px-3 py-2 text-sm iq-subtle iq-hover-ink focus-visible:ring-2 focus-visible:ring-[var(--iq-link)]">{item.label}</Link>
              : <a key={item.label} href={item.href} className="rounded-lg px-3 py-2 text-sm iq-subtle iq-hover-ink focus-visible:ring-2 focus-visible:ring-[var(--iq-link)]">{item.label}</a>)}
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login" className="hidden rounded-full border iq-line px-4 py-2 text-sm font-semibold sm:inline-flex focus-visible:ring-2 focus-visible:ring-[var(--iq-link)]">Login</Link>
            <Link to="/signup" className="rounded-full iq-accent-bg px-4 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-[var(--iq-link)]">Get Started</Link>
            <button className="rounded-lg p-2 lg:hidden focus-visible:ring-2 focus-visible:ring-[var(--iq-link)]" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}><Menu size={20} /></button>
          </div>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-[60] bg-black/50 lg:hidden" onClick={() => setOpen(false)}>
          <div className="ml-auto flex h-full w-[min(100%,20rem)] flex-col iq-surface p-5" onClick={(event) => event.stopPropagation()}>
            <button aria-label="Close menu" onClick={() => setOpen(false)} className="mb-6 self-end"><X /></button>
            {nav.map((item) => item.href.startsWith("/")
              ? <Link key={item.label} to={item.href} className="border-b iq-line py-3 text-sm" onClick={() => setOpen(false)}>{item.label}</Link>
              : <a key={item.label} href={item.href} className="border-b iq-line py-3 text-sm" onClick={() => setOpen(false)}>{item.label}</a>)}
            <Link to="/login" className="mt-4 text-sm font-semibold iq-link" onClick={() => setOpen(false)}>Login</Link>
          </div>
        </div>
      )}

      <main id="content">
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-12 lg:grid-cols-[1.05fr_0.95fr] lg:pt-16">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] iq-accent">An IQMath Technologies learning platform</p>
            <h1 className="mt-4 max-w-xl text-4xl font-semibold leading-[1.08] sm:text-6xl" style={heading}>Build Skills That Move Your Career Forward.</h1>
            <p className="mt-4 text-xl font-medium iq-subtle" style={heading}>Learn. Apply. Get Certified. Grow.</p>
            <p className="mt-5 max-w-xl text-base leading-relaxed iq-muted">Discover industry-aligned courses, learn from experienced professionals, and develop the practical capabilities required to thrive in a rapidly evolving world.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#courses" className="rounded-full iq-accent-bg px-5 py-3 text-sm font-semibold">Explore Courses</a>
              <a href="#about" className="rounded-full border iq-line px-5 py-3 text-sm font-semibold">Discover IQNex</a>
            </div>
            <dl className="mt-10 grid gap-4 sm:grid-cols-3">
              {[["40,000+", "Students trained"], ["Expert-led", "Learning"], ["Global", "Learning community"]].map(([value, label]) => (
                <div key={label}>
                  <dt className="text-lg font-semibold" style={heading}>{value}</dt>
                  <dd className="mt-1 text-sm iq-muted">{label}</dd>
                </div>
              ))}
            </dl>
          </Reveal>

          <Reveal delay={120}>
            <div className="iq-float">
              <div className="rounded-3xl border iq-line iq-surface p-4 shadow-[0_24px_60px_rgba(18,32,51,0.08)]">
                <div className="flex items-center justify-between gap-3 border-b iq-line pb-3">
                  <p className="text-sm font-semibold">Learning dashboard</p>
                  <span className="rounded-full px-2 py-1 text-[11px] font-semibold iq-accent" style={{ background: "var(--iq-inset)" }}>In progress</span>
                </div>
                <div className="mt-4 rounded-2xl border iq-line p-4">
                  <p className="text-xs uppercase tracking-[0.14em] iq-faint">Current course</p>
                  <p className="mt-1 font-semibold">Business Analytics & Professional Skills</p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full iq-track">
                    <div className="h-full w-[68%] iq-fill" />
                  </div>
                  <p className="mt-2 text-xs iq-muted">Module 4 of 6 · Assessment open</p>
                </div>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {["Foundations", "Practice set", "Project brief", "Certificate"].map((item, index) => (
                    <li key={item} className="rounded-xl border iq-line px-3 py-3 text-sm">
                      <span className="block text-[11px] uppercase tracking-[0.12em] iq-faint">0{index + 1}</span>
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="mt-3 rounded-2xl border iq-line px-3 py-3">
                  <p className="text-[11px] uppercase tracking-[0.12em] iq-faint">Certificate</p>
                  <p className="mt-1 text-sm font-semibold">Course completion</p>
                  <p className="text-xs iq-muted">Ready after the assessment</p>
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        <section className="border-y iq-line">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <Reveal>
              <h2 className="max-w-2xl text-3xl font-semibold" style={heading}>Empowering Learners. Enabling Careers.</h2>
              <p className="mt-4 max-w-3xl text-sm leading-relaxed iq-muted">With a growing community of 40,000+ students trained by our experts, IQMath Technologies brings its learning experience to IQNex—an ecosystem built to make professional education more accessible, practical, and career-focused.</p>
            </Reveal>
            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["40,000+", "Students trained"],
                ["Global", "Learner community"],
                ["Expert-led", "Training"],
                ["Industry-oriented", "Courses"],
              ].map(([value, label], index) => (
                <Reveal as="li" key={label} delay={index * 70} className="rounded-2xl border iq-line iq-surface p-5">
                  <p className="text-2xl font-semibold iq-link" style={heading}>{value}</p>
                  <p className="mt-2 text-sm iq-muted">{label}</p>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>

        <section id="about" className="scroll-mt-24 mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 lg:grid-cols-2">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] iq-accent">About IQNex</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight" style={heading}>Where Intelligence Meets Innovation, and Learning Moves You to What's Next.</h2>
            <div className="mt-5 space-y-4 text-sm leading-relaxed iq-muted">
              <p>IQNex is a modern learning platform by IQMath Technologies, designed to bridge the gap between academic knowledge and industry expectations.</p>
              <p>Through structured learning pathways, practical assignments, expert guidance, and course-based certifications, we help learners develop relevant capabilities and build confidence to take their next professional step.</p>
              <p>Whether you are beginning your career, strengthening your expertise, or exploring emerging technologies, IQNex provides a structured environment to learn with purpose.</p>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <ul className="grid gap-3 sm:grid-cols-2">
              {["Practical Learning", "Expert Guidance", "Structured Progress", "Professional Certification"].map((item) => (
                <li key={item} className="rounded-2xl border iq-line iq-surface p-5">
                  <span className="mb-3 block h-1.5 w-8 rounded-full iq-fill" />
                  <h3 className="font-semibold">{item}</h3>
                </li>
              ))}
            </ul>
          </Reveal>
        </section>

        <section id="courses" className="scroll-mt-24 border-y iq-line">
          <div className="mx-auto max-w-6xl px-4 py-20">
            <Reveal>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] iq-accent">Explore our learning ecosystem</p>
              <h2 className="mt-3 max-w-2xl text-3xl font-semibold" style={heading}>Learn Skills That Matter in the Real World.</h2>
              <p className="mt-4 max-w-3xl text-sm leading-relaxed iq-muted">Explore thoughtfully structured courses designed to combine foundational knowledge, practical implementation, and industry-relevant applications. Every learning journey is built to help you move beyond theory and develop skills you can confidently apply.</p>
            </Reveal>
            <ul className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {categories.map((item, index) => (
                <Reveal as="li" key={item.title} delay={(index % 3) * 60} className="iq-card-lift h-full rounded-2xl border iq-line iq-surface p-5">
                  <item.icon size={20} className="iq-link" aria-hidden="true" />
                  <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed iq-muted">{item.text}</p>
                  <Link to="/login" className="mt-4 inline-block text-sm font-semibold iq-link">Explore Courses</Link>
                </Reveal>
              ))}
            </ul>
            {courses.length > 0 && (
              <ul className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {courses.map((course) => (
                  <li key={course.id} className="flex flex-col overflow-hidden rounded-2xl border iq-line iq-surface">
                    <CourseCover title={course.title} imageUrl={course.image_url} className="rounded-none" />
                    <div className="flex flex-1 flex-col p-5">
                      <p className="text-xs uppercase tracking-[0.14em] iq-faint">{Number(course.price) > 0 ? `₹${course.price}` : "Free"}</p>
                      <h3 className="mt-2 font-semibold">{course.title}</h3>
                      <CourseFacts description={course.description} />
                      <Link to={`/share/courses/${course.id}`} className="mt-auto pt-4 inline-block text-sm font-semibold iq-link">View curriculum</Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/login" className="mt-8 inline-flex rounded-full iq-accent-bg px-5 py-3 text-sm font-semibold">Explore All Courses</Link>
          </div>
        </section>

        <section id="experts" className="scroll-mt-24 mx-auto max-w-6xl px-4 py-20">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] iq-accent">Watch our experts</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold" style={heading}>See how the training is taught.</h2>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed iq-muted">These are the demo lessons published from the instructor Watch desk. Choose a lesson and it plays here on IQNex. A new lesson added by an instructor appears on this page.</p>
          </Reveal>
          {watchStatus === "loading" && <p className="mt-8 text-sm iq-muted">Loading expert lessons…</p>}
          {watchStatus === "error" && <p className="mt-8 text-sm iq-muted">The lessons could not be loaded. Refresh when the learning service is available.</p>}
          {watchStatus === "ready" && lessons.length === 0 && (
            <p className="mt-8 rounded-2xl border iq-line iq-surface p-6 text-sm iq-muted">No expert lesson is published yet. An instructor can add one from Watch in the instructor account.</p>
          )}
          {watchStatus === "ready" && active && (
            <div className="mt-8 grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
              <div className="overflow-hidden rounded-2xl border iq-line bg-black">
                {playing ? (
                  <iframe
                    key={active.youtube_id}
                    className="aspect-video w-full"
                    src={`https://www.youtube-nocookie.com/embed/${active.youtube_id}?autoplay=1&rel=0`}
                    title={active.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                ) : (
                  <button type="button" onClick={() => setPlaying(true)} className="group relative block w-full" aria-label={`Play ${active.title}`}>
                    <img src={`https://i.ytimg.com/vi/${active.youtube_id}/mqdefault.jpg`} alt="" className="aspect-video w-full object-cover" width={320} height={180} loading="lazy" decoding="async" />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <span className="flex h-16 w-16 items-center justify-center rounded-full iq-accent-bg"><Play size={22} aria-hidden="true" /></span>
                    </span>
                  </button>
                )}
              </div>
              <div className="rounded-2xl border iq-line iq-surface p-4">
                <p className="text-sm font-semibold">Expert lessons</p>
                <ul className="mt-3 max-h-[22rem] space-y-2 overflow-auto">
                  {lessons.map((lesson) => (
                    <li key={lesson.id}>
                      <button
                        type="button"
                        onClick={() => chooseLesson(lesson.id)}
                        className={`w-full rounded-xl border px-3 py-3 text-left text-sm focus-visible:ring-2 focus-visible:ring-[var(--iq-link)] ${lesson.id === active.id ? "iq-accent-border iq-accent" : "iq-line iq-subtle"}`}
                      >
                        {lesson.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </section>

        <section className="border-y iq-line">
          <div className="mx-auto max-w-6xl px-4 py-20">
            <Reveal>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] iq-accent">The IQNex advantage</p>
              <h2 className="mt-3 max-w-2xl text-3xl font-semibold" style={heading}>A Learning Experience Designed Around Your Growth.</h2>
            </Reveal>
            <ul className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {advantages.map((item, index) => (
                <Reveal as="li" key={item.title} delay={(index % 3) * 60} className="iq-card-lift flex h-full flex-col rounded-2xl border iq-line iq-surface p-5">
                  <item.icon size={20} className="iq-link" aria-hidden="true" />
                  <h3 className="mt-4 font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed iq-muted">{item.text}</p>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>

        <section id="journey" className="scroll-mt-24 mx-auto max-w-6xl px-4 py-20">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] iq-accent">Your path to progress</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold" style={heading}>Your Next Opportunity Starts With What You Learn Today.</h2>
          </Reveal>
          <ol className="mt-10 grid gap-4 lg:grid-cols-5">
            {journey.map((step, index) => (
              <Reveal as="li" key={step.n} delay={index * 60} className="relative h-full rounded-2xl border iq-line iq-surface p-5">
                <span className="text-sm font-semibold iq-accent">{step.n}</span>
                <h3 className="mt-3 font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed iq-muted">{step.text}</p>
              </Reveal>
            ))}
          </ol>
        </section>

        <section id="certification" className="scroll-mt-24 border-y iq-line">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 lg:grid-cols-2">
            <Reveal>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] iq-accent">Recognize your learning achievements</p>
              <h2 className="mt-3 text-3xl font-semibold" style={heading}>Every Skill You Build Deserves Recognition.</h2>
              <p className="mt-4 text-sm leading-relaxed iq-muted">Turn your learning milestones into meaningful achievements. Complete the required coursework and assessments to earn a course-based certificate that reflects your learning progress and demonstrated completion.</p>
              <ul className="mt-6 space-y-3 text-sm">
                {["Course-specific certification.", "Structured learning milestones.", "Assessment-based completion.", "Professional certificate presentation."].map((item) => (
                  <li key={item} className="flex gap-3"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full iq-fill" /><span>{item}</span></li>
                ))}
              </ul>
              <Link to="/signup" className="mt-8 inline-flex rounded-full iq-accent-bg px-5 py-3 text-sm font-semibold">Explore Certification Programs</Link>
            </Reveal>
            <Reveal delay={80}>
              <div className="rounded-3xl border iq-line iq-surface p-3 shadow-[0_18px_50px_rgba(18,32,51,0.06)]" aria-hidden="true">
                <div className="rounded-2xl border p-6 sm:p-8" style={{ borderColor: "var(--iq-link)" }}>
                  <BrandLogo size="sm" />
                  <p className="mt-8 text-center text-xs font-semibold uppercase tracking-[0.22em]">Course completion</p>
                  <p className="mt-1 text-center text-lg font-semibold iq-link" style={heading}>Certificate</p>
                  <p className="mt-6 text-center text-[11px] uppercase tracking-[0.16em] iq-faint">This is to certify that</p>
                  <p className="mt-2 text-center text-2xl font-semibold" style={heading}>Learner name</p>
                  <p className="mx-auto mt-4 max-w-sm text-center text-xs leading-relaxed iq-muted">has successfully completed the course conducted by IQmath Technologies, including the required assessment.</p>
                  <div className="mt-8 grid grid-cols-2 gap-4 text-center text-[11px]">
                    <div><p className="font-semibold">Malar Saravanan</p><p className="iq-faint">Chairman & Founder</p></div>
                    <div><p className="font-semibold">Eneeyan N</p><p className="iq-faint">Chief Mentor</p></div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 lg:grid-cols-[1.1fr_0.9fr]">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] iq-accent">Learning without borders</p>
            <h2 className="mt-3 text-3xl font-semibold" style={heading}>One Learning Community. Opportunities Without Borders.</h2>
            <div className="mt-4 space-y-4 text-sm leading-relaxed iq-muted">
              <p>Learning should not be limited by geography. IQNex brings together learners from different locations and backgrounds through a shared commitment to knowledge, innovation, and professional growth.</p>
              <p>With the training experience of IQMath Technologies and a community spanning global learners, we aim to create a learning environment where ambition meets opportunity.</p>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <div className="rounded-3xl border iq-line iq-surface p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] iq-faint">IQNex</p>
              <p className="mt-3 text-2xl font-semibold" style={heading}>Intelligence • Innovation • Next</p>
              <p className="mt-4 text-sm leading-relaxed iq-muted">40,000+ students trained by experts. Learners join from different places, on the same courses, with the same certificate.</p>
            </div>
          </Reveal>
        </section>

        <section className="px-4 pb-20">
          <div className="mx-auto max-w-6xl rounded-3xl px-6 py-14 sm:px-12" style={{ background: "var(--iq-ink)", color: "var(--iq-ink-text)" }}>
            <h2 className="max-w-xl text-3xl font-semibold sm:text-4xl" style={heading}>Your Future Is Built One Skill at a Time.</h2>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed opacity-80">Take the next step in your learning journey with IQNex. Explore professional courses, strengthen your capabilities, and turn knowledge into meaningful progress.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/signup" className="rounded-full iq-accent-bg px-5 py-3 text-sm font-semibold">Start Learning Today</Link>
              <a href="#courses" className="rounded-full border px-5 py-3 text-sm font-semibold" style={{ borderColor: "currentColor" }}>Explore Courses</a>
            </div>
          </div>
        </section>

        <section id="faq" className="scroll-mt-24 mx-auto max-w-6xl px-4 pb-20">
          <h2 className="text-3xl font-semibold" style={heading}>FAQs</h2>
          <div className="mt-8 max-w-3xl divide-y iq-divide rounded-2xl border iq-line">
            {FAQS.map((item, index) => (
              <div key={item.q}>
                <button className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left text-sm font-semibold" aria-expanded={openFaq === index} onClick={() => setOpenFaq(openFaq === index ? -1 : index)}>
                  {item.q}
                  <span className="iq-faint" aria-hidden="true">{openFaq === index ? "–" : "+"}</span>
                </button>
                {openFaq === index && <p className="px-4 pb-4 text-sm leading-relaxed iq-muted">{item.a}</p>}
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t iq-line">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <BrandLogo tone={theme === "dark" ? "onDark" : "ink"} size="sm" />
            <p className="mt-3 text-sm font-medium">Intelligence • Innovation • Next</p>
            <p className="mt-3 max-w-xs text-sm leading-relaxed iq-muted">A professional learning platform by IQMath Technologies. Empowering learners through industry-oriented education, practical learning, and continuous skill development.</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] iq-faint">Platform</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li><a className="iq-subtle iq-hover-ink" href="#courses">Explore Courses</a></li>
              <li><a className="iq-subtle iq-hover-ink" href="#journey">Learning Paths</a></li>
              <li><a className="iq-subtle iq-hover-ink" href="#certification">Certifications</a></li>
              <li><Link className="iq-subtle iq-hover-ink" to="/login">Student Login</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] iq-faint">Company</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li><a className="iq-subtle iq-hover-ink" href="#about">About IQNex</a></li>
              <li><a className="iq-subtle iq-hover-ink" href="#about">IQMath Technologies</a></li>
              <li><Link className="iq-subtle iq-hover-ink" to="/contact">Contact Us</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] iq-faint">Support</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link className="iq-subtle iq-hover-ink" to="/contact">Help Center</Link></li>
              <li><a className="iq-subtle iq-hover-ink" href="#faq">FAQs</a></li>
              <li><a className="iq-subtle iq-hover-ink" href="mailto:contact@iqmath.in">contact@iqmath.in</a></li>
              <li><a className="iq-subtle iq-hover-ink" href="https://wa.me/919360960219">WhatsApp +91 93609 60219</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t iq-line px-4 py-4 text-xs iq-faint">
          <p className="mx-auto max-w-6xl">© 2026 IQNex. All rights reserved. A learning platform by IQMath Technologies.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
