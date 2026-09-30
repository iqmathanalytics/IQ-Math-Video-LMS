import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import API_BASE_URL from "../config";
import { getValidSession } from "../utils/session";
import CourseFacts from "../components/CourseFacts";
import CourseCover from "../components/CourseCover";

const headers = () => {
  const session = getValidSession();
  return session?.token ? { Authorization: `Bearer ${session.token}` } : {};
};

type Mine = { id: number; title: string; description: string; has_certificate?: boolean; price?: number; image_url?: string | null; lessons_total?: number; lessons_done?: number };
type CatalogCourse = { id: number; title: string; description: string; price: number; image_url?: string | null; is_published?: boolean; language?: string | null; course_type?: string };
type Profile = { id: number; full_name: string; email: string; phone_number?: string | null };
type Notice = { id: number; title: string; message: string; is_read: boolean };

const downloadCertificate = async (courseId: number, title: string) => {
  const claim = await axios.post(`${API_BASE_URL}/courses/${courseId}/claim-certificate`, {}, { headers: headers() });
  if (claim.data?.status === "error") throw new Error(claim.data.message || "The certificate is not ready.");
  const pdf = await axios.get(`${API_BASE_URL}/generate-pdf/${courseId}`, { headers: headers(), responseType: "blob" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(pdf.data);
  link.download = `${title.replace(/\s+/g, "_")}_Certificate.pdf`;
  link.click();
};

export const StudentHome = () => {
  const [name, setName] = useState("Student");
  const [courses, setCourses] = useState<Mine[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    Promise.all([
      axios.get(`${API_BASE_URL}/users/me`, { headers: headers() }),
      axios.get(`${API_BASE_URL}/my-courses`, { headers: headers() }),
      axios.get(`${API_BASE_URL}/notifications`, { headers: headers() }).catch(() => ({ data: [] })),
    ]).then(([me, mine, notes]) => {
      setName(me.data.full_name || "Student");
      setCourses(Array.isArray(mine.data) ? mine.data : []);
      setNotices(Array.isArray(notes.data) ? notes.data : []);
      setStatus("ready");
    }).catch(() => setStatus("error"));
  }, []);

  const next = courses[0];
  const certificates = courses.filter((course) => course.has_certificate).length;

  return (
    <div>
      <h1 className="text-3xl font-semibold" style={{ fontFamily: '"Space Grotesk", Inter, sans-serif' }}>Welcome back, {name}</h1>
      <p className="mt-2 max-w-2xl text-sm iq-muted">Continue a course or pick up a certificate.</p>
      <div className="mt-4 flex flex-wrap gap-3 text-sm lg:hidden">
        <Link className="iq-link" to="/certificates">Certificates</Link>
      </div>
      {status === "loading" && <p className="mt-6 text-sm iq-muted">Loading your account…</p>}
      {status === "error" && <p className="mt-6 text-sm iq-muted">The account could not be loaded. Refresh after you are signed in.</p>}
      {status === "ready" && (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border iq-line p-4"><p className="text-sm iq-muted">Courses in progress</p><p className="mt-1 text-3xl font-semibold tabular-nums">{courses.length}</p></div>
            <div className="rounded-2xl border iq-line p-4"><p className="text-sm iq-muted">Certificates issued</p><p className="mt-1 text-3xl font-semibold tabular-nums">{certificates}</p></div>
          </div>
          <section className="mt-6 rounded-2xl border iq-line p-5">
            <h2 className="text-lg font-semibold">Continue learning</h2>
            {next ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  <div className="w-36 shrink-0"><CourseCover title={next.title} imageUrl={next.image_url} /></div>
                  <div className="min-w-0">
                    <p className="font-semibold">{next.title}</p>
                    <CourseFacts description={next.description} />
                  </div>
                </div>
                <Link to={`/my-courses/${next.id}`} className="rounded-full iq-accent-bg px-4 py-2 text-sm font-semibold">Open course</Link>
              </div>
            ) : <p className="mt-3 text-sm iq-muted">You are not enrolled yet. Browse the course catalogue.</p>}
          </section>
          <section className="mt-4 rounded-2xl border iq-line p-5">
            <h2 className="text-lg font-semibold">Notices</h2>
            {notices.length === 0 && <p className="mt-2 text-sm iq-muted">No messages yet.</p>}
            <ul className="mt-3 space-y-2 text-sm">
              {notices.slice(0, 5).map((notice) => (
                <li key={notice.id}><span className="font-semibold">{notice.title}</span> <span className="iq-muted">{notice.message}</span></li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
};

export const CourseCatalog = () => {
  const [courses, setCourses] = useState<CatalogCourse[]>([]);
  const [enrolled, setEnrolled] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("All");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState(0);

  useEffect(() => {
    Promise.all([
      axios.get(`${API_BASE_URL}/courses`, { headers: headers() }),
      axios.get(`${API_BASE_URL}/my-courses`, { headers: headers() }),
    ]).then(([catalog, mine]) => {
      setCourses(Array.isArray(catalog.data) ? catalog.data : []);
      setEnrolled(new Set((Array.isArray(mine.data) ? mine.data : []).map((row: Mine) => row.id)));
      setStatus("ready");
    }).catch(() => setStatus("error"));
  }, []);

  const shown = useMemo(() => courses.filter((course) => {
    const text = `${course.title} ${course.description || ""}`.toLowerCase();
    if (query.trim() && !text.includes(query.trim().toLowerCase())) return false;
    if (level === "Free" && Number(course.price) > 0) return false;
    if (level === "Paid" && Number(course.price) === 0) return false;
    return true;
  }), [courses, query, level]);

  const loadRazorpay = () => new Promise<boolean>((resolve) => {
    if ((window as Window & { Razorpay?: unknown }).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

  const markEnrolled = (course: CatalogCourse) => {
    setEnrolled((current) => new Set(current).add(course.id));
    setMessage(`You are enrolled in ${course.title}. Open it from My learning.`);
  };

  const enroll = async (course: CatalogCourse) => {
    setMessage("");
    setBusyId(course.id);
    try {
      if (Number(course.price) <= 0) {
        await axios.post(`${API_BASE_URL}/enroll/${course.id}`, { type: "paid" }, { headers: headers() });
        markEnrolled(course);
        return;
      }
      const loaded = await loadRazorpay();
      const razorpayKey = import.meta.env.VITE_RAZORPAY_KEY_ID;
      if (!loaded || !razorpayKey || String(razorpayKey).includes("replace_me")) {
        setMessage("Razorpay checkout is not available. Set VITE_RAZORPAY_KEY_ID and refresh.");
        return;
      }
      const order = await axios.post(`${API_BASE_URL}/create-order`, { course_id: course.id }, { headers: headers() });
      const RazorpayCheckout = (window as Window & { Razorpay: new (options: object) => { open: () => void } }).Razorpay;
      const checkout = new RazorpayCheckout({
        key: razorpayKey,
        amount: order.data.amount,
        currency: order.data.currency,
        name: "IQ Math",
        description: course.title,
        order_id: order.data.id,
        theme: { color: "#005EB8" },
        handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          await axios.post(`${API_BASE_URL}/payment/verify`, {
            course_id: course.id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_signature: response.razorpay_signature,
          }, { headers: headers() });
          markEnrolled(course);
        },
      });
      checkout.open();
      setMessage(`Razorpay checkout is open for ${course.title}.`);
    } catch (err: unknown) {
      const detail = axios.isAxiosError(err) ? err.response?.data?.detail : "";
      setMessage(typeof detail === "string" && detail ? detail : "Checkout did not start. Try again.");
    } finally {
      setBusyId(0);
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-semibold">Courses</h1>
      <p className="mt-2 max-w-2xl text-sm iq-muted">Published courses from your school. Enrolment is saved on your account and shows up under My learning.</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search courses" className="w-full max-w-sm rounded-xl border iq-line iq-surface px-3 py-3 text-sm" />
        <select value={level} onChange={(event) => setLevel(event.target.value)} className="rounded-xl border iq-line iq-surface px-3 py-3 text-sm" aria-label="Price">
          <option>All</option>
          <option>Free</option>
          <option>Paid</option>
        </select>
      </div>
      {status === "loading" && <p className="mt-6 text-sm iq-muted">Loading the catalogue…</p>}
      {status === "error" && <p className="mt-6 text-sm iq-muted">The catalogue could not be loaded.</p>}
      {status === "ready" && shown.length === 0 && <p className="mt-6 rounded-2xl border iq-line p-5 text-sm iq-muted">No published courses match those filters.</p>}
      <ul className="mt-6 grid gap-4 md:grid-cols-2">
        {shown.map((course) => (
          <li key={course.id} className="rounded-2xl border iq-line p-5">
            <CourseCover title={course.title} imageUrl={course.image_url} />
            <p className="mt-3 text-xs uppercase tracking-[0.14em] iq-faint">{Number(course.price) > 0 ? `₹${course.price}` : "Free"} · {course.language || course.course_type || "Course"}</p>
            <h2 className="mt-2 text-xl font-semibold">{course.title}</h2>
            <CourseFacts description={course.description} />
            <div className="mt-4 flex flex-wrap gap-2">
              {enrolled.has(course.id) ? <Link to={`/my-courses/${course.id}`} className="rounded-full iq-accent-bg px-4 py-2 text-sm font-semibold">Continue</Link> : <button type="button" disabled={busyId === course.id} onClick={() => enroll(course)} className="rounded-full iq-accent-bg px-4 py-2 text-sm font-semibold disabled:opacity-50">{busyId === course.id ? "Opening checkout…" : Number(course.price) > 0 ? `Pay ₹${course.price}` : "Enrol free"}</button>}
            </div>
          </li>
        ))}
      </ul>
      {message && <p className="mt-4 text-sm iq-muted">{message}</p>}
    </div>
  );
};

export const CertificateGallery = () => {
  const [courses, setCourses] = useState<Mine[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(0);

  useEffect(() => {
    axios.get(`${API_BASE_URL}/my-courses`, { headers: headers() })
      .then((res) => { setCourses(Array.isArray(res.data) ? res.data : []); setStatus("ready"); })
      .catch(() => setStatus("error"));
  }, []);

  const download = async (course: Mine) => {
    setBusy(course.id);
    setMessage("");
    try {
      await downloadCertificate(course.id, course.title);
      setCourses((rows) => rows.map((row) => row.id === course.id ? { ...row, has_certificate: true } : row));
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Submit the assessments before downloading.");
    } finally {
      setBusy(0);
    }
  };

  const earned = courses.filter((course) => course.has_certificate);
  const locked = courses.filter((course) => !course.has_certificate);

  return (
    <div>
      <h1 className="text-3xl font-semibold">Certificates</h1>
      <p className="mt-2 max-w-2xl text-sm iq-muted">A certificate is created on this site after you submit the assessments for that course. Download saves the PDF to this device.</p>
      {status === "loading" && <p className="mt-6 text-sm iq-muted">Loading certificates…</p>}
      {status === "error" && <p className="mt-6 text-sm iq-muted">Certificates could not be loaded.</p>}
      {status === "ready" && earned.length === 0 && locked.length === 0 && <p className="mt-6 rounded-2xl border iq-line p-5 text-sm iq-muted">Enrol in a course first. The certificate unlocks after the assessments are submitted.</p>}
      {earned.length > 0 && (
        <ul className="mt-6 grid gap-4 md:grid-cols-2">
          {earned.map((course) => (
            <li key={course.id} className="rounded-2xl border iq-line p-5">
              <p className="text-xs uppercase tracking-[0.14em] iq-faint">Issued</p>
              <h2 className="mt-2 text-xl font-semibold">{course.title}</h2>
              <button type="button" disabled={busy === course.id} onClick={() => download(course)} className="mt-4 rounded-full iq-accent-bg px-4 py-2 text-sm font-semibold disabled:opacity-50">{busy === course.id ? "Preparing…" : "Download PDF"}</button>
            </li>
          ))}
        </ul>
      )}
      {locked.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Still to earn</h2>
          <ul className="mt-3 space-y-3">
            {locked.map((course) => (
              <li key={course.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border iq-line p-4">
                <div>
                  <p className="font-semibold">{course.title}</p>
                  <p className="text-sm iq-muted">Finish the assessments, then download.</p>
                </div>
                <Link className="text-sm iq-link" to={`/my-courses/${course.id}/assessments`}>Open assessments</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {message && <p className="mt-4 text-sm iq-muted">{message}</p>}
    </div>
  );
};

const isFinished = (course: Mine) => {
  const total = course.lessons_total || 0;
  const done = course.lessons_done || 0;
  return Boolean(course.has_certificate) || (total > 0 && done >= total);
};

export const ProfilePage = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [courses, setCourses] = useState<Mine[]>([]);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(0);

  useEffect(() => {
    Promise.all([
      axios.get(`${API_BASE_URL}/users/me`, { headers: headers() }),
      axios.get(`${API_BASE_URL}/my-courses`, { headers: headers() }),
    ]).then(([me, mine]) => {
      setProfile(me.data);
      setCourses(Array.isArray(mine.data) ? mine.data : []);
    }).catch(() => setError("Profile could not be loaded."));
  }, []);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 8) { setMessage("Use at least 8 characters."); return; }
    try {
      await axios.post(`${API_BASE_URL}/user/change-password`, { new_password: password }, { headers: headers() });
      setPassword("");
      setMessage("Password updated.");
    } catch {
      setMessage("The password could not be updated.");
    }
  };

  const download = async (course: Mine) => {
    setBusy(course.id);
    setMessage("");
    try {
      await downloadCertificate(course.id, course.title);
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Submit the assessments before downloading this certificate.");
    } finally {
      setBusy(0);
    }
  };

  const completed = courses.filter(isFinished);
  const certificates = courses.filter((course) => course.has_certificate);

  return (
    <div>
      <h1 className="text-3xl font-semibold">Profile</h1>
      {error && <p className="mt-4 text-sm iq-muted">{error}</p>}
      {profile && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border iq-line p-5">
            <p className="text-sm iq-muted">User name</p>
            <p className="mt-1 text-xl font-semibold">{profile.full_name}</p>
          </div>
          <div className="rounded-2xl border iq-line p-5">
            <p className="text-sm iq-muted">Mail</p>
            <p className="mt-1 text-xl font-semibold break-all">{profile.email}</p>
          </div>
        </div>
      )}
      <form onSubmit={save} className="mt-6 max-w-md">
        <h2 className="text-lg font-semibold">Password change</h2>
        <label className="mt-3 block text-sm">New password
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" className="mt-1 w-full rounded-xl border iq-line iq-surface px-3 py-3" />
        </label>
        <button className="mt-4 rounded-full iq-accent-bg px-4 py-3 text-sm font-semibold">Update password</button>
      </form>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Enrolled courses</h2>
        {courses.length === 0 && <p className="mt-2 text-sm iq-muted">You are not enrolled in a course yet.</p>}
        <ul className="mt-3 space-y-2">
          {courses.map((course) => (
            <li key={course.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border iq-line p-4">
              <div>
                <Link to={`/my-courses/${course.id}`} className="font-semibold iq-link">{course.title}</Link>
                <p className="text-sm iq-muted">{course.lessons_done || 0} of {course.lessons_total || 0} lessons complete</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Completed courses</h2>
        {completed.length === 0 && <p className="mt-2 text-sm iq-muted">A course appears here when every lesson is finished, or when its certificate is issued.</p>}
        <ul className="mt-3 space-y-2">
          {completed.map((course) => (
            <li key={course.id} className="rounded-2xl border iq-line p-4">
              <p className="font-semibold">{course.title}</p>
              <p className="text-sm iq-muted">{course.has_certificate ? "Certificate issued" : "Lessons complete"}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Certificates</h2>
        {certificates.length === 0 && <p className="mt-2 text-sm iq-muted">No certificate has been issued yet. Finish the assessments, then download it here.</p>}
        <ul className="mt-3 space-y-2">
          {certificates.map((course) => (
            <li key={course.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border iq-line p-4">
              <p className="font-semibold">{course.title}</p>
              <button type="button" disabled={busy === course.id} onClick={() => download(course)} className="rounded-full iq-accent-bg px-4 py-2 text-sm font-semibold disabled:opacity-50">{busy === course.id ? "Preparing…" : "Download"}</button>
            </li>
          ))}
        </ul>
      </section>
      {message && <p className="mt-4 text-sm iq-muted">{message}</p>}
    </div>
  );
};
