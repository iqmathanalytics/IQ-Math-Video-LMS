import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import axios from "axios";
import API_BASE_URL from "../config";
import { getValidSession } from "../utils/session";
import CourseFacts from "../components/CourseFacts";
import CourseCover from "../components/CourseCover";
import { checkoutKey, ensureRazorpay, withPaymentMethods } from "../utils/razorpay";

const headers = () => {
  const session = getValidSession();
  return session?.token ? { Authorization: `Bearer ${session.token}` } : {};
};

type Mine = { id: number; title: string; description: string; has_certificate?: boolean; price?: number; image_url?: string | null; lessons_total?: number; lessons_done?: number };
type CatalogCourse = { id: number; title: string; description: string; price: number; image_url?: string | null; is_published?: boolean; language?: string | null; course_type?: string };
type Profile = {
  id: number;
  full_name: string;
  email: string;
  phone_number?: string | null;
  college?: string | null;
  organization?: string | null;
  social_media_link?: string | null;
};

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
  const [published, setPublished] = useState<CatalogCourse[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      axios.get(`${API_BASE_URL}/account`, { headers: headers() }),
      axios.get(`${API_BASE_URL}/courses`, { headers: headers() }),
    ])
      .then(([account, catalog]) => {
        if (cancelled) return;
        setName(account.data?.user?.full_name || "Student");
        setCourses(Array.isArray(account.data?.courses) ? account.data.courses : []);
        setPublished(Array.isArray(catalog.data) ? catalog.data : []);
        setStatus("ready");
      })
      .catch(() => { if (!cancelled) setStatus("error"); });
    return () => { cancelled = true; };
  }, []);

  const next = courses[0];
  const certificates = courses.filter((course) => course.has_certificate).length;
  const enrolledIds = new Set(courses.map((course) => course.id));

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
                  <div className="w-36 shrink-0"><CourseCover title={next.title} imageUrl={next.image_url} priority /></div>
                  <div className="min-w-0">
                    <p className="font-semibold">{next.title}</p>
                    <CourseFacts description={next.description} />
                  </div>
                </div>
                <Link to={`/my-courses/${next.id}`} className="rounded-full iq-accent-bg px-4 py-2 text-sm font-semibold">Open course</Link>
              </div>
            ) : <p className="mt-3 text-sm iq-muted">No published course is on your account yet.</p>}
          </section>
          <section className="mt-4">
            <h2 className="text-lg font-semibold">Published courses</h2>
            {published.length === 0 && <p className="mt-3 text-sm iq-muted">No published courses yet.</p>}
            <ul className="mt-3 grid gap-4 md:grid-cols-2">
              {published.map((course, index) => (
                <li key={course.id} className="rounded-2xl border iq-line p-4">
                  <CourseCover title={course.title} imageUrl={course.image_url} priority={index < 2} />
                  <h3 className="mt-3 font-semibold">{course.title}</h3>
                  <p className="mt-1 text-sm iq-muted">{Number(course.price) > 0 ? `₹${course.price}` : "Free"}</p>
                  {enrolledIds.has(course.id)
                    ? <Link to={`/my-courses/${course.id}`} className="mt-3 inline-block text-sm iq-link">Continue</Link>
                    : <Link to={`/courses?course=${course.id}`} className="mt-3 inline-block text-sm iq-link">Enroll</Link>}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
};

export const CourseCatalog = () => {
  const [searchParams] = useSearchParams();
  const focusId = Number(searchParams.get("course") || 0) || 0;
  const focusRef = useRef<HTMLLIElement | null>(null);
  const [courses, setCourses] = useState<CatalogCourse[]>([]);
  const [enrolled, setEnrolled] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("All");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState(0);
  const [checkout, setCheckout] = useState<CatalogCourse | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [promoMsg, setPromoMsg] = useState("");
  const [finalPrice, setFinalPrice] = useState<number | null>(null);
  const [promoBusy, setPromoBusy] = useState(false);

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

  useEffect(() => {
    if (status !== "ready" || !focusId || !focusRef.current) return;
    focusRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [status, focusId, courses]);

  const shown = useMemo(() => {
    const filtered = courses.filter((course) => {
      const text = `${course.title} ${course.description || ""}`.toLowerCase();
      if (query.trim() && !text.includes(query.trim().toLowerCase())) return false;
      if (level === "Free" && Number(course.price) > 0) return false;
      if (level === "Paid" && Number(course.price) === 0) return false;
      return true;
    });
    if (!focusId) return filtered;
    return [...filtered].sort((a, b) => Number(b.id === focusId) - Number(a.id === focusId));
  }, [courses, query, level, focusId]);

  const markEnrolled = (course: CatalogCourse) => {
    setEnrolled((current) => new Set(current).add(course.id));
    setMessage(`You are enrolled in ${course.title}. Open it from My learning.`);
    setCheckout(null);
    setPromoCode("");
    setPromoMsg("");
    setFinalPrice(null);
  };

  const openCheckout = (course: CatalogCourse) => {
    setMessage("");
    setCheckout(course);
    setPromoCode("");
    setPromoMsg("");
    setFinalPrice(Number(course.price) || 0);
  };

  const applyPromo = async () => {
    if (!checkout) return;
    setPromoBusy(true);
    setPromoMsg("");
    try {
      const res = await axios.post(
        `${API_BASE_URL}/promo/validate`,
        { code: promoCode.trim(), course_id: checkout.id },
        { headers: headers() },
      );
      setFinalPrice(Number(res.data.final_price));
      setPromoMsg(res.data.message || "Promo applied.");
    } catch (err: unknown) {
      setFinalPrice(Number(checkout.price) || 0);
      const detail = axios.isAxiosError(err) ? err.response?.data?.detail : "";
      setPromoMsg(typeof detail === "string" && detail ? detail : "That promo code could not be applied.");
    } finally {
      setPromoBusy(false);
    }
  };

  const enroll = async (course: CatalogCourse, code = "") => {
    setMessage("");
    setBusyId(course.id);
    try {
      if (Number(course.price) <= 0) {
        await axios.post(`${API_BASE_URL}/enroll/${course.id}`, { type: "paid" }, { headers: headers() });
        markEnrolled(course);
        return;
      }
      const order = await axios.post(
        `${API_BASE_URL}/create-order`,
        { course_id: course.id, promo_code: code.trim() || undefined },
        { headers: headers() },
      );
      if (order.data?.free) {
        markEnrolled(course);
        setMessage(order.data.message || "Promo unlocked this course.");
        return;
      }
      const razorpayKey = checkoutKey(order.data?.key_id);
      if (!razorpayKey || !order.data?.id) {
        setMessage("Razorpay checkout is not available right now.");
        return;
      }
      await ensureRazorpay();
      const RazorpayCheckout = (window as unknown as { Razorpay: new (options: object) => { open: () => void } }).Razorpay;
      const pay = new RazorpayCheckout(withPaymentMethods({
        key: razorpayKey,
        amount: order.data.amount,
        currency: order.data.currency || "INR",
        name: "IQNex",
        description: course.title,
        order_id: order.data.id,
        theme: { color: "#1d7a34" },
        handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          await axios.post(`${API_BASE_URL}/payment/verify`, {
            course_id: course.id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_signature: response.razorpay_signature,
            promo_code: code.trim() || undefined,
          }, { headers: headers() });
          markEnrolled(course);
        },
      }));
      pay.open();
      setMessage(`Razorpay checkout is open for ${course.title}${order.data?.final_price != null ? ` · ₹${order.data.final_price}` : ""}.`);
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
      <p className="mt-2 max-w-2xl text-sm iq-muted">Published courses from your school. Enrollment is saved on your account and shows up under My learning.</p>
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
      {focusId > 0 && status === "ready" && !courses.some((course) => course.id === focusId) && (
        <p className="mt-4 rounded-2xl border iq-line p-4 text-sm iq-muted">That shared course is not in the published catalogue.</p>
      )}
      <ul className="mt-6 grid gap-4 md:grid-cols-2">
        {shown.map((course) => {
          const focused = course.id === focusId;
          return (
            <li
              key={course.id}
              ref={focused ? focusRef : undefined}
              id={focused ? `course-${course.id}` : undefined}
              className={`rounded-2xl border p-5 ${focused ? "iq-line ring-2 ring-[var(--iq-accent,#1d7a34)] iq-surface" : "iq-line"}`}
            >
              {focused && <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] iq-accent">Shared course</p>}
              <CourseCover title={course.title} imageUrl={course.image_url} />
              <p className="mt-3 text-xs uppercase tracking-[0.14em] iq-faint">{Number(course.price) > 0 ? `₹${course.price}` : "Free"} · {course.language || course.course_type || "Course"}</p>
              {Number(course.price) > 0 && !enrolled.has(course.id) && <p className="mt-1 text-xs iq-muted">Pay with UPI, card, netbanking, or a wallet.</p>}
              <h2 className="mt-2 text-xl font-semibold">{course.title}</h2>
              <CourseFacts description={course.description} />
              <div className="mt-4 flex flex-wrap gap-2">
                {enrolled.has(course.id) ? <Link to={`/my-courses/${course.id}`} className="rounded-full iq-accent-bg px-4 py-2 text-sm font-semibold">Continue</Link> : <button type="button" disabled={busyId === course.id} onClick={() => Number(course.price) > 0 ? openCheckout(course) : void enroll(course)} className="rounded-full iq-accent-bg px-4 py-2 text-sm font-semibold disabled:opacity-50">{busyId === course.id ? "Opening checkout…" : Number(course.price) > 0 ? `Pay ₹${course.price}` : "Enroll free"}</button>}
              </div>
            </li>
          );
        })}
      </ul>
      {message && <p className="mt-4 text-sm iq-muted">{message}</p>}

      {checkout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setCheckout(null)}>
          <div className="w-full max-w-md rounded-2xl border iq-line iq-surface p-5" onClick={(event) => event.stopPropagation()}>
            <h3 className="text-xl font-semibold">Checkout</h3>
            <p className="mt-1 text-sm iq-muted">Unlock <strong>{checkout.title}</strong>.</p>
            <div className="mt-4 rounded-xl border iq-line p-3 text-sm">
              <div className="flex justify-between"><span className="iq-muted">Course price</span><span>₹{checkout.price}</span></div>
              <div className="mt-2 flex justify-between font-semibold"><span>You pay</span><span className="iq-accent">₹{finalPrice ?? checkout.price}</span></div>
            </div>
            <label className="mt-4 block text-sm">
              <span className="iq-muted">Promo code</span>
              <div className="mt-1 flex gap-2">
                <input
                  value={promoCode}
                  onChange={(event) => setPromoCode(event.target.value.toUpperCase())}
                  placeholder="WELCOME20"
                  className="min-w-0 flex-1 rounded-xl border iq-line iq-surface px-3 py-2"
                />
                <button type="button" disabled={promoBusy || !promoCode.trim()} onClick={() => void applyPromo()} className="rounded-xl border iq-line px-3 py-2 text-sm disabled:opacity-50">
                  {promoBusy ? "…" : "Apply"}
                </button>
              </div>
            </label>
            {promoMsg && <p className="mt-2 text-sm iq-muted">{promoMsg}</p>}
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busyId === checkout.id}
                onClick={() => void enroll(checkout, promoCode)}
                className="rounded-full iq-accent-bg px-4 py-2 text-sm font-semibold disabled:opacity-50"
              >
                {busyId === checkout.id ? "Processing…" : (finalPrice ?? checkout.price) <= 0 ? "Unlock free with promo" : `Pay ₹${finalPrice ?? checkout.price}`}
              </button>
              <button type="button" onClick={() => setCheckout(null)} className="rounded-full border iq-line px-4 py-2 text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
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
      {status === "ready" && earned.length === 0 && locked.length === 0 && <p className="mt-6 rounded-2xl border iq-line p-5 text-sm iq-muted">Enroll in a course first. The certificate unlocks after the assessments are submitted.</p>}
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
  const [details, setDetails] = useState({ full_name: "", phone_number: "", college: "", organization: "", social_media_link: "" });
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(0);
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    Promise.all([
      axios.get(`${API_BASE_URL}/users/me`, { headers: headers() }),
      axios.get(`${API_BASE_URL}/my-courses`, { headers: headers() }),
    ]).then(([me, mine]) => {
      setProfile(me.data);
      setDetails({
        full_name: me.data?.full_name || "",
        phone_number: me.data?.phone_number || "",
        college: me.data?.college || "",
        organization: me.data?.organization || "",
        social_media_link: me.data?.social_media_link || "",
      });
      setCourses(Array.isArray(mine.data) ? mine.data : []);
    }).catch(() => setError("Profile could not be loaded."));
  }, []);

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    setSavingProfile(true);
    setMessage("");
    try {
      const res = await axios.patch(`${API_BASE_URL}/users/me`, {
        full_name: details.full_name,
        phone_number: details.phone_number,
        college: details.college,
        organization: details.organization,
        social_media_link: details.social_media_link,
      }, { headers: headers() });
      setProfile(res.data);
      setMessage("Profile updated.");
    } catch (err: unknown) {
      const detail = axios.isAxiosError(err) ? err.response?.data?.detail : "";
      setMessage(typeof detail === "string" ? detail : "The profile could not be updated.");
    } finally {
      setSavingProfile(false);
    }
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 8) { setMessage("Use at least 8 characters."); return; }
    try {
      await axios.post(`${API_BASE_URL}/user/change-password`, { current_password: currentPassword, new_password: password }, { headers: headers() });
      setCurrentPassword("");
      setPassword("");
      setMessage("Password updated.");
    } catch (err: unknown) {
      const detail = axios.isAxiosError(err) ? err.response?.data?.detail : "";
      setMessage(typeof detail === "string" ? detail : "The password could not be updated.");
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
        <form onSubmit={saveProfile} className="mt-6 max-w-xl space-y-3 rounded-2xl border iq-line p-5">
          <h2 className="text-lg font-semibold">Account details</h2>
          <p className="text-sm iq-muted">Mail stays on the account: <span className="font-medium">{profile.email}</span></p>
          <label className="block text-sm">Name
            <input value={details.full_name} onChange={(event) => setDetails((current) => ({ ...current, full_name: event.target.value }))} className="mt-1 w-full rounded-xl border iq-line iq-surface px-3 py-3" autoComplete="name" />
          </label>
          <label className="block text-sm">Mobile number
            <input value={details.phone_number} onChange={(event) => setDetails((current) => ({ ...current, phone_number: event.target.value }))} className="mt-1 w-full rounded-xl border iq-line iq-surface px-3 py-3" autoComplete="tel" placeholder="10-digit mobile number" />
          </label>
          <label className="block text-sm">College
            <input value={details.college} onChange={(event) => setDetails((current) => ({ ...current, college: event.target.value }))} className="mt-1 w-full rounded-xl border iq-line iq-surface px-3 py-3" placeholder="College name" />
          </label>
          <label className="block text-sm">Organization
            <input value={details.organization} onChange={(event) => setDetails((current) => ({ ...current, organization: event.target.value }))} className="mt-1 w-full rounded-xl border iq-line iq-surface px-3 py-3" placeholder="Company or organization" />
          </label>
          <label className="block text-sm">Social media link
            <input value={details.social_media_link} onChange={(event) => setDetails((current) => ({ ...current, social_media_link: event.target.value }))} className="mt-1 w-full rounded-xl border iq-line iq-surface px-3 py-3" placeholder="https://linkedin.com/in/…" />
          </label>
          <button type="submit" disabled={savingProfile} className="rounded-full iq-accent-bg px-4 py-3 text-sm font-semibold disabled:opacity-50">
            {savingProfile ? "Saving…" : "Save profile"}
          </button>
        </form>
      )}
      <form onSubmit={save} className="mt-6 max-w-md">
        <h2 className="text-lg font-semibold">Password change</h2>
        <label className="mt-3 block text-sm">Current password
          <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" className="mt-1 w-full rounded-xl border iq-line iq-surface px-3 py-3" />
        </label>
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
