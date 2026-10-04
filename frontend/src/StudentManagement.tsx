import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import API_BASE_URL from './config';
import { Trash2, User, AlertCircle, X, Calendar, CheckCircle, AlertTriangle, RefreshCw, Key, ChevronDown, ChevronUp } from "lucide-react";

interface Student {
  id: number;
  full_name: string;
  email: string;
  phone_number?: string | null;
  college?: string | null;
  organization?: string | null;
  social_media_link?: string | null;
  joined_at: string;
  enrolled_courses: string[];
}

interface Course {
  id: number;
  title: string;
}

const StudentManagement = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCollege, setFilterCollege] = useState("");
  const [filterOrganization, setFilterOrganization] = useState("");
  const [assignCollege, setAssignCollege] = useState("");
  const [assignOrganization, setAssignOrganization] = useState("");
  const [assignCourseId, setAssignCourseId] = useState("");
  const [assignBusy, setAssignBusy] = useState(false);
  const [expandedCourses, setExpandedCourses] = useState<Set<number>>(new Set());

  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [resetModal, setResetModal] = useState<{ id: number, name: string } | null>(null);
  const [newPass, setNewPass] = useState("");
  const [toast, setToast] = useState<{ show: boolean; message: string; type: "success" | "error" }>({
    show: false, message: "", type: "success"
  });

  const brand = {
    blue: "var(--iq-accent)",
    textMain: "var(--iq-text)",
    textLight: "var(--iq-muted)",
    cardBg: "var(--iq-surface)",
    border: "var(--iq-border)",
    danger: "#ef4444",
    green: "var(--iq-accent)",
    onAccent: "var(--iq-accent-ink)",
  };

  const triggerToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
  };

  const authHeaders = () => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchStudents = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/admin/students`, { headers: authHeaders() });
      setStudents(Array.isArray(res.data) ? res.data : []);
    } catch {
      setStudents([]);
      triggerToast("Failed to load students.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
    axios.get(`${API_BASE_URL}/courses`, { headers: authHeaders() })
      .then((res) => setCourses(Array.isArray(res.data) ? res.data : []))
      .catch(() => setCourses([]));
  }, []);

  const collegeOptions = useMemo(() => {
    const values = new Set<string>();
    students.forEach((student) => {
      if (student.college?.trim()) values.add(student.college.trim());
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [students]);

  const organizationOptions = useMemo(() => {
    const values = new Set<string>();
    students.forEach((student) => {
      if (student.organization?.trim()) values.add(student.organization.trim());
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [students]);

  const handleDelete = async () => {
    if (!studentToDelete) return;
    try {
      await axios.delete(`${API_BASE_URL}/admin/students/${studentToDelete.id}`, { headers: authHeaders() });
      setStudents(students.filter(s => s.id !== studentToDelete.id));
      setStudentToDelete(null);
      triggerToast("Student removed successfully.", "success");
    } catch {
      triggerToast("Failed to remove student.", "error");
    }
  };

  const handleResetPassword = async () => {
    if (!resetModal || newPass.length < 8) {
      triggerToast("Use at least 8 characters.", "error");
      return;
    }
    try {
      await axios.patch(
        `${API_BASE_URL}/admin/students/${resetModal.id}/reset-password`,
        { new_password: newPass },
        { headers: authHeaders() }
      );
      triggerToast("Password reset successfully!", "success");
      setResetModal(null);
      setNewPass("");
    } catch {
      triggerToast("Failed to reset password.", "error");
    }
  };

  const toggleCourseList = (studentId: number) => {
    setExpandedCourses((current) => {
      const next = new Set(current);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  const handleAssign = async () => {
    const courseId = Number(assignCourseId);
    if (!courseId) {
      triggerToast("Select a course to assign.", "error");
      return;
    }
    if (!assignCollege.trim() && !assignOrganization.trim()) {
      triggerToast("Select a college or organization.", "error");
      return;
    }
    setAssignBusy(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/admin/assign-courses`, {
        course_ids: [courseId],
        college: assignCollege.trim() || undefined,
        organization: assignOrganization.trim() || undefined,
      }, { headers: authHeaders() });
      triggerToast(res.data?.message || "Courses assigned.", "success");
      setAssignCollege("");
      setAssignOrganization("");
      setAssignCourseId("");
      await fetchStudents();
    } catch (err: unknown) {
      const detail = axios.isAxiosError(err) ? err.response?.data?.detail : "";
      triggerToast(typeof detail === "string" && detail ? detail : "Assignment failed.", "error");
    } finally {
      setAssignBusy(false);
    }
  };

  const filteredStudents = students.filter((s) => {
    if (filterCollege && (s.college || "").trim() !== filterCollege) return false;
    if (filterOrganization && (s.organization || "").trim() !== filterOrganization) return false;
    return true;
  });

  return (
    <div style={{ padding: "40px", maxWidth: "1200px", margin: "0 auto", position: "relative" }}>
      <div className="mb-8">
        <h1 style={{ fontSize: "28px", fontWeight: "800", color: brand.textMain, margin: 0 }}>Student Management</h1>
        <p style={{ color: brand.textLight, marginTop: "5px" }}>View profiles and assign courses by college or organization.</p>
      </div>

      <div style={{ background: brand.cardBg, borderRadius: "16px", border: `1px solid ${brand.border}`, padding: "24px", marginBottom: "24px" }}>
        <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: brand.textMain }}>Assign courses</h2>
        <p style={{ marginTop: "6px", color: brand.textLight, fontSize: "14px" }}>
          Choose a college and/or organization, pick one course, then assign it to every matching student.
        </p>
        <div className="grid gap-4 md:grid-cols-3 mt-4">
          <label style={{ display: "block", fontSize: "13px", color: brand.textLight }}>
            College
            <select
              value={assignCollege}
              onChange={(e) => setAssignCollege(e.target.value)}
              style={{ width: "100%", marginTop: "6px", padding: "10px", borderRadius: "10px", border: `1px solid ${brand.border}`, background: "var(--iq-inset)", color: brand.textMain }}
            >
              <option value="">Select college</option>
              {collegeOptions.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label style={{ display: "block", fontSize: "13px", color: brand.textLight }}>
            Organization
            <select
              value={assignOrganization}
              onChange={(e) => setAssignOrganization(e.target.value)}
              style={{ width: "100%", marginTop: "6px", padding: "10px", borderRadius: "10px", border: `1px solid ${brand.border}`, background: "var(--iq-inset)", color: brand.textMain }}
            >
              <option value="">Select organization</option>
              {organizationOptions.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label style={{ display: "block", fontSize: "13px", color: brand.textLight }}>
            Course
            <select
              value={assignCourseId}
              onChange={(e) => setAssignCourseId(e.target.value)}
              style={{ width: "100%", marginTop: "6px", padding: "10px", borderRadius: "10px", border: `1px solid ${brand.border}`, background: "var(--iq-inset)", color: brand.textMain }}
            >
              <option value="">Select course</option>
              {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
            </select>
          </label>
        </div>
        <button
          type="button"
          disabled={assignBusy}
          onClick={() => void handleAssign()}
          style={{
            marginTop: "16px",
            padding: "12px 18px",
            borderRadius: "999px",
            border: "none",
            background: brand.blue,
            color: brand.onAccent,
            fontWeight: 700,
            cursor: "pointer",
            opacity: assignBusy ? 0.7 : 1,
          }}
        >
          {assignBusy ? "Assigning…" : "Assign to matching students"}
        </button>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={filterCollege}
          onChange={(e) => setFilterCollege(e.target.value)}
          style={{ padding: "10px 12px", borderRadius: "10px", border: `1px solid ${brand.border}`, background: brand.cardBg, color: brand.textMain }}
        >
          <option value="">All colleges</option>
          {collegeOptions.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select
          value={filterOrganization}
          onChange={(e) => setFilterOrganization(e.target.value)}
          style={{ padding: "10px 12px", borderRadius: "10px", border: `1px solid ${brand.border}`, background: brand.cardBg, color: brand.textMain }}
        >
          <option value="">All organizations</option>
          {organizationOptions.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>

      <div style={{ background: brand.cardBg, borderRadius: "16px", border: `1px solid ${brand.border}`, overflow: "hidden", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)" }}>
        <div className="overflow-x-auto">
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", minWidth: "980px" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${brand.border}`, color: brand.textLight, fontSize: "12px", textTransform: "uppercase" }}>
                <th style={{ padding: "20px", fontWeight: "700" }}>Student</th>
                <th style={{ padding: "20px", fontWeight: "700" }}>College / Org</th>
                <th style={{ padding: "20px", fontWeight: "700" }}>Mobile</th>
                <th style={{ padding: "20px", fontWeight: "700" }}>Joined</th>
                <th style={{ padding: "20px", fontWeight: "700" }}>Password</th>
                <th style={{ padding: "20px", fontWeight: "700" }}>Enrolled Courses</th>
                <th style={{ padding: "20px", fontWeight: "700", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ padding: "40px", textAlign: "center", color: brand.textLight }}>Loading data...</td></tr>
              ) : filteredStudents.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: "40px", textAlign: "center", color: brand.textLight }}>No students found.</td></tr>
              ) : (
                filteredStudents.map(student => (
                  <tr key={student.id} style={{ borderBottom: `1px solid ${brand.border}`, background: "var(--iq-surface)" }}>
                    <td style={{ padding: "20px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "var(--iq-inset)", color: brand.blue, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <User size={18} />
                        </div>
                        <div>
                          <div style={{ fontWeight: "700", color: brand.textMain }}>{student.full_name}</div>
                          <div style={{ fontSize: "12px", color: brand.textLight }}>{student.email}</div>
                          {student.social_media_link && (
                            <a href={student.social_media_link} target="_blank" rel="noreferrer" style={{ fontSize: "12px", color: brand.blue }}>Social link</a>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "20px", color: brand.textLight, fontSize: "13px" }}>
                      <div>{student.college || "—"}</div>
                      <div style={{ marginTop: "4px" }}>{student.organization || "—"}</div>
                    </td>
                    <td style={{ padding: "20px", color: brand.textLight, fontSize: "14px" }}>{student.phone_number || "—"}</td>
                    <td style={{ padding: "20px", color: brand.textLight, fontSize: "14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <Calendar size={14} /> {student.joined_at || "N/A"}
                      </div>
                    </td>
                    <td style={{ padding: "20px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ color: brand.textLight, fontSize: "18px", letterSpacing: "2px", lineHeight: "0" }}>••••••</span>
                        <button
                          onClick={() => setResetModal({ id: student.id, name: student.full_name })}
                          style={{ padding: "6px", background: "var(--iq-inset)", color: brand.blue, border: `1px solid ${brand.border}`, borderRadius: "6px", cursor: "pointer" }}
                          title="Reset Password"
                        >
                          <RefreshCw size={14} />
                        </button>
                      </div>
                    </td>
                    <td style={{ padding: "20px" }}>
                      {student.enrolled_courses.length === 0 ? (
                        <span style={{ fontSize: "12px", color: brand.textLight, fontStyle: "italic" }}>Not enrolled</span>
                      ) : (
                        <div>
                          <button
                            type="button"
                            onClick={() => toggleCourseList(student.id)}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              padding: "6px 10px",
                              borderRadius: "999px",
                              border: `1px solid ${brand.border}`,
                              background: "var(--iq-inset)",
                              color: brand.textMain,
                              fontSize: "12px",
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                            aria-expanded={expandedCourses.has(student.id)}
                          >
                            {expandedCourses.has(student.id) ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            {expandedCourses.has(student.id)
                              ? "Hide courses"
                              : `${student.enrolled_courses.length} course${student.enrolled_courses.length === 1 ? "" : "s"}`}
                          </button>
                          {expandedCourses.has(student.id) && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "10px" }}>
                              {student.enrolled_courses.map((c, i) => (
                                <span key={i} style={{ fontSize: "11px", background: "var(--iq-inset)", padding: "4px 8px", borderRadius: "4px", color: brand.textMain, border: `1px solid ${brand.border}` }}>
                                  {c}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "20px", textAlign: "right" }}>
                      <button
                        onClick={() => setStudentToDelete(student)}
                        style={{ padding: "8px", background: "rgba(239, 68, 68, 0.12)", color: brand.danger, border: "1px solid rgba(239, 68, 68, 0.35)", borderRadius: "8px", cursor: "pointer" }}
                        title="Remove Student"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {studentToDelete && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15, 23, 42, 0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "var(--iq-surface)", padding: "30px", borderRadius: "16px", width: "400px", textAlign: "center" }}>
            <div style={{ width: "50px", height: "50px", background: "rgba(239, 68, 68, 0.12)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px auto" }}>
              <AlertCircle size={28} color={brand.danger} />
            </div>
            <h3 style={{ margin: "0 0 10px 0", color: brand.textMain, fontSize: "20px", fontWeight: "800" }}>Remove Student?</h3>
            <p style={{ color: brand.textLight, fontSize: "14px", marginBottom: "24px" }}>
              Remove <strong>{studentToDelete.full_name}</strong>? This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: "12px" }}>
              <button onClick={() => setStudentToDelete(null)} style={{ flex: 1, padding: "12px", background: "var(--iq-surface)", border: `1px solid ${brand.border}`, borderRadius: "8px", fontWeight: "700", color: brand.textLight, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleDelete} style={{ flex: 1, padding: "12px", background: brand.danger, border: "none", borderRadius: "8px", fontWeight: "700", color: "white", cursor: "pointer" }}>Yes, Remove</button>
            </div>
          </div>
        </div>
      )}

      {resetModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15, 23, 42, 0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "var(--iq-surface)", padding: "30px", borderRadius: "16px", width: "400px", textAlign: "center" }}>
            <div style={{ width: "50px", height: "50px", background: "var(--iq-inset)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px auto" }}>
              <Key size={24} color={brand.blue} />
            </div>
            <h3 style={{ margin: "0 0 10px 0", color: brand.textMain, fontSize: "20px", fontWeight: "800" }}>Reset Password</h3>
            <p style={{ color: brand.textLight, fontSize: "14px", marginBottom: "20px" }}>
              Set a new password for <strong>{resetModal.name}</strong>.
            </p>
            <input
              type="text"
              placeholder="Enter new password..."
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              style={{ width: "100%", padding: "12px", borderRadius: "8px", border: `2px solid ${brand.border}`, marginBottom: "20px", outline: "none", fontWeight: "bold", color: brand.textMain, background: "var(--iq-inset)" }}
            />
            <div style={{ display: "flex", gap: "12px" }}>
              <button onClick={() => { setResetModal(null); setNewPass(""); }} style={{ flex: 1, padding: "12px", background: "var(--iq-surface)", border: `1px solid ${brand.border}`, borderRadius: "8px", fontWeight: "700", color: brand.textLight, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleResetPassword} disabled={!newPass} style={{ flex: 1, padding: "12px", background: brand.blue, border: "none", borderRadius: "8px", fontWeight: "700", color: brand.onAccent, cursor: "pointer", opacity: newPass ? 1 : 0.7 }}>Update</button>
            </div>
          </div>
        </div>
      )}

      {toast.show && (
        <div style={{
          position: "fixed", top: "20px", right: "20px",
          background: "var(--iq-surface)", padding: "16px 24px", borderRadius: "12px",
          boxShadow: "0 10px 30px -5px rgba(0,0,0,0.15)",
          borderLeft: `6px solid ${toast.type === "success" ? brand.green : "#ef4444"}`,
          display: "flex", alignItems: "center", gap: "12px", zIndex: 9999,
        }}>
          {toast.type === "success" ? <CheckCircle size={24} color={brand.green} /> : <AlertTriangle size={24} color="#ef4444" />}
          <div>
            <h4 style={{ margin: "0", fontSize: "14px", fontWeight: "700", color: brand.textMain }}>
              {toast.type === "success" ? "Success" : "Error"}
            </h4>
            <p style={{ margin: 0, fontSize: "13px", color: brand.textLight }}>{toast.message}</p>
          </div>
          <button onClick={() => setToast(prev => ({ ...prev, show: false }))} style={{ background: "none", border: "none", cursor: "pointer", marginLeft: "10px", color: "var(--iq-faint)" }}>
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

export default StudentManagement;
