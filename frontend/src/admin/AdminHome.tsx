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
  const [error, setError] = useState("");

  useEffect(() => {
    axios.get(`${API_BASE_URL}/admin/overview`, { headers: authHeaders() })
      .then((res) => setStats(res.data))
      .catch(() => setError("The overview could not be loaded. Sign in again if this session has expired."));
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
    <div className="space-y-6 text-slate-800">
      <div>
        <h2 className="text-2xl font-semibold">Overview</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">Counts come from this account: your courses, the students on the site, public watch lessons, and certificates already issued.</p>
      </div>
      {error && <p className="text-sm text-slate-600">{error}</p>}
      {!stats && !error && <p className="text-sm text-slate-500">Loading…</p>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(([label, value, href]) => (
          <Link key={String(label)} to={String(href)} className="rounded-2xl border border-slate-300 bg-white p-5">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
          </Link>
        ))}
      </div>
      <section className="rounded-2xl border border-slate-300 bg-white p-5">
        <h3 className="font-semibold">What students see</h3>
        <ul className="mt-3 space-y-2 text-sm text-slate-600">
          <li>Published courses appear in a student account after enrolment.</li>
          <li>Watch lessons play on the public homepage and in My courses.</li>
          <li>A certificate can be downloaded after the course assessments are submitted.</li>
        </ul>
      </section>
    </div>
  );
};

export default AdminHome;
