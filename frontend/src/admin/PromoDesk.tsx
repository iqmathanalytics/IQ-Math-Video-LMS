import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import API_BASE_URL from "../config";

type Promo = {
  id: number;
  code: string;
  discount_type: "percent" | "fixed" | string;
  discount_value: number;
  course_id: number | null;
  course_title?: string;
  max_uses: number;
  used_count: number;
  is_active: boolean;
  valid_until: string;
  note: string;
  created_at: string;
};

type CourseOpt = { id: number; title: string; price?: number };

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

const emptyForm = {
  code: "",
  discount_type: "percent" as "percent" | "fixed",
  discount_value: 10,
  course_id: "" as string | number,
  max_uses: 0,
  is_active: true,
  valid_until: "",
  note: "",
};

const PromoDesk = () => {
  const [rows, setRows] = useState<Promo[]>([]);
  const [courses, setCourses] = useState<CourseOpt[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const load = async () => {
    const [promoRes, courseRes] = await Promise.all([
      axios.get(`${API_BASE_URL}/admin/promo-codes`, { headers: authHeaders() }),
      axios.get(`${API_BASE_URL}/courses`, { headers: authHeaders() }),
    ]);
    setRows(Array.isArray(promoRes.data) ? promoRes.data : []);
    setCourses(Array.isArray(courseRes.data) ? courseRes.data : []);
  };

  useEffect(() => {
    load()
      .then(() => setStatus("ready"))
      .catch(() => setStatus("error"));
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => `${row.code} ${row.course_title || ""} ${row.note}`.toLowerCase().includes(q));
  }, [rows, query]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditId(0);
  };

  const startEdit = (row: Promo) => {
    setEditId(row.id);
    setForm({
      code: row.code,
      discount_type: row.discount_type === "fixed" ? "fixed" : "percent",
      discount_value: row.discount_value,
      course_id: row.course_id ?? "",
      max_uses: row.max_uses || 0,
      is_active: row.is_active,
      valid_until: row.valid_until || "",
      note: row.note || "",
    });
    setMessage("");
    setError("");
  };

  const save = async () => {
    setBusy(true);
    setMessage("");
    setError("");
    const body = {
      code: form.code.trim(),
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value) || 0,
      course_id: form.course_id === "" ? null : Number(form.course_id),
      max_uses: Number(form.max_uses) || 0,
      is_active: form.is_active,
      valid_until: form.valid_until || "",
      note: form.note.trim(),
    };
    try {
      if (editId) {
        await axios.patch(`${API_BASE_URL}/admin/promo-codes/${editId}`, body, { headers: authHeaders() });
        setMessage("Promo code updated.");
      } else {
        await axios.post(`${API_BASE_URL}/admin/promo-codes`, body, { headers: authHeaders() });
        setMessage("Promo code created.");
      }
      resetForm();
      await load();
    } catch (err: unknown) {
      const detail = axios.isAxiosError(err) ? err.response?.data?.detail : "";
      setError(typeof detail === "string" && detail ? detail : "Could not save that promo code.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    if (!window.confirm("Delete this promo code?")) return;
    setBusy(true);
    setError("");
    try {
      await axios.delete(`${API_BASE_URL}/admin/promo-codes/${id}`, { headers: authHeaders() });
      if (editId === id) resetForm();
      await load();
      setMessage("Promo code deleted.");
    } catch {
      setError("Could not delete that promo code.");
    } finally {
      setBusy(false);
    }
  };

  const previewLabel = form.discount_type === "percent"
    ? `${Number(form.discount_value) || 0}% off`
    : `₹${Number(form.discount_value) || 0} off`;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-semibold" style={{ fontFamily: '"Space Grotesk", Inter, sans-serif' }}>Promo codes</h2>
        <p className="mt-1 max-w-2xl text-sm iq-muted">
          Create discount codes for paid courses. Students enter the code at checkout and pay the reduced price through Razorpay.
        </p>
      </div>

      <section className="rounded-2xl border iq-line iq-surface p-5">
        <h3 className="text-lg font-semibold">{editId ? "Edit promo code" : "New promo code"}</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm">
            <span className="iq-muted">Code</span>
            <input
              value={form.code}
              onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
              placeholder="WELCOME20"
              className="mt-1 w-full rounded-xl border iq-line iq-surface px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="iq-muted">Discount type</span>
            <select
              value={form.discount_type}
              onChange={(event) => setForm({ ...form, discount_type: event.target.value as "percent" | "fixed" })}
              className="mt-1 w-full rounded-xl border iq-line iq-surface px-3 py-2"
            >
              <option value="percent">Percent (%)</option>
              <option value="fixed">Fixed amount (₹)</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="iq-muted">Discount value</span>
            <input
              type="number"
              min={1}
              value={form.discount_value}
              onChange={(event) => setForm({ ...form, discount_value: Number(event.target.value) })}
              className="mt-1 w-full rounded-xl border iq-line iq-surface px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="iq-muted">Applies to</span>
            <select
              value={form.course_id}
              onChange={(event) => setForm({ ...form, course_id: event.target.value === "" ? "" : Number(event.target.value) })}
              className="mt-1 w-full rounded-xl border iq-line iq-surface px-3 py-2"
            >
              <option value="">All paid courses</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}{Number(course.price) > 0 ? ` · ₹${course.price}` : " · Free"}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="iq-muted">Max uses (0 = unlimited)</span>
            <input
              type="number"
              min={0}
              value={form.max_uses}
              onChange={(event) => setForm({ ...form, max_uses: Number(event.target.value) })}
              className="mt-1 w-full rounded-xl border iq-line iq-surface px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="iq-muted">Valid until (optional)</span>
            <input
              type="date"
              value={form.valid_until}
              onChange={(event) => setForm({ ...form, valid_until: event.target.value })}
              className="mt-1 w-full rounded-xl border iq-line iq-surface px-3 py-2"
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="iq-muted">Note</span>
            <input
              value={form.note}
              onChange={(event) => setForm({ ...form, note: event.target.value })}
              placeholder="Campus workshop batch"
              className="mt-1 w-full rounded-xl border iq-line iq-surface px-3 py-2"
            />
          </label>
          <label className="flex items-center gap-2 text-sm pt-6">
            <input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} />
            Active
          </label>
        </div>
        <p className="mt-3 text-sm iq-muted">Preview: students get <span className="font-semibold iq-accent">{previewLabel}</span>.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => void save()} className="rounded-full iq-accent-bg px-4 py-2 text-sm font-semibold disabled:opacity-50">
            {busy ? "Saving…" : editId ? "Save changes" : "Create promo code"}
          </button>
          {editId > 0 && (
            <button type="button" onClick={resetForm} className="rounded-full border iq-line px-4 py-2 text-sm">
              Cancel edit
            </button>
          )}
        </div>
        {message && <p className="mt-3 text-sm iq-accent">{message}</p>}
        {error && <p className="mt-3 text-sm" style={{ color: "#b42318" }}>{error}</p>}
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">All promo codes</h3>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search codes"
            className="w-full max-w-xs rounded-xl border iq-line iq-surface px-3 py-2 text-sm"
          />
        </div>
        {status === "loading" && <p className="mt-4 text-sm iq-muted">Loading promo codes…</p>}
        {status === "error" && <p className="mt-4 text-sm iq-muted">Promo codes could not be loaded.</p>}
        {status === "ready" && shown.length === 0 && <p className="mt-4 text-sm iq-muted">No promo codes yet. Create one above.</p>}
        <ul className="mt-4 space-y-3">
          {shown.map((row) => (
            <li key={row.id} className="rounded-2xl border iq-line p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold tracking-wide">{row.code}</p>
                  <p className="mt-1 text-sm iq-muted">
                    {row.discount_type === "fixed" ? `₹${row.discount_value} off` : `${row.discount_value}% off`}
                    {" · "}
                    {row.course_title || "All courses"}
                    {" · "}
                    {row.used_count}/{row.max_uses || "∞"} uses
                    {" · "}
                    {row.is_active ? "Active" : "Inactive"}
                    {row.valid_until ? ` · until ${row.valid_until}` : ""}
                  </p>
                  {row.note && <p className="mt-1 text-xs iq-faint">{row.note}</p>}
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => startEdit(row)} className="rounded-full border iq-line px-3 py-1.5 text-sm">Edit</button>
                  <button type="button" disabled={busy} onClick={() => void remove(row.id)} className="rounded-full border iq-line px-3 py-1.5 text-sm">Delete</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

export default PromoDesk;
