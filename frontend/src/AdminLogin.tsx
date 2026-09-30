import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import BrandLogo from "./components/BrandLogo";
import API_BASE_URL from "./config";
import { Field, SubmitButton, fieldClass } from "./learner/ui";
import { useDayTheme } from "./public/useDayTheme";
import { saveSession } from "./utils/session";

const REMEMBER_KEY = "iqnex-admin-email";
const emailOk = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const AdminLogin = () => {
  const navigate = useNavigate();
  const theme = useDayTheme();
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [error, setError] = useState("");
  const [remember, setRemember] = useState(Boolean(localStorage.getItem(REMEMBER_KEY)));
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: localStorage.getItem(REMEMBER_KEY) || "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => { meta.remove(); };
  }, []);

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

  const signIn = async (event: FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!emailOk(form.email)) next.email = "Enter the admin email for this site.";
    if (!form.password) next.password = "Enter the admin password.";
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
      if (res.data.role !== "instructor") {
        setError("This sign-in is for the admin account. Learners use the learner sign-in.");
        return;
      }
      saveSession(res.data.access_token, res.data.role);
      navigate("/dashboard/courses");
    } catch (err: unknown) {
      if (!axios.isAxiosError(err) || !err.response) setError("The site service is not reachable. Check that the API is running, then try again.");
      else setError(typeof err.response.data?.detail === "string" ? err.response.data.detail : "Those details were not accepted.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-theme={theme} className="iq-page min-h-screen" style={{ fontFamily: "Inter, sans-serif" }}>
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col lg:flex-row">
        <main className="flex flex-1 items-center px-4 py-10">
          <div className="w-full max-w-md">
            <Link to="/" aria-label="IQNex home"><BrandLogo tone={theme === "dark" ? "onDark" : "ink"} size="sm" /></Link>
            {offline && <p className="mt-4 rounded-xl border iq-line px-3 py-2 text-sm">You appear to be offline. Sign-in needs a connection.</p>}
            {error && <p className="mt-4 rounded-xl border border-[#b42318] px-3 py-2 text-sm" role="alert">{error}</p>}
            <form className="mt-8 space-y-4" onSubmit={signIn} noValidate>
              <p className="text-xs uppercase tracking-[0.16em] iq-faint">Admin</p>
              <h1 className="text-3xl font-semibold" style={{ fontFamily: '"Space Grotesk", Inter, sans-serif' }}>Sign in to manage IQNex</h1>
              <p className="text-sm iq-muted">Use the admin email and password. This page is not linked from the public site.</p>
              <Field label="Email" error={errors.email}>
                <input className={fieldClass} type="email" autoComplete="username" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
              </Field>
              <Field label="Password" error={errors.password}>
                <div className="relative">
                  <input className={fieldClass} type={showPassword ? "text" : "password"} autoComplete="current-password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-xs iq-muted" onClick={() => setShowPassword((value) => !value)}>{showPassword ? "Hide" : "Show"}</button>
                </div>
              </Field>
              <label className="flex items-center gap-2 text-sm iq-subtle">
                <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
                Remember this email on this device
              </label>
              <SubmitButton busy={busy}>Sign in</SubmitButton>
              <p className="text-sm iq-muted">
                <Link className="iq-link" to="/">Back to the site</Link>
                <span className="px-2">·</span>
                <Link className="iq-link" to="/login">Learner sign-in</Link>
              </p>
            </form>
          </div>
        </main>
        <aside className="hidden lg:flex lg:w-1/2 flex-col justify-between iq-inset p-10 border-l iq-line">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] iq-faint">After you sign in</p>
            <ul className="mt-6 space-y-4">
              {[
                ["Uploaded courses", "Every course already on this site, with its thumbnail, price, and lessons."],
                ["Publish", "Show a course to learners, or hide it until it is ready."],
                ["Lessons", "Open a course to edit modules and the YouTube links inside them."],
              ].map(([title, text]) => (
                <li key={title} className="rounded-2xl border iq-line iq-surface p-4">
                  <p className="font-semibold">{title}</p>
                  <p className="mt-1 text-sm iq-muted">{text}</p>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-sm iq-muted">Questions about this console go to contact@iqmath.in.</p>
        </aside>
      </div>
    </div>
  );
};

export default AdminLogin;
