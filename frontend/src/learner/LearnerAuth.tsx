import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import BrandLogo from "../components/BrandLogo";
import API_BASE_URL from "../config";
import { TOPICS } from "../public/catalog";
import { useDayTheme } from "../public/useDayTheme";
import { saveSession } from "../utils/session";
import { Field, PasswordMeter, SubmitButton, fieldClass, passwordScore } from "./ui";

const REMEMBER_KEY = "iqnex-remember-email";
const GOALS_KEY = "iqnex-learner-goals";

type Mode = "signin" | "signup" | "forgot";

const emailOk = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const LearnerAuth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useDayTheme();
  const mode: Mode = location.pathname === "/signup" ? "signup" : location.pathname === "/forgot-password" ? "forgot" : "signin";

  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(!navigator.onLine);
  const [remember, setRemember] = useState(Boolean(localStorage.getItem(REMEMBER_KEY)));
  const [form, setForm] = useState({
    name: "",
    email: localStorage.getItem(REMEMBER_KEY) || "",
    password: "",
    topic: "AI",
    level: "Beginner",
    hours: "4",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    setError("");
    setNotice("");
    setStep(1);
  }, [mode]);

  const set = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const signIn = async (event: FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!emailOk(form.email)) next.email = "Enter the email on your learner account.";
    if (!form.password) next.password = "Enter your password.";
    setErrors(next);
    if (Object.keys(next).length) return;
    if (remember) localStorage.setItem(REMEMBER_KEY, form.email.trim());
    else localStorage.removeItem(REMEMBER_KEY);

    setBusy(true);
    setError("");
    try {
      const body = new URLSearchParams();
      body.append("username", form.email.trim());
      body.append("password", form.password);
      const res = await axios.post(`${API_BASE_URL}/login`, body);
      if (res.data.role !== "student") {
        setError("This sign-in is for learners. Instructors use the instructor portal.");
        return;
      }
      saveSession(res.data.access_token, res.data.role);
      navigate("/home");
    } catch (err: unknown) {
      if (!axios.isAxiosError(err) || !err.response) setError("The learner service is not reachable. Check that the API is running, then try again.");
      else setError(typeof err.response.data?.detail === "string" ? err.response.data.detail : "Those details were not accepted.");
    } finally {
      setBusy(false);
    }
  };

  const createAccount = async () => {
    const next: Record<string, string> = {};
    if (form.name.trim().length < 2) next.name = "Enter the name you want on your learning record.";
    if (!emailOk(form.email)) next.email = "Enter a valid email.";
    if (passwordScore(form.password) < 3) next.password = "Use 8 or more characters, mixed case, and a number.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    setError("");
    try {
      await axios.post(`${API_BASE_URL}/users`, {
        email: form.email.trim(),
        password: form.password,
        name: form.name.trim(),
        role: "student",
        phone_number: null,
      });
      localStorage.setItem(GOALS_KEY, JSON.stringify({
        topic: form.topic,
        level: form.level,
        hours: Number(form.hours),
      }));
      setNotice("Account created. Sign in with that email and password.");
      setForm((current) => ({ ...current, password: "" }));
      navigate("/login");
    } catch (err: unknown) {
      if (!axios.isAxiosError(err) || !err.response) setError("The learner service is not reachable. Nothing was saved.");
      else setError(typeof err.response.data?.detail === "string" ? err.response.data.detail : "The account could not be created.");
    } finally {
      setBusy(false);
    }
  };

  const panel = (
    <aside className="hidden lg:flex lg:w-1/2 flex-col justify-between iq-inset p-10 border-l iq-line">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] iq-faint">Inside the account</p>
        <ul className="mt-6 space-y-4">
          {[
            ["Courses", "Lessons in order, with progress saved on your account."],
            ["Events", "Dates and agendas appear after you sign in."],
            ["Competitions", "Timed work and results stay in the account."],
            ["Hackathons", "Team briefs and submissions open after you sign in."],
          ].map(([title, text]) => (
            <li key={title} className="rounded-2xl border iq-line iq-surface p-4">
              <p className="font-semibold">{title}</p>
              <p className="mt-1 text-sm iq-muted">{text}</p>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-sm iq-muted">Lessons stay on YouTube. Your account keeps progress after you sign in.</p>
    </aside>
  );

  return (
    <div data-theme={theme} className="iq-page min-h-screen" style={{ fontFamily: "Inter, sans-serif" }}>
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col lg:flex-row">
        <main className="flex flex-1 items-center px-4 py-10">
          <div className="w-full max-w-md">
            <Link to="/" aria-label="IQNex home"><BrandLogo tone={theme === "dark" ? "onDark" : "ink"} size="sm" /></Link>
            {offline && <p className="mt-4 rounded-xl border iq-line px-3 py-2 text-sm">You appear to be offline. Sign-in needs a connection.</p>}
            {error && <p className="mt-4 rounded-xl border border-[#b42318] px-3 py-2 text-sm" role="alert">{error}</p>}
            {notice && <p className="mt-4 rounded-xl border iq-line px-3 py-2 text-sm iq-accent" role="status">{notice}</p>}

            {mode === "signin" && (
              <form className="mt-8 space-y-4" onSubmit={signIn} noValidate>
                <h1 className="text-3xl font-semibold" style={{ fontFamily: '"Space Grotesk", Inter, sans-serif' }}>Learner sign in</h1>
                <p className="text-sm iq-muted">Use the email and password on your learner account.</p>
                <Field label="Email" error={errors.email}>
                  <input className={fieldClass} type="email" autoComplete="username" value={form.email} onChange={(event) => set("email", event.target.value)} />
                </Field>
                <Field label="Password" error={errors.password}>
                  <input className={fieldClass} type="password" autoComplete="current-password" value={form.password} onChange={(event) => set("password", event.target.value)} />
                </Field>
                <label className="flex items-center gap-2 text-sm iq-subtle">
                  <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
                  Remember this email on this device
                </label>
                <SubmitButton busy={busy}>Sign in</SubmitButton>
                <p className="text-sm iq-muted">
                  New here? <Link className="iq-link" to="/signup">Create a learner account</Link>
                  <span className="px-2">·</span>
                  <Link className="iq-link" to="/forgot-password">Forgot password</Link>
                </p>
              </form>
            )}

            {mode === "signup" && (
              <form className="mt-8 space-y-4" onSubmit={(event) => {
              event.preventDefault();
              if (step === 1) {
                const next: Record<string, string> = {};
                if (form.name.trim().length < 2) next.name = "Enter the name you want on your learning record.";
                if (!emailOk(form.email)) next.email = "Enter a valid email.";
                if (passwordScore(form.password) < 3) next.password = "Use 8 or more characters, mixed case, and a number.";
                setErrors(next);
                if (Object.keys(next).length) return;
                setStep(2);
                return;
              }
              if (step === 2) { setStep(3); return; }
              void createAccount();
            }} noValidate>
                <h1 className="text-3xl font-semibold" style={{ fontFamily: '"Space Grotesk", Inter, sans-serif' }}>Create a learner account</h1>
                <p className="text-sm iq-muted">Step {step} of 3. This stays on your device until the account is created.</p>
                {step === 1 && (
                  <>
                    <Field label="Name" error={errors.name}>
                      <input className={fieldClass} value={form.name} onChange={(event) => set("name", event.target.value)} autoComplete="name" />
                    </Field>
                    <Field label="Email" error={errors.email}>
                      <input className={fieldClass} type="email" value={form.email} onChange={(event) => set("email", event.target.value)} autoComplete="email" />
                    </Field>
                    <Field label="Password" error={errors.password}>
                      <input className={fieldClass} type="password" value={form.password} onChange={(event) => set("password", event.target.value)} autoComplete="new-password" />
                      <PasswordMeter password={form.password} />
                    </Field>
                  </>
                )}
                {step === 2 && (
                  <>
                    <Field label="What do you want to learn first?">
                      <select className={fieldClass} value={form.topic} onChange={(event) => set("topic", event.target.value)}>
                        {TOPICS.filter((topic) => topic !== "All").map((topic) => <option key={topic}>{topic}</option>)}
                      </select>
                    </Field>
                    <Field label="Current level">
                      <select className={fieldClass} value={form.level} onChange={(event) => set("level", event.target.value)}>
                        <option>Beginner</option>
                        <option>Intermediate</option>
                        <option>Advanced</option>
                      </select>
                    </Field>
                  </>
                )}
                {step === 3 && (
                  <Field label="Hours you can study in a week">
                    <select className={fieldClass} value={form.hours} onChange={(event) => set("hours", event.target.value)}>
                      <option value="2">About 2</option>
                      <option value="4">About 4</option>
                      <option value="8">About 8</option>
                    </select>
                  </Field>
                )}
                <div className="flex gap-2">
                  {step > 1 && <button type="button" className="rounded-full border iq-line px-4 py-3 text-sm" onClick={() => setStep(step - 1)}>Back</button>}
                  <SubmitButton busy={busy}>{step === 3 ? "Create account" : "Continue"}</SubmitButton>
                </div>
                <p className="text-sm iq-muted">Already enrolled? <Link className="iq-link" to="/login">Sign in</Link></p>
              </form>
            )}

            {mode === "forgot" && (
              <div className="mt-8 space-y-4">
                <h1 className="text-3xl font-semibold" style={{ fontFamily: '"Space Grotesk", Inter, sans-serif' }}>Password help</h1>
                <p className="text-sm iq-muted">This learner app does not email a reset link. An instructor resets a password from the student list, or you sign in with the password you chose when the account was created.</p>
                <Link to="/login" className="inline-flex rounded-full iq-accent-bg px-4 py-3 text-sm font-semibold">Back to sign in</Link>
              </div>
            )}
          </div>
        </main>
        {panel}
      </div>
    </div>
  );
};

export default LearnerAuth;
