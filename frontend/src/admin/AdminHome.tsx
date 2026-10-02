import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import API_BASE_URL from "../config";

type Overview = {
  courses: number;
  published: number;
  students: number;
  enrolments: number;
  certificates: number;
  watch_lessons: number;
};

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

const AdminHome = () => {
  const [stats, setStats] = useState<Overview | null>(null);
  const [live, setLive] = useState<{ id: number; topic: string }[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    axios.get(`${API_BASE_URL}/admin/overview`, { headers: authHeaders() })
      .then((res) => setStats(res.data))
      .catch(() => setError("The overview could not be loaded. Sign in again if this session has expired."));
    axios.get(`${API_BASE_URL}/live/active`, { headers: authHeaders() })
      .then((res) => setLive(Array.isArray(res.data) ? res.data : []))
      .catch(() => setLive([]));
  }, []);

  const cards = stats
    ? [
        ["Students", stats.students, "/dashboard/students"],
        ["Enrolments", stats.enrolments, "/dashboard/students"],
        ["Courses", stats.courses, "/dashboard/courses"],
        ["Published", stats.published, "/dashboard/courses"],
        ["Watch lessons", stats.watch_lessons, "/dashboard/watch"],
        ["Certificates issued", stats.certificates, "/dashboard/certificates"],
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold" style={{ fontFamily: '"Space Grotesk", Inter, sans-serif' }}>Overview</h2>
        <p className="mt-1 max-w-2xl text-sm iq-muted">Counts cover every course on the site, the students, watch lessons, and certificates already issued.</p>
      </div>
      {error && <p className="text-sm iq-muted">{error}</p>}
      {!stats && !error && <p className="text-sm iq-muted">Loading…</p>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(([label, value, href]) => (
          <Link key={String(label)} to={String(href)} className="rounded-2xl border iq-line iq-surface p-5">
            <p className="text-sm iq-muted">{label}</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
          </Link>
        ))}
      </div>
      <section className="rounded-2xl border iq-line iq-surface p-5">
        <h3 className="font-semibold">Live class</h3>
        {live.length === 0 && <p className="mt-2 text-sm iq-muted">No class is live.</p>}
        <ul className="mt-3 space-y-2 text-sm">
          {live.map((session) => (
            <li key={session.id} className="flex items-center justify-between gap-3">
              <span>{session.topic}</span>
              <button type="button" className="iq-link" onClick={async () => {
                await axios.post(`${API_BASE_URL}/live/end/${session.id}`, {}, { headers: authHeaders() });
                setLive((rows) => rows.filter((row) => row.id !== session.id));
              }}>End</button>
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-2xl border iq-line iq-surface p-5">
        <h3 className="font-semibold">What students see</h3>
        <ul className="mt-3 space-y-2 text-sm iq-muted">
          <li>Publishing a course shows it in the catalogue. A learner joins it from that list, or from an instructor admission.</li>
          <li>Watch lessons stay on IQNex. Students open their courses after they sign in.</li>
          <li>A certificate can be downloaded after the course assessments are submitted.</li>
        </ul>
      </section>
    </div>
  );
};

export default AdminHome;
