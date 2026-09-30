import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import API_BASE_URL from "../config";

type Issued = {
  id: number;
  credential_id: string;
  student: string;
  email: string;
  course: string;
  course_id: number;
  issued_at: string;
};

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

const CertificateDesk = () => {
  const [rows, setRows] = useState<Issued[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    axios.get(`${API_BASE_URL}/admin/certificates`, { headers: authHeaders() })
      .then((res) => { setRows(Array.isArray(res.data) ? res.data : []); setStatus("ready"); })
      .catch(() => setStatus("error"));
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => `${row.credential_id} ${row.student} ${row.email} ${row.course}`.toLowerCase().includes(q));
  }, [rows, query]);

  const exportCsv = () => {
    const header = "credential_id,student,email,course,issued_at";
    const body = shown.map((row) => [row.credential_id, row.student, row.email, row.course, row.issued_at].map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","));
    const blob = new Blob([[header, ...body].join("\n")], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "certificates.csv";
    link.click();
  };

  return (
    <div className="text-slate-800">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Certificates</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">Issued after a student submits the assessments. They download the PDF from their certificate section. This list is the record for your courses.</p>
        </div>
        <button type="button" onClick={exportCsv} disabled={shown.length === 0} className="rounded-full bg-[#005EB8] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Export CSV</button>
      </div>
      <label className="mt-5 block max-w-sm text-sm">Search by student, course, or certificate number
        <input value={query} onChange={(event) => setQuery(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-3" />
      </label>
      {status === "loading" && <p className="mt-6 text-sm text-slate-500">Loading issued certificates…</p>}
      {status === "error" && <p className="mt-6 text-sm text-slate-600">Certificates could not be loaded.</p>}
      {status === "ready" && shown.length === 0 && <p className="mt-6 rounded-2xl border border-slate-300 bg-white p-5 text-sm text-slate-600">No certificates issued yet. They appear here when a student finishes the assessments and downloads one.</p>}
      {shown.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-300 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Certificate</th>
                <th className="px-4 py-3 font-medium">Student</th>
                <th className="px-4 py-3 font-medium">Course</th>
                <th className="px-4 py-3 font-medium">Issued</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="px-4 py-3 font-mono text-xs">{row.credential_id}</td>
                  <td className="px-4 py-3">{row.student}<div className="text-xs text-slate-500">{row.email}</div></td>
                  <td className="px-4 py-3">{row.course}</td>
                  <td className="px-4 py-3 tabular-nums">{row.issued_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default CertificateDesk;
