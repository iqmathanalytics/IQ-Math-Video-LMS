import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import BrandLogo from "../components/BrandLogo";
import API_BASE_URL from "../config";
import { useDayTheme } from "../public/useDayTheme";
import { saveSession } from "../utils/session";
import { Field, PasswordMeter, SubmitButton, fieldClass, passwordScore } from "./ui";

const REMEMBER_KEY = "iqnex-remember-email";

type Mode = "signin" | "signup" | "forgot" | "reset";

const emailOk = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
const contactOk = (value: string) => value.replace(/\D/g, "").length >= 10;

const apiMessage = (data: unknown, fallback: string) => {
  if (!data || typeof data !== "object" || !("detail" in data)) return fallback;
  const detail = (data as { detail: unknown }).detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail[0] && typeof detail[0] === "object" && "msg" in detail[0]) {
    return String((detail[0] as { msg: unknown }).msg);
  }
  return fallback;
};

const LearnerAuth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useDayTheme();
  const [searchParams] = useSearchParams();
  const mode: Mode = location.pathname === "/signup" ? "signup" : location.pathname === "/forgot-password" ? "forgot" : location.pathname === "/reset-password" ? "reset" : "signin";

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(() => {
    const state = location.state as { notice?: string } | null;
    return state?.notice || "";
  });
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(!navigator.onLine);
  const [remember, setRemember] = useState(Boolean(localStorage.getItem(REMEMBER_KEY)));
  const [form, setForm] = useState({
    name: "",
    email: localStorage.getItem(REMEMBER_KEY) || "",
    contact: "",
    password: "",
    confirm: "",
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
    if (mode !== "signin") setNotice("");
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
      else if (err.response.status === 401) setError("That email and password do not match an account. Create an account, or check both fields.");
      else setError(apiMessage(err.response.data, "Those details were not accepted."));
    } finally {
      setBusy(false);
    }
  };

  const createAccount = async () => {
    const next: Record<string, string> = {};
    if (form.name.trim().length < 2) next.name = "Enter your name.";
    if (!emailOk(form.email)) next.email = "Enter a valid email.";
    if (!contactOk(form.contact)) next.contact = "Enter a contact number with at least 10 digits.";
    if (passwordScore(form.password) < 3) next.password = "Use 8 or more characters, mixed case, and a number.";
    if (form.confirm !== form.password) next.confirm = "Passwords do not match.";
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
        phone_number: form.contact.trim(),
      });
      localStorage.setItem(REMEMBER_KEY, form.email.trim());
      navigate("/login", { state: { notice: "Account created. Sign in with that email and password." } });
    } catch (err: unknown) {
      if (!axios.isAxiosError(err) || !err.response) setError("The learner service is not reachable. Nothing was saved.");
      else setError(apiMessage(err.response.data, "The account could not be created."));
    } finally {
      setBusy(false);
    }
  };

  const requestReset = async (event: FormEvent) => {
    event.preventDefault();
    if (!emailOk(form.email)) { setErrors({ email: "Enter the email on your learner account." }); return; }
    setBusy(true);
    setError("");
    try {
      const res = await axios.post(`${API_BASE_URL}/forgot-password`, { email: form.email.trim() });
      setNotice(res.data?.message || "If that email has an account, a reset link is on its way.");
    } catch (err: unknown) {
      const detail = axios.isAxiosError(err) ? err.response?.data?.detail : "";
      setError(typeof detail === "string" ? detail : "The reset email could not be sent.");
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async (event: FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (passwordScore(form.password) < 3) next.password = "Use 8 or more characters, mixed case, and a number.";
    if (form.confirm !== form.password) next.confirm = "Passwords do not match.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    setError("");
    try {
      await axios.post(`${API_BASE_URL}/reset-password`, { token: searchParams.get("token") || "", new_password: form.password });
      navigate("/login", { state: { notice: "Password updated. Sign in with the new password." } });
    } catch (err: unknown) {
      const detail = axios.isAxiosError(err) ? err.response?.data?.detail : "";
      setError(typeof detail === "string" ? detail : "This reset link is invalid or has expired.");
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
            ["My learning", "Pick up a course where you left it."],
            ["Certificates", "Download a certificate after the course is complete."],
          ].map(([title, text]) => (
            <li key={title} className="rounded-2xl border iq-line iq-surface p-4">
              <p className="font-semibold">{title}</p>
              <p className="mt-1 text-sm iq-muted">{text}</p>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-sm iq-muted">Lessons stay on IQNex. Your account keeps progress after you sign in.</p>
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
              <form className="mt-8 space-y-4" onSubmit={(event) => { event.preventDefault(); void createAccount(); }} noValidate>
                <h1 className="text-3xl font-semibold" style={{ fontFamily: '"Space Grotesk", Inter, sans-serif' }}>Create a learner account</h1>
                <p className="text-sm iq-muted">Name, email, contact, and password are all this page needs.</p>
                <Field label="Name" error={errors.name}>
                  <input className={fieldClass} value={form.name} onChange={(event) => set("name", event.target.value)} autoComplete="name" />
                </Field>
                <Field label="Mail" error={errors.email}>
                  <input className={fieldClass} type="email" value={form.email} onChange={(event) => set("email", event.target.value)} autoComplete="email" />
                </Field>
                <Field label="Contact" error={errors.contact}>
                  <input className={fieldClass} type="tel" value={form.contact} onChange={(event) => set("contact", event.target.value)} autoComplete="tel" placeholder="10-digit mobile number" />
                </Field>
                <Field label="Password" error={errors.password}>
                  <input className={fieldClass} type="password" value={form.password} onChange={(event) => set("password", event.target.value)} autoComplete="new-password" />
                  <PasswordMeter password={form.password} />
                </Field>
                <Field label="Confirm password" error={errors.confirm}>
                  <input className={fieldClass} type="password" value={form.confirm} onChange={(event) => set("confirm", event.target.value)} autoComplete="new-password" />
                </Field>
                <SubmitButton busy={busy}>Create account</SubmitButton>
                <p className="text-sm iq-muted">Already enrolled? <Link className="iq-link" to="/login">Sign in</Link></p>
              </form>
            )}

            {mode === "forgot" && (
              <form className="mt-8 space-y-4" onSubmit={requestReset} noValidate>
                <h1 className="text-3xl font-semibold" style={{ fontFamily: '"Space Grotesk", Inter, sans-serif' }}>Reset your password</h1>
                <p className="text-sm iq-muted">We email a link that works for 30 minutes. An instructor can also reset a password from the student list.</p>
                <Field label="Email" error={errors.email}>
                  <input className={fieldClass} type="email" value={form.email} onChange={(event) => set("email", event.target.value)} autoComplete="email" />
                </Field>
                <SubmitButton busy={busy}>Send reset link</SubmitButton>
                <Link to="/login" className="inline-flex text-sm iq-link">Back to sign in</Link>
              </form>
            )}

            {mode === "reset" && (
              <form className="mt-8 space-y-4" onSubmit={resetPassword} noValidate>
                <h1 className="text-3xl font-semibold" style={{ fontFamily: '"Space Grotesk", Inter, sans-serif' }}>Choose a new password</h1>
                <Field label="New password" error={errors.password}>
                  <input className={fieldClass} type="password" value={form.password} onChange={(event) => set("password", event.target.value)} autoComplete="new-password" />
                  <PasswordMeter password={form.password} />
                </Field>
                <Field label="Confirm password" error={errors.confirm}>
                  <input className={fieldClass} type="password" value={form.confirm} onChange={(event) => set("confirm", event.target.value)} autoComplete="new-password" />
                </Field>
                <SubmitButton busy={busy}>Update password</SubmitButton>
              </form>
            )}
          </div>
        </main>
        {panel}
      </div>
    </div>
  );
};

export default LearnerAuth;
