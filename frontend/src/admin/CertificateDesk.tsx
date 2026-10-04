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

type CourseIdRow = {
  course_id: number;
  title: string;
  prefix: string;
  code: string;
  number_width: number;
  current_seq: number;
  next_seq: number;
  start_number?: number;
  preview: string;
  configured: boolean;
};

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

type Assessment = { student: string; email: string; file_name: string; link: string; submitted_at: string; course: string };

const buildPreview = (prefix: string, code: string, width: number, nextSeq: number) => {
  const p = (prefix || "IQ").trim().toUpperCase() || "IQ";
  const c = (code || "XXX").trim().toUpperCase().slice(0, 3).padEnd(3, "X");
  const w = Math.max(1, Math.min(Number(width) || 3, 8));
  return `${p}-${c}-${String(nextSeq).padStart(w, "0")}`.slice(0, 64);
};

const CertificateDesk = () => {
  const [rows, setRows] = useState<Issued[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [idCourses, setIdCourses] = useState<CourseIdRow[]>([]);
  const [selectedId, setSelectedId] = useState(0);
  const [prefix, setPrefix] = useState("IQ");
  const [code, setCode] = useState("");
  const [numberWidth, setNumberWidth] = useState(3);
  const [startNumber, setStartNumber] = useState(1);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [templateBusy, setTemplateBusy] = useState(false);
  const [templateMsg, setTemplateMsg] = useState("");
  const [templateErr, setTemplateErr] = useState("");
  const [editing, setEditing] = useState(false);
  const [confirmEdit, setConfirmEdit] = useState(false);

  const loadIdCourses = async () => {
    const res = await axios.get<CourseIdRow[]>(`${API_BASE_URL}/admin/certificate-id-courses`, { headers: authHeaders() });
    const list = Array.isArray(res.data) ? res.data : [];
    setIdCourses(list);
    return list;
  };

  const syncFieldsFromCourse = (course: CourseIdRow) => {
    setPrefix(course.prefix || "IQ");
    setCode(course.code || "");
    setNumberWidth(course.number_width || 3);
    setStartNumber(course.start_number || course.next_seq || 1);
  };

  useEffect(() => {
    // Load the main lists first so the page paints quickly.
    Promise.all([
      axios.get(`${API_BASE_URL}/admin/certificates`, { headers: authHeaders() }),
      loadIdCourses().catch(() => [] as CourseIdRow[]),
    ])
      .then(([certRes, list]) => {
        setRows(Array.isArray(certRes.data) ? certRes.data : []);
        if (list[0]) setSelectedId((current) => current || list[0].course_id);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));

    // Defer assessment file fetches so they do not block the first paint.
    const loadAssessments = () => {
      axios.get(`${API_BASE_URL}/courses`, { headers: authHeaders() })
        .then(async (courses) => {
          const list = Array.isArray(courses.data) ? courses.data : [];
          const batches = await Promise.all(list.map((course: { id: number; title: string }) =>
            axios.get(`${API_BASE_URL}/instructor/courses/${course.id}/assessments`, { headers: authHeaders() })
              .then((answer) => (Array.isArray(answer.data) ? answer.data : []).map((item: Assessment) => ({ ...item, course: course.title })))
              .catch(() => [])
          ));
          setAssessments(batches.flat());
        })
        .catch(() => setAssessments([]));
    };
    const idle = window.setTimeout(loadAssessments, 400);
    return () => window.clearTimeout(idle);
  }, []);

  const selected = idCourses.find((row) => row.course_id === selectedId) || null;

  useEffect(() => {
    if (!selected) return;
    syncFieldsFromCourse(selected);
    setEditing(!selected.configured);
    setConfirmEdit(false);
    setTemplateMsg("");
    setTemplateErr("");
  }, [selectedId, selected?.course_id, selected?.configured, selected?.prefix, selected?.code, selected?.number_width, selected?.next_seq, selected?.start_number]);

  const livePreview = useMemo(
    () => buildPreview(prefix, code, numberWidth, startNumber),
    [prefix, code, numberWidth, startNumber],
  );

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

  const saveCourseId = async () => {
    if (!selectedId) return;
    setTemplateBusy(true);
    setTemplateMsg("");
    setTemplateErr("");
    try {
      const res = await axios.put<CourseIdRow & { message?: string }>(
        `${API_BASE_URL}/admin/courses/${selectedId}/certificate-id`,
        { prefix, code, number_width: numberWidth, start_number: startNumber },
        { headers: authHeaders() },
      );
      setPrefix(res.data.prefix);
      setCode(res.data.code);
      setNumberWidth(res.data.number_width);
      setStartNumber(res.data.start_number || res.data.next_seq || 1);
      setTemplateMsg(res.data.message || "Saved for this course.");
      setEditing(false);
      setConfirmEdit(false);
      await loadIdCourses();
      setSelectedId(res.data.course_id || selectedId);
    } catch (err: unknown) {
      const detail = axios.isAxiosError(err) ? err.response?.data?.detail : null;
      setTemplateErr(typeof detail === "string" ? detail : "Could not save the certificate ID format.");
    } finally {
      setTemplateBusy(false);
    }
  };

  const cancelEdit = () => {
    if (selected) syncFieldsFromCourse(selected);
    setEditing(false);
    setConfirmEdit(false);
    setTemplateErr("");
    setTemplateMsg("");
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-3xl font-semibold" style={{ fontFamily: '"Space Grotesk", Inter, sans-serif' }}>Certificates</h2>
          <p className="mt-1 max-w-2xl text-sm iq-muted">
            Set a certificate ID format per course, then review issued certificates and assessment files.
          </p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={shown.length === 0}
          className="shrink-0 rounded-full iq-accent-bg px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          Export CSV
        </button>
      </div>

      <section className="rounded-2xl border iq-line iq-surface p-5 sm:p-6">
        <h3 className="text-lg font-semibold">Certificate ID by course</h3>
        <p className="mt-1 text-sm iq-muted">
          Choose a course, set prefix + 3-letter code + number digits + start number, then save. Example: start from 40 → IQ-PYT-040. Existing IDs stay unchanged.
        </p>

        {idCourses.length === 0 ? (
          <p className="mt-4 text-sm iq-muted">No courses yet. Create a course first, then set its certificate ID format here.</p>
        ) : (
          <div className="mt-5 space-y-5">
            <label className="block max-w-xl text-sm">
              Course
              <select
                value={selectedId || ""}
                onChange={(event) => setSelectedId(Number(event.target.value) || 0)}
                className="mt-1 w-full rounded-xl border iq-line iq-surface px-3 py-3 text-sm"
              >
                {idCourses.map((course) => (
                  <option key={course.course_id} value={course.course_id}>
                    {course.title} · {course.preview}
                  </option>
                ))}
              </select>
            </label>

            {selected && (
              <div className="rounded-xl border iq-line p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{selected.title}</p>
                    {selected.configured && !editing && (
                      <p className="mt-1 inline-flex rounded-full border iq-line px-2.5 py-0.5 text-xs font-semibold iq-accent">Saved</p>
                    )}
                  </div>
                  {selected.configured && !editing && (
                    <button
                      type="button"
                      onClick={() => setConfirmEdit(true)}
                      className="rounded-full border iq-line px-4 py-2 text-sm font-semibold"
                    >
                      Edit
                    </button>
                  )}
                </div>

                {!editing ? (
                  <div className="mt-4 space-y-3">
                    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-xl border iq-line p-3">
                        <dt className="text-xs iq-muted">Prefix</dt>
                        <dd className="mt-1 font-mono text-sm">{selected.prefix}</dd>
                      </div>
                      <div className="rounded-xl border iq-line p-3">
                        <dt className="text-xs iq-muted">Course code</dt>
                        <dd className="mt-1 font-mono text-sm">{selected.code}</dd>
                      </div>
                      <div className="rounded-xl border iq-line p-3">
                        <dt className="text-xs iq-muted">Number digits</dt>
                        <dd className="mt-1 font-mono text-sm">{selected.number_width}</dd>
                      </div>
                      <div className="rounded-xl border iq-line p-3">
                        <dt className="text-xs iq-muted">Next number</dt>
                        <dd className="mt-1 font-mono text-sm">{selected.start_number || selected.next_seq}</dd>
                      </div>
                    </dl>
                    <p className="text-sm">
                      Next ID: <span className="break-all font-mono text-xs">{selected.preview}</span>
                    </p>
                    {templateMsg && <p className="text-sm iq-muted">{templateMsg}</p>}
                  </div>
                ) : (
                  <>
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <label className="block min-w-0 text-sm">
                        Prefix
                        <input
                          value={prefix}
                          onChange={(event) => setPrefix(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
                          className="mt-1 w-full rounded-xl border iq-line iq-surface px-3 py-3 font-mono text-sm"
                          spellCheck={false}
                          maxLength={8}
                          placeholder="IQ"
                        />
                      </label>
                      <label className="block min-w-0 text-sm">
                        Course code (3 letters)
                        <input
                          value={code}
                          onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3))}
                          className="mt-1 w-full rounded-xl border iq-line iq-surface px-3 py-3 font-mono text-sm"
                          spellCheck={false}
                          maxLength={3}
                          placeholder="PYT"
                        />
                      </label>
                      <label className="block min-w-0 text-sm">
                        Number digits
                        <input
                          type="number"
                          min={1}
                          max={8}
                          value={numberWidth}
                          onChange={(event) => setNumberWidth(Math.max(1, Math.min(8, Number(event.target.value) || 3)))}
                          className="mt-1 w-full rounded-xl border iq-line iq-surface px-3 py-3 font-mono text-sm"
                        />
                      </label>
                      <label className="block min-w-0 text-sm">
                        Start from number
                        <input
                          type="number"
                          min={1}
                          value={startNumber}
                          onChange={(event) => setStartNumber(Math.max(1, Number(event.target.value) || 1))}
                          className="mt-1 w-full rounded-xl border iq-line iq-surface px-3 py-3 font-mono text-sm"
                          placeholder="40"
                        />
                      </label>
                    </div>

                    <p className="mt-4 text-sm">
                      Next ID preview: <span className="break-all font-mono text-xs">{livePreview}</span>
                    </p>
                    <p className="mt-1 text-xs iq-muted">
                      The next certificate for this course uses this start number, then counts up (40, 41, 42…).
                    </p>

                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                      <button
                        type="button"
                        onClick={saveCourseId}
                        disabled={templateBusy || code.length !== 3}
                        className="w-fit rounded-full iq-accent-bg px-4 py-2 text-sm font-semibold disabled:opacity-50"
                      >
                        {templateBusy ? "Saving…" : "Save for this course"}
                      </button>
                      {selected.configured && (
                        <button
                          type="button"
                          onClick={cancelEdit}
                          disabled={templateBusy}
                          className="w-fit rounded-full border iq-line px-4 py-2 text-sm font-semibold disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      )}
                      {templateMsg && <p className="text-sm iq-muted">{templateMsg}</p>}
                      {templateErr && <p className="text-sm text-red-600">{templateErr}</p>}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {confirmEdit && selected && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setConfirmEdit(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-2xl border iq-line iq-surface p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-label="Confirm edit certificate ID"
          >
            <h3 className="text-lg font-semibold">Edit certificate ID?</h3>
            <p className="mt-2 text-sm iq-muted">
              You are about to change the saved ID format for <span className="font-semibold">{selected.title}</span>.
              Existing certificates keep their IDs. Only future certificates use the new format.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  setConfirmEdit(false);
                  setEditing(true);
                  setTemplateMsg("");
                  setTemplateErr("");
                }}
                className="rounded-full iq-accent-bg px-4 py-2 text-sm font-semibold"
              >
                Yes, edit
              </button>
              <button
                type="button"
                onClick={() => setConfirmEdit(false)}
                className="rounded-full border iq-line px-4 py-2 text-sm font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Issued certificates</h3>
          <p className="mt-1 text-sm iq-muted">Record of certificates already issued for your courses.</p>
        </div>
        <label className="block max-w-sm text-sm">
          Search by student, course, or certificate number
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="mt-1 w-full rounded-xl border iq-line iq-surface px-3 py-3"
          />
        </label>
        {status === "loading" && <p className="text-sm iq-muted">Loading issued certificates…</p>}
        {status === "error" && <p className="text-sm iq-muted">Certificates could not be loaded.</p>}
        {status === "ready" && shown.length === 0 && (
          <p className="rounded-2xl border iq-line iq-surface p-5 text-sm iq-muted">
            No certificates issued yet. They appear here when a student finishes the assessments and downloads one.
          </p>
        )}
        {shown.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border iq-line iq-surface">
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
                  <tr key={row.id} className="border-b iq-line last:border-b-0">
                    <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{row.credential_id}</td>
                    <td className="px-4 py-3">
                      {row.student}
                      <div className="text-xs iq-muted break-all">{row.email}</div>
                    </td>
                    <td className="px-4 py-3">{row.course}</td>
                    <td className="px-4 py-3 tabular-nums whitespace-nowrap">{row.issued_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Assessment files</h3>
          <p className="mt-1 text-sm iq-muted">Files students uploaded for a certificate stay on this server. Folder links open in a new tab.</p>
        </div>
        {assessments.length === 0 && <p className="text-sm iq-muted">No assessment submissions yet.</p>}
        {assessments.length > 0 && (
          <ul className="space-y-2">
            {assessments.map((item) => (
              <li
                key={`${item.course}-${item.email}-${item.submitted_at}-${item.file_name}`}
                className="flex flex-col gap-3 rounded-2xl border iq-line p-4 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-semibold">{item.student}</p>
                  <p className="iq-muted break-words">{item.course} · {item.submitted_at}</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-3">
                  {item.file_name && (
                    <button
                      type="button"
                      className="iq-link"
                      onClick={async () => {
                        const res = await axios.get(
                          `${API_BASE_URL}/instructor/assessments/file/${encodeURIComponent(item.file_name)}`,
                          { headers: authHeaders(), responseType: "blob" },
                        );
                        const link = document.createElement("a");
                        link.href = URL.createObjectURL(res.data);
                        link.download = item.file_name;
                        link.click();
                      }}
                    >
                      Download file
                    </button>
                  )}
                  {item.link && (
                    <a className="iq-link" href={item.link} target="_blank" rel="noreferrer">
                      Open link
                    </a>
                  )}
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
