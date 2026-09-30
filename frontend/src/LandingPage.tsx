import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PublicShell from "./public/PublicShell";
import WatchSection from "./public/WatchSection";
import { FAQS } from "./public/catalog";

const sections = [
  {
    id: "events",
    title: "Events",
    text: "Events are scheduled sessions for enrolled learners: live, hybrid, or on site. Dates, seats, and the agenda are published after you sign in. This page does not list them.",
  },
  {
    id: "competitions",
    title: "Competitions",
    text: "A competition is a timed test drawn from what you have studied. The rules, the clock, and the result are part of the learner account. Nothing is posted here in advance.",
  },
  {
    id: "hackathons",
    title: "Hackathons",
    text: "A hackathon is a team build with a brief, a deadline, and a submission. Invites, problem statements, and results open after you sign in.",
  },
];

const LandingPage = () => {
  const [openFaq, setOpenFaq] = useState(0);

  useEffect(() => {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "IQNex",
      description: "A learning account for courses, events, competitions and hackathons.",
    });
    document.head.appendChild(script);
    return () => { script.remove(); };
  }, []);

  return (
    <PublicShell>
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-16">
        <p className="text-sm iq-muted">Sign in to open the schedule. This page explains the account.</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight sm:text-6xl" style={{ fontFamily: '"Space Grotesk", Inter, sans-serif' }}>
          One learner account for study, sessions, and timed work.
        </h1>
        <p className="mt-5 max-w-2xl text-lg iq-subtle">IQNex keeps your courses, events, competitions and hackathons together. Lessons play on YouTube, with the creator named on the lesson. The live list is inside the account.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/login" className="rounded-full iq-accent-bg px-5 py-3 text-sm font-semibold">Sign in</Link>
          <a href="#courses" className="rounded-full border iq-line px-5 py-3 text-sm">See how it is organised</a>
        </div>
      </section>

      <WatchSection />

      <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-8 md:grid-cols-3">
        {sections.map((section) => (
          <article key={section.id} id={section.id} className="scroll-mt-24 rounded-2xl border iq-line iq-surface p-6">
            <h2 className="text-2xl font-semibold" style={{ fontFamily: '"Space Grotesk", Inter, sans-serif' }}>{section.title}</h2>
            <p className="mt-3 text-sm leading-6 iq-muted">{section.text}</p>
          </article>
        ))}
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-3xl font-semibold" style={{ fontFamily: '"Space Grotesk", Inter, sans-serif' }}>What you do inside the account</h2>
        <ol className="mt-8 grid gap-3 md:grid-cols-3">
          {[
            "Sign in and open the course, event, competition or hackathon assigned to you.",
            "Work through the lesson or the brief. Video stays on YouTube.",
            "Your progress, submission and result stay on the account.",
          ].map((step, index) => (
            <li key={step} className="rounded-2xl border iq-line p-4">
              <span className="font-mono text-xs iq-accent">0{index + 1}</span>
              <p className="mt-3 text-sm iq-subtle">{step}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-8">
        <h2 className="text-3xl font-semibold" style={{ fontFamily: '"Space Grotesk", Inter, sans-serif' }}>Questions</h2>
        <div className="mt-8 max-w-3xl divide-y iq-divide rounded-2xl border iq-line">
          {FAQS.map((item, index) => (
            <div key={item.q}>
              <button className="flex w-full items-center justify-between px-4 py-4 text-left text-sm font-semibold" aria-expanded={openFaq === index} onClick={() => setOpenFaq(index)}>{item.q}</button>
              {openFaq === index && <p className="px-4 pb-4 text-sm iq-muted">{item.a}</p>}
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="rounded-3xl border iq-line iq-surface px-6 py-10">
          <h2 className="text-3xl font-semibold" style={{ fontFamily: '"Space Grotesk", Inter, sans-serif' }}>Open your account</h2>
          <p className="mt-2 max-w-xl iq-muted">Courses, events, competitions and hackathons are listed after you sign in.</p>
          <Link to="/login" className="mt-6 inline-flex rounded-full iq-accent-bg px-5 py-3 text-sm font-semibold">Sign in</Link>
        </div>
      </section>
    </PublicShell>
  );
};

export default LandingPage;
