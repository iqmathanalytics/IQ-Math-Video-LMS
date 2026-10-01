import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import PublicShell from "./public/PublicShell";
import { FAQS } from "./public/catalog";
import API_BASE_URL from "./config";

const heading = { fontFamily: '"Space Grotesk", Inter, sans-serif' };

const programmes = [
  {
    title: "Analytics",
    text: "Excel, SQL, statistics, and Power BI as one sequence: clean the data, answer the question, and show it on a dashboard.",
  },
  {
    title: "Programming practice",
    text: "Java and SQL problem sets worked inside the course, so the next exercise sits with the lesson that prepared it.",
  },
  {
    title: "Applied AI",
    text: "Generative AI and agent workflows for business use, from a clear prompt through a tool to a result you can explain.",
  },
  {
    title: "Security practice",
    text: "Ethical hacking taught in order: reconnaissance, web security, and a written report, not a loose list of tools.",
  },
];

const account = [
  { title: "Lessons in order", text: "Each course is split into sections and topics. You continue from the last lesson you opened." },
  { title: "Notes beside the video", text: "Write what you want to remember while the lesson plays. Notes are saved on your account." },
  { title: "Assessments", text: "Upload a file or paste a project link. The submission is saved on your account." },
  { title: "Certificates", text: "Finish every lesson and submit the assessment. The certificate can then be downloaded." },
];

const LandingPage = () => {
  const [openFaq, setOpenFaq] = useState(0);
  const [schoolCourses, setSchoolCourses] = useState<{ id: number; title: string; description: string; price: number }[]>([]);

  useEffect(() => {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "EducationalOrganization",
      name: "IQNex",
      description: "IQ Math learner platform for analytics, programming, and applied AI courses.",
      email: "contact@iqmath.in",
      telephone: "+91-93609-60219",
    });
    document.head.appendChild(script);
    axios.get(`${API_BASE_URL}/public/courses`).then((res) => {
      setSchoolCourses(Array.isArray(res.data) ? res.data : []);
    }).catch(() => setSchoolCourses([]));
    return () => { script.remove(); };
  }, []);

  return (
    <PublicShell title="IQ Math">
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-16">
        <p className="text-sm font-medium iq-accent">IQ Math · Learner platform</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight sm:text-6xl" style={heading}>
          Courses with a place to continue, practise, and finish.
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed iq-subtle">
          IQNex is where IQ Math students open their courses. Lessons play on the account, notes sit beside the video, and a certificate follows the assessment you submit.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/login" className="rounded-full iq-accent-bg px-5 py-3 text-sm font-semibold">Sign in</Link>
          <Link to="/contact" className="rounded-full border iq-line px-5 py-3 text-sm font-semibold">Talk to the school</Link>
        </div>
        <dl className="mt-12 grid gap-4 sm:grid-cols-3">
          {[
            ["After sign-in", "Your enrolled courses, progress, and the next lesson."],
            ["In the lesson", "Video on IQNex, with notes on the side."],
            ["When you finish", "An assessment, then the certificate for that course."],
          ].map(([label, text]) => (
            <div key={label} className="rounded-2xl border iq-line p-4">
              <dt className="text-sm font-semibold">{label}</dt>
              <dd className="mt-2 text-sm leading-relaxed iq-muted">{text}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <p className="text-xs uppercase tracking-[0.16em] iq-faint">Published courses</p>
        <h2 className="mt-3 text-3xl font-semibold" style={heading}>Courses on this school account</h2>
        <p className="mt-3 max-w-2xl text-sm iq-muted">These are the published courses. Sign in to enrol, continue a lesson, and keep progress.</p>
        {schoolCourses.length === 0 && <p className="mt-6 text-sm iq-muted">No published courses yet.</p>}
        <ul className="mt-6 grid gap-4 md:grid-cols-2">
          {schoolCourses.map((course) => (
            <li key={course.id} className="rounded-2xl border iq-line p-5">
              <p className="text-xs uppercase tracking-[0.14em] iq-faint">{Number(course.price) > 0 ? `₹${course.price}` : "Free"}</p>
              <h3 className="mt-2 text-xl font-semibold">{course.title}</h3>
              <p className="mt-2 text-sm iq-muted">{course.description}</p>
              <Link to="/login" className="mt-4 inline-block text-sm iq-link">Sign in to enrol</Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-y iq-line">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <p className="text-xs uppercase tracking-[0.16em] iq-faint">Programmes</p>
          <h2 className="mt-3 max-w-2xl text-3xl font-semibold" style={heading}>What the courses are built around</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed iq-muted">These are the subjects taught on the account. The live list, prices, and your enrolment appear after you sign in.</p>
          <ul className="mt-8 grid gap-4 md:grid-cols-2">
            {programmes.map((item) => (
              <li key={item.title} className="rounded-2xl border iq-line iq-surface p-5">
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed iq-muted">{item.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] iq-faint">How a course runs</p>
            <h2 className="mt-3 text-3xl font-semibold" style={heading}>Three steps, then the work is on your account</h2>
          </div>
          <ol className="space-y-4">
            {[
              ["Sign in", "Open the learner account with the email you used to enrol. Admin staff use a separate sign-in."],
              ["Work the lesson", "Follow the section, play the lesson on IQNex, and write notes while it is on screen."],
              ["Submit and finish", "Send the assessment file or project link. The certificate is issued after that submission is saved."],
            ].map(([title, text], index) => (
              <li key={title} className="flex gap-4 rounded-2xl border iq-line p-4">
                <span className="font-mono text-sm iq-accent">0{index + 1}</span>
                <div>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed iq-muted">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <h2 className="text-3xl font-semibold" style={heading}>Inside the learner account</h2>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {account.map((item) => (
            <li key={item.title} className="rounded-2xl border iq-line p-5">
              <h3 className="font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed iq-muted">{item.text}</p>
            </li>
          ))}
        </ul>
        <p className="mt-6 max-w-2xl text-sm iq-muted">Paid courses use Razorpay. You can pay with UPI, a card, netbanking, or a wallet. Free courses enrol without a payment.</p>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-8">
        <h2 className="text-3xl font-semibold" style={heading}>Questions</h2>
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

      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="rounded-3xl border iq-line iq-surface px-6 py-10 sm:px-10">
          <h2 className="max-w-xl text-3xl font-semibold" style={heading}>Open the account and pick up the next lesson.</h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed iq-muted">Courses, progress, and certificates are on the account after sign-in. For a new enrolment, write to the school and include the course you want.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/login" className="rounded-full iq-accent-bg px-5 py-3 text-sm font-semibold">Sign in</Link>
            <a href="mailto:contact@iqmath.in" className="rounded-full border iq-line px-5 py-3 text-sm font-semibold">contact@iqmath.in</a>
          </div>
        </div>
      </section>
    </PublicShell>
  );
};

export default LandingPage;
