import { FormEvent, useEffect, useState } from "react";
import axios from "axios";
import API_BASE_URL from "../config";

type Row = { id: number; kind: string; title: string; summary: string; starts_on: string; mode: string };

const headers = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

const ProgramDesk = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [form, setForm] = useState({ kind: "event", title: "", summary: "", details: "", mode: "online", starts_on: "", seats: "0", prize: "", level: "" });
  const [message, setMessage] = useState("");

  const load = () => {
    axios.get(`${API_BASE_URL}/programs`, { headers: headers() })
      .then((res) => setRows(Array.isArray(res.data) ? res.data : []))
      .catch(() => setMessage("The list could not be loaded."));
  };

  useEffect(() => { load(); }, []);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");
    try {
      await axios.post(`${API_BASE_URL}/programs`, { ...form, seats: Number(form.seats) || 0 }, { headers: headers() });
      setForm({ ...form, title: "", summary: "", details: "", prize: "" });
      setMessage("Published to student accounts.");
      load();
    } catch {
      setMessage("This could not be published.");
    }
  };

  const remove = async (id: number) => {
    await axios.delete(`${API_BASE_URL}/programs/${id}`, { headers: headers() });
    load();
  };

  const field = (key: keyof typeof form, label: string) => (
    <label key={key} className="block text-sm">{label}
      <input value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
    </label>
  );

  return (
    <div className="text-slate-800">
      <h2 className="text-2xl font-semibold">Events, hackathons, competitions</h2>
      <p className="mt-1 max-w-2xl text-sm text-slate-600">Students see these after they sign in. Removing one also removes their registrations.</p>
      <form onSubmit={save} className="mt-5 grid gap-3 rounded-2xl border border-slate-300 bg-white p-5 md:grid-cols-2">
        <label className="block text-sm">Kind
          <select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2">
            <option value="event">Event</option>
            <option value="hackathon">Hackathon</option>
            <option value="competition">Competition</option>
          </select>
        </label>
        {field("title", "Title")}
        {field("summary", "Short summary")}
        {field("starts_on", "Date")}
        {field("mode", "Online or offline")}
        {field("level", "Level or theme")}
        {field("prize", "Prize, if any")}
        {field("seats", "Seats")}
        <label className="block text-sm md:col-span-2">Details
          <textarea value={form.details} onChange={(event) => setForm({ ...form, details: event.target.value })} rows={4} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
        </label>
        <button className="rounded-full bg-[#005EB8] px-4 py-2 text-sm font-semibold text-white md:col-span-2">Publish</button>
      </form>
      {message && <p className="mt-3 text-sm text-slate-600">{message}</p>}
      <ul className="mt-6 space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-400">{row.kind}</p>
              <p className="font-semibold">{row.title}</p>
              <p className="text-sm text-slate-500">{row.starts_on} {row.mode}</p>
            </div>
            <button type="button" onClick={() => remove(row.id)} className="text-sm text-red-600">Remove</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ProgramDesk;
