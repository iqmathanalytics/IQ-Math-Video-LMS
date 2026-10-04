import { useMemo, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import PublicShell from "./PublicShell";
import { COURSES, PATHS, type Topic } from "./catalog";

const wrap = "mx-auto max-w-6xl px-4 py-14";

export const CoursesPage = () => {
  const [topic, setTopic] = useState<Topic | "All">("All");
  const [level, setLevel] = useState("All");
  const [sort, setSort] = useState("rating");
  const items = useMemo(() => {
    const next = COURSES.filter((course) => (topic === "All" || course.topic === topic) && (level === "All" || course.level === level));
    return [...next].sort((a, b) => sort === "title" ? a.title.localeCompare(b.title) : Number(b.rating) - Number(a.rating));
  }, [topic, level, sort]);

  return (
    <PublicShell title="Courses">
      <div className={wrap}>
        <h1 className="text-4xl font-semibold" style={{ fontFamily: '"Space Grotesk", Inter, sans-serif' }}>Courses</h1>
        <p className="mt-3 max-w-2xl iq-muted">Curated lessons on IQNex. Sign in to track progress in the learner app.</p>
        <div className="mt-8 flex flex-wrap gap-2">
          {(["All", "AI", "Web", "Cloud", "Data", "DevOps", "Career"] as const).map((item) => (
            <button key={item} onClick={() => setTopic(item)} className={`rounded-full border px-3 py-1.5 text-sm ${topic === item ? "iq-accent-border iq-accent" : "iq-line iq-subtle"}`}>{item}</button>
          ))}
          <label className="sr-only" htmlFor="level">Level</label>
          <select id="level" value={level} onChange={(event) => setLevel(event.target.value)} className="rounded-full border iq-line iq-surface px-3 py-1.5 text-sm text-[var(--iq-text)]">
            <option>All</option><option>Beginner</option><option>Intermediate</option><option>Advanced</option>
          </select>
          <label className="sr-only" htmlFor="sort">Sort</label>
          <select id="sort" value={sort} onChange={(event) => setSort(event.target.value)} className="rounded-full border iq-line iq-surface px-3 py-1.5 text-sm text-[var(--iq-text)]">
            <option value="rating">Highest rated</option>
            <option value="title">Title</option>
          </select>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {items.map((course) => (
            <Link key={course.slug} to={`/courses/${course.slug}`} className="rounded-2xl border iq-line iq-surface p-5 hover:border-[var(--iq-border-strong)]">
              <p className="text-xs uppercase tracking-[0.14em] iq-faint">{course.topic} · {course.level} · {course.duration}</p>
              <h2 className="mt-2 text-xl font-semibold">{course.title}</h2>
              <p className="mt-2 text-sm iq-muted">{course.blurb}</p>
              <p className="mt-4 text-sm iq-subtle">{course.channelName} · {course.rating}</p>
            </Link>
          ))}
        </div>
      </div>
    </PublicShell>
  );
};

export const CourseDetailPage = () => {
  const { slug } = useParams();
  const course = COURSES.find((item) => item.slug === slug);
  if (!course) {
    return <PublicShell title="Course"><div className={wrap}><h1 className="text-3xl">That course is not in the public catalogue.</h1><Link className="mt-4 inline-block iq-accent" to="/courses">Back to courses</Link></div></PublicShell>;
  }
  const related = COURSES.filter((item) => item.slug !== course.slug && item.topic === course.topic).slice(0, 2);
  return (
    <PublicShell title={course.title}>
      <div className={wrap}>
        <p className="text-xs uppercase tracking-[0.14em] iq-faint">{course.topic} · {course.level} · {course.language}</p>
        <h1 className="mt-2 max-w-3xl text-4xl font-semibold" style={{ fontFamily: '"Space Grotesk", Inter, sans-serif' }}>{course.title}</h1>
        <p className="mt-4 max-w-2xl iq-subtle">{course.blurb}</p>
        <div className="mt-8 overflow-hidden rounded-2xl border iq-line bg-black">
          {course.youtubeId ? (
            <iframe className="aspect-video w-full" src={`https://www.youtube-nocookie.com/embed/${course.youtubeId}`} title={`${course.title} by ${course.creatorName}`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
          ) : (
            <div className="flex aspect-video items-center justify-center p-8 text-center iq-subtle">This path links to the creator's channel. Open the source to watch the current lessons.</div>
          )}
        </div>
        <p className="mt-3 text-sm iq-muted">
          Created by {course.creatorName} on <a className="iq-link underline" href={course.channelUrl} target="_blank" rel="noreferrer">{course.channelName}</a>.
          IQNex does not re-host this video. <a className="iq-link underline" href={course.sourceUrl} target="_blank" rel="noreferrer">Watch on IQNex</a>.
        </p>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div>
            <h2 className="text-lg font-semibold">What you practise</h2>
            <ul className="mt-3 space-y-2 text-sm iq-subtle">{course.outcomes.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
          <div className="rounded-2xl border iq-line p-5">
            <h2 className="text-lg font-semibold">Enroll</h2>
            <p className="mt-2 text-sm iq-muted">Sign in with the learner account. Progress, assignments and certificates run in the existing student app.</p>
            <Link to="/login" className="mt-4 inline-flex rounded-full iq-accent-bg px-4 py-2 text-sm font-semibold">Sign in to continue</Link>
          </div>
        </div>
        {related.length > 0 && (
          <div className="mt-10">
            <h2 className="text-lg font-semibold">Related</h2>
            <div className="mt-3 flex flex-wrap gap-3">{related.map((item) => <Link key={item.slug} className="rounded-full border iq-line px-3 py-1.5 text-sm" to={`/courses/${item.slug}`}>{item.title}</Link>)}</div>
          </div>
        )}
      </div>
    </PublicShell>
  );
};

export const PathsPage = () => (
  <PublicShell title="Learning paths">
    <div className={wrap}>
      <h1 className="text-4xl font-semibold" style={{ fontFamily: '"Space Grotesk", Inter, sans-serif' }}>Paths</h1>
      <p className="mt-3 max-w-2xl iq-muted">Three roads through the public catalogue. Finish a node, then the next one is the obvious step.</p>
      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        {PATHS.map((path) => (
          <article key={path.slug} className="rounded-2xl border iq-line iq-surface p-5">
            <h2 className="text-xl font-semibold">{path.title}</h2>
            <ol className="mt-4 space-y-3">
              {path.steps.map((step, index) => (
                <li key={step} className="flex gap-3 text-sm iq-subtle">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border iq-accent-border text-xs iq-accent">{index + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
          </article>
        ))}
      </div>
    </div>
  </PublicShell>
);

export const LeaderboardPage = () => (
  <PublicShell title="Leaderboard">
    <div className={wrap}>
      <h1 className="text-4xl font-semibold" style={{ fontFamily: '"Space Grotesk", Inter, sans-serif' }}>Season preview</h1>
      <p className="mt-3 max-w-2xl iq-muted">A sample board so the shape is clear. Live ranks stay on the learner and instructor accounts, which already score tests.</p>
      <ol className="mt-8 divide-y iq-divide rounded-2xl border iq-line">
        {["Demo Student", "Campus cohort A", "Evening lab"].map((name, index) => (
          <li key={name} className="flex items-center justify-between px-4 py-4 text-sm">
            <span>{index + 1}. {name}</span>
            <span className="font-mono iq-muted">{120 - index * 17} XP</span>
          </li>
        ))}
      </ol>
    </div>
  </PublicShell>
);

export const PricingPage = () => (
  <PublicShell title="Pricing">
    <div className={`${wrap} max-w-2xl`}>
      <article className="rounded-2xl border iq-line p-6">
        <h1 className="text-3xl font-semibold">Learner access</h1>
        <p className="mt-3 iq-muted">Catalogue lessons on this site are free to open. Sign in to keep progress, assignments and scores. Paid lessons inside a course still use the checkout in the course player.</p>
        <Link to="/login" className="mt-6 inline-flex rounded-full iq-accent-bg px-4 py-2 text-sm font-semibold">Open learner login</Link>
      </article>
    </div>
  </PublicShell>
);

export const ContactPage = () => {
  const [sent, setSent] = useState(false);
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") || "");
    const note = String(data.get("note") || "");
    window.location.href = `mailto:contact@iqmath.in?subject=${encodeURIComponent("IQNex: " + name)}&body=${encodeURIComponent(note)}`;
    setSent(true);
  };
  return (
    <PublicShell title="Contact">
      <div className={wrap}>
        <h1 className="text-4xl font-semibold" style={{ fontFamily: '"Space Grotesk", Inter, sans-serif' }}>Contact</h1>
        <p className="mt-3 iq-muted">Email <a className="iq-link" href="mailto:contact@iqmath.in">contact@iqmath.in</a> or WhatsApp <a className="iq-link" href="https://wa.me/919360960219">+91 93609 60219</a>. This form opens your mail app. It does not store the message on a server.</p>
        <form onSubmit={onSubmit} className="mt-8 max-w-lg space-y-3">
          <label className="block text-sm">Name<input required name="name" className="mt-1 w-full rounded-xl border iq-line iq-surface px-3 py-3" /></label>
          <label className="block text-sm">How can we help?<textarea required name="note" rows={5} className="mt-1 w-full rounded-xl border iq-line iq-surface px-3 py-3" /></label>
          <button className="rounded-full iq-ink-btn px-4 py-2 text-sm font-semibold">Write the email</button>
          {sent && <p className="text-sm iq-accent">Your mail app should be open with the message.</p>}
        </form>
      </div>
    </PublicShell>
  );
};

export const DesignPage = () => (
  <PublicShell title="Design system">
    <div className={wrap}>
      <h1 className="text-4xl font-semibold" style={{ fontFamily: '"Space Grotesk", Inter, sans-serif' }}>IQNex tokens</h1>
      <p className="mt-3 max-w-2xl iq-muted">Light from 6:00 AM to 6:00 PM on this device, and dark from 6:00 PM to 6:00 AM. These swatches match the theme on screen now.</p>
      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[["var(--iq-bg)", "Surface"], ["var(--iq-surface)", "Card"], ["var(--iq-accent)", "Action"], ["var(--iq-link)", "Link"], ["var(--iq-text)", "Text"], ["var(--iq-muted)", "Muted"], ["#c2410c", "Warn"], ["#b42318", "Danger"]].map(([color, name]) => (
          <div key={name} className="rounded-2xl border iq-line p-3">
            <div className="h-14 rounded-xl border iq-line" style={{ background: color }} />
            <p className="mt-2 text-sm">{name}</p>
            <p className="font-mono text-xs iq-faint">{color}</p>
          </div>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <button className="rounded-full iq-accent-bg px-4 py-2 text-sm font-semibold">Primary</button>
        <button className="rounded-full border iq-line px-4 py-2 text-sm">Secondary</button>
        <span className="rounded-full iq-track px-3 py-1 text-xs">Badge</span>
      </div>
    </div>
  </PublicShell>
);
