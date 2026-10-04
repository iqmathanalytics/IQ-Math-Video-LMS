import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import API_BASE_URL from "../config";
import { getValidSession } from "../utils/session";
import CourseCover from "../components/CourseCover";

type UploadedCourse = {
  id: number;
  title: string;
  description?: string;
  price: number;
  image_url?: string | null;
  is_published?: boolean;
  course_type?: string | null;
  language?: string | null;
  modules: number;
  lessons: number;
};

const headers = () => {
  const session = getValidSession();
  return session?.token ? { Authorization: `Bearer ${session.token}` } : {};
};

const CourseDesk = () => {
  const [courses, setCourses] = useState<UploadedCourse[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<UploadedCourse | null>(null);

  const load = () => {
    setStatus("loading");
    axios.get(`${API_BASE_URL}/courses`, { headers: headers() })
      .then((res) => {
        setCourses(Array.isArray(res.data) ? res.data : []);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  };

  useEffect(() => { load(); }, []);

  const shown = useMemo(() => courses.filter((course) => {
    const text = `${course.title} ${course.description || ""}`.toLowerCase();
    if (query.trim() && !text.includes(query.trim().toLowerCase())) return false;
    if (filter === "Published" && !course.is_published) return false;
    if (filter === "Hidden" && course.is_published) return false;
    return true;
  }), [courses, query, filter]);

  const setPublished = async (course: UploadedCourse, isPublished: boolean) => {
    setBusyId(course.id);
    setMessage("");
    try {
      await axios.patch(`${API_BASE_URL}/courses/${course.id}/publish`, { is_published: isPublished }, { headers: headers() });
      setCourses((rows) => rows.map((row) => row.id === course.id ? { ...row, is_published: isPublished } : row));
      setMessage(isPublished ? `${course.title} is on every student account.` : `${course.title} is hidden from learners.`);
    } catch {
      setMessage("That change was not saved.");
    } finally {
      setBusyId(0);
    }
  };

  const remove = async (course: UploadedCourse) => {
    setBusyId(course.id);
    setMessage("");
    try {
      await axios.delete(`${API_BASE_URL}/courses/${course.id}`, { headers: headers() });
      setCourses((rows) => rows.filter((row) => row.id !== course.id));
      setPendingDelete(null);
      setMessage(`${course.title} was removed.`);
    } catch {
      setMessage("This course could not be removed. Enrolled learners may still be attached to it.");
    } finally {
      setBusyId(0);
    }
  };

  return (
    <div className="min-h-full" style={{ fontFamily: "Inter, sans-serif" }}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] iq-faint">Admin</p>
          <h2 className="mt-1 text-3xl font-semibold" style={{ fontFamily: '"Space Grotesk", Inter, sans-serif' }}>Uploaded courses</h2>
          <p className="mt-2 max-w-2xl text-sm iq-muted">Courses already saved on this site. Open one to edit its modules and YouTube lessons, or publish it so learners can see it.</p>
        </div>
        <Link to="/dashboard/create-course" className="iq-btn iq-btn-primary">Add a course</Link>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search uploaded courses" className="w-full max-w-sm rounded-xl border iq-line iq-surface px-3 py-3 text-sm" />
        <select value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-xl border iq-line iq-surface px-3 py-3 text-sm" aria-label="Visibility">
          <option>All</option>
          <option>Published</option>
          <option>Hidden</option>
        </select>
      </div>

      {status === "loading" && <p className="mt-6 text-sm iq-muted">Loading uploaded courses…</p>}
      {status === "error" && <p className="mt-6 text-sm iq-muted">The course list could not be loaded. Sign in again if this session has expired.</p>}
      {status === "ready" && shown.length === 0 && <p className="mt-6 rounded-2xl border iq-line p-5 text-sm iq-muted">No uploaded courses match that search.</p>}

      <ul className="mt-6 grid gap-4 md:grid-cols-2">
        {shown.map((course) => (
          <li key={course.id} className="overflow-hidden rounded-2xl border iq-line iq-surface">
            <CourseCover title={course.title} imageUrl={course.image_url} className="rounded-none" />
            <div className="p-4">
            <p className="text-xs uppercase tracking-[0.14em] iq-faint">
              {course.is_published ? "Published" : "Hidden"} · {Number(course.price) > 0 ? `₹${course.price}` : "Free"} · {course.modules} modules · {course.lessons} lessons
            </p>
            <h3 className="mt-2 text-xl font-semibold">{course.title}</h3>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Link to={`/dashboard/course/${course.id}/builder`} className="iq-btn iq-btn-primary w-full">Edit lessons</Link>
              <Link to={`/dashboard/course/${course.id}/recordings`} className="iq-btn iq-btn-line w-full">Recordings</Link>
              <button type="button" disabled={busyId === course.id} onClick={() => setPublished(course, !course.is_published)} className="iq-btn iq-btn-line w-full">
                {course.is_published ? "Hide" : "Publish"}
              </button>
              <button type="button" disabled={busyId === course.id} onClick={() => setPendingDelete(course)} className="iq-btn iq-btn-danger w-full">Remove</button>
            </div>
            </div>
          </li>
        ))}
      </ul>
      {message && <p className="mt-4 text-sm iq-muted">{message}</p>}

      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setPendingDelete(null)}>
          <div className="w-full max-w-md rounded-2xl border iq-line iq-surface p-5" onClick={(event) => event.stopPropagation()} role="dialog" aria-label="Remove course">
            <h3 className="text-lg font-semibold">Remove {pendingDelete.title}?</h3>
            <p className="mt-2 text-sm iq-muted">This deletes the course and its modules from the site.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" disabled={busyId === pendingDelete.id} onClick={() => remove(pendingDelete)} className="iq-btn iq-btn-danger">{busyId === pendingDelete.id ? "Removing…" : "Remove course"}</button>
              <button type="button" onClick={() => setPendingDelete(null)} className="iq-btn iq-btn-line">Keep it</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CourseDesk;
