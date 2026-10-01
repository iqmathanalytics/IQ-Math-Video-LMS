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

type Assessment = { student: string; email: string; file_name: string; link: string; submitted_at: string; course: string };

const CertificateDesk = () => {
  const [rows, setRows] = useState<Issued[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    axios.get(`${API_BASE_URL}/admin/certificates`, { headers: authHeaders() })
      .then(async (res) => {
        setRows(Array.isArray(res.data) ? res.data : []);
        const courses = await axios.get(`${API_BASE_URL}/courses`, { headers: authHeaders() }).catch(() => ({ data: [] }));
        const list = Array.isArray(courses.data) ? courses.data : [];
        const batches = await Promise.all(list.map((course: { id: number; title: string }) =>
          axios.get(`${API_BASE_URL}/instructor/courses/${course.id}/assessments`, { headers: authHeaders() })
            .then((answer) => (Array.isArray(answer.data) ? answer.data : []).map((item: Assessment) => ({ ...item, course: course.title })))
            .catch(() => [])
        ));
        setAssessments(batches.flat());
        setStatus("ready");
      })
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
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-3xl font-semibold" style={{ fontFamily: '"Space Grotesk", Inter, sans-serif' }}>Certificates</h2>
          <p className="mt-1 max-w-2xl text-sm iq-muted">Issued after a student submits the assessments. They download the PDF from their certificate section. This list is the record for your courses.</p>
        </div>
        <button type="button" onClick={exportCsv} disabled={shown.length === 0} className="rounded-full iq-accent-bg px-4 py-2 text-sm font-semibold disabled:opacity-50">Export CSV</button>
      </div>
      <label className="mt-5 block max-w-sm text-sm">Search by student, course, or certificate number
        <input value={query} onChange={(event) => setQuery(event.target.value)} className="mt-1 w-full rounded-xl border iq-line iq-surface px-3 py-3" />
      </label>
      {status === "loading" && <p className="mt-6 text-sm iq-muted">Loading issued certificates…</p>}
      {status === "error" && <p className="mt-6 text-sm iq-muted">Certificates could not be loaded.</p>}
      {status === "ready" && shown.length === 0 && <p className="mt-6 rounded-2xl border iq-line iq-surface p-5 text-sm iq-muted">No certificates issued yet. They appear here when a student finishes the assessments and downloads one.</p>}
      {shown.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-2xl border iq-line iq-surface">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b iq-line iq-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Certificate</th>
                <th className="px-4 py-3 font-medium">Student</th>
                <th className="px-4 py-3 font-medium">Course</th>
                <th className="px-4 py-3 font-medium">Issued</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <tr key={row.id} className="border-b iq-line">
                  <td className="px-4 py-3 font-mono text-xs">{row.credential_id}</td>
                  <td className="px-4 py-3">{row.student}<div className="text-xs iq-muted">{row.email}</div></td>
                  <td className="px-4 py-3">{row.course}</td>
                  <td className="px-4 py-3 tabular-nums">{row.issued_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <section className="mt-8">
        <h3 className="text-xl font-semibold">Assessment files</h3>
        <p className="mt-1 text-sm iq-muted">Files students uploaded for a certificate stay on this server. Folder links open in a new tab.</p>
        {assessments.length === 0 && <p className="mt-4 text-sm iq-muted">No assessment submissions yet.</p>}
        {assessments.length > 0 && (
          <ul className="mt-4 space-y-2">
            {assessments.map((item) => (
              <li key={`${item.course}-${item.email}-${item.submitted_at}-${item.file_name}`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border iq-line p-4 text-sm">
                <div>
                  <p className="font-semibold">{item.student}</p>
                  <p className="iq-muted">{item.course} · {item.submitted_at}</p>
                </div>
                <div className="flex gap-3">
                  {item.file_name && <button type="button" className="iq-link" onClick={async () => {
                    const res = await axios.get(`${API_BASE_URL}/instructor/assessments/file/${encodeURIComponent(item.file_name)}`, { headers: authHeaders(), responseType: "blob" });
                    const link = document.createElement("a");
                    link.href = URL.createObjectURL(res.data);
                    link.download = item.file_name;
                    link.click();
                  }}>Download file</button>}
                  {item.link && <a className="iq-link" href={item.link} target="_blank" rel="noreferrer">Open link</a>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default CertificateDesk;
