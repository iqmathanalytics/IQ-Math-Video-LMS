import { useEffect, useState, type FormEvent } from "react";
import axios from "axios";
import API_BASE_URL from "./config";
import { getValidSession } from "./utils/session";

type Program = {
  id: number;
  kind: string;
  title: string;
  summary: string;
  details: string;
  mode: string;
  starts_on: string;
  seats: number;
  prize: string;
  level: string;
  registered: boolean;
  status: string;
  note: string;
};

const headers = () => {
  const session = getValidSession();
  return session?.token ? { Authorization: `Bearer ${session.token}` } : {};
};

const empty = { kind: "event", title: "", summary: "", details: "", mode: "online", starts_on: "", seats: 0, prize: "", level: "" };

export const InstructorPrograms = () => {
  const [rows, setRows] = useState<Program[]>([]);
  const [form, setForm] = useState(empty);
  const [message, setMessage] = useState("");

  const load = () => {
    axios.get(`${API_BASE_URL}/programs`, { headers: headers() })
      .then((res) => setRows(Array.isArray(res.data) ? res.data : []))
      .catch(() => setMessage("Programs could not be loaded."));
  };

  useEffect(() => { load(); }, []);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");
    try {
      await axios.post(`${API_BASE_URL}/programs`, { ...form, seats: Number(form.seats) || 0 }, { headers: headers() });
      setForm(empty);
      load();
    } catch (err: unknown) {
      const detail = axios.isAxiosError(err) ? err.response?.data?.detail : "";
      setMessage(typeof detail === "string" ? detail : "The program could not be created.");
    }
  };

  const remove = async (id: number) => {
    await axios.delete(`${API_BASE_URL}/programs/${id}`, { headers: headers() });
    load();
  };

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-semibold">Programs</h2>
      <p className="text-sm iq-muted">Events, hackathons, and competitions that signed-in students can register for.</p>
      <form onSubmit={create} className="grid gap-3 rounded-2xl border iq-line p-4 md:grid-cols-2">
        <label className="text-sm">Kind
          <select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value })} className="mt-1 w-full rounded-xl border iq-line iq-surface px-3 py-2">
            <option value="event">event</option>
            <option value="hackathon">hackathon</option>
            <option value="competition">competition</option>
          </select>
        </label>
        <label className="text-sm">Title
          <input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="mt-1 w-full rounded-xl border iq-line iq-surface px-3 py-2" />
        </label>
        <label className="text-sm md:col-span-2">Summary
          <input value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} className="mt-1 w-full rounded-xl border iq-line iq-surface px-3 py-2" />
        </label>
        <label className="text-sm">Starts
          <input value={form.starts_on} onChange={(event) => setForm({ ...form, starts_on: event.target.value })} placeholder="2026-10-12" className="mt-1 w-full rounded-xl border iq-line iq-surface px-3 py-2" />
        </label>
        <label className="text-sm">Mode
          <input value={form.mode} onChange={(event) => setForm({ ...form, mode: event.target.value })} className="mt-1 w-full rounded-xl border iq-line iq-surface px-3 py-2" />
        </label>
        <button className="rounded-full iq-accent-bg px-4 py-2 text-sm font-semibold md:col-span-2 md:w-fit">Publish program</button>
      </form>
      {message && <p className="text-sm iq-muted">{message}</p>}
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.id} className="flex items-start justify-between gap-3 rounded-2xl border iq-line p-4">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] iq-faint">{row.kind}</p>
              <p className="font-semibold">{row.title}</p>
              <p className="text-sm iq-muted">{row.summary}</p>
            </div>
            <button type="button" onClick={() => remove(row.id)} className="text-sm iq-link">Remove</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export const StudentPrograms = () => {
  const [rows, setRows] = useState<Program[]>([]);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [message, setMessage] = useState("");

  const load = () => {
    axios.get(`${API_BASE_URL}/programs`, { headers: headers() })
      .then((res) => setRows(Array.isArray(res.data) ? res.data : []))
      .catch(() => setMessage("Programs could not be loaded."));
  };

  useEffect(() => { load(); }, []);

  const register = async (id: number) => {
    await axios.post(`${API_BASE_URL}/programs/${id}/register`, {}, { headers: headers() });
    load();
  };

  const submit = async (id: number) => {
    await axios.post(`${API_BASE_URL}/programs/${id}/submit`, { note: notes[id] || "" }, { headers: headers() });
    setMessage("Submission saved.");
    load();
  };

  return (
    <div>
      <h1 className="text-3xl font-semibold">Programs</h1>
      <p className="mt-2 max-w-2xl text-sm iq-muted">Events, hackathons, and competitions from your school. Register, then send a note or a link.</p>
      {rows.length === 0 && <p className="mt-6 text-sm iq-muted">Nothing is open right now.</p>}
      <ul className="mt-6 space-y-4">
        {rows.map((row) => (
          <li key={row.id} className="rounded-2xl border iq-line p-4">
            <p className="text-xs uppercase tracking-[0.14em] iq-faint">{row.kind} · {row.mode}{row.starts_on ? ` · ${row.starts_on}` : ""}</p>
            <h2 className="mt-1 text-xl font-semibold">{row.title}</h2>
            <p className="mt-2 text-sm iq-muted">{row.summary || row.details}</p>
            {!row.registered && <button type="button" onClick={() => register(row.id)} className="mt-3 rounded-full iq-accent-bg px-4 py-2 text-sm font-semibold">Register</button>}
            {row.registered && row.status !== "submitted" && (
              <div className="mt-3 space-y-2">
                <textarea value={notes[row.id] || ""} onChange={(event) => setNotes({ ...notes, [row.id]: event.target.value })} rows={3} placeholder="Link or note" className="w-full rounded-xl border iq-line iq-surface px-3 py-2 text-sm" />
                <button type="button" onClick={() => submit(row.id)} className="rounded-full border iq-line px-4 py-2 text-sm">Submit</button>
              </div>
            )}
            {row.status === "submitted" && <p className="mt-3 text-sm iq-muted">Submitted{row.note ? `: ${row.note}` : ""}.</p>}
          </li>
        ))}
      </ul>
      {message && <p className="mt-4 text-sm iq-muted">{message}</p>}
    </div>
  );
};
