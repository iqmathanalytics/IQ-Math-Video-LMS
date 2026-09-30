import { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import axios from "axios";
import { FileText,  PlusCircle, BookOpen, Trash2, CheckCircle,  X, AlertTriangle } from "lucide-react"; // ✅ Added Icons
import API_BASE_URL from './config';
import AdminLogin from "./AdminLogin";
import LearnerAuth from "./learner/LearnerAuth";
import LandingPage from "./LandingPage";
import { ContactPage, DesignPage, PricingPage } from "./public/SitePages"; 
import DashboardLayout from "./DashboardLayout";
import CreateCourse from "./CreateCourse";
import CourseBuilder from "./CourseBuilder";
import AssignmentManager from "./AssignmentManager"; 
import CoursePlayer from "./CoursePlayer"; 
import AddAdmits from "./AddAdmits"; 
import CoursePreview from "./CoursePreview";
import CodeArena from "./CodeArena"; 
import AdminHome from "./admin/AdminHome";
import CertificateDesk from "./admin/CertificateDesk";
import ProgramDesk from "./admin/ProgramDesk";
import { RecordingAdmin, RecordingLibrary, RecordingPlayer } from "./recordings/Recordings"; 
import InstructorSettings from "./InstructorSettings"; 
import StudentManagement from "./StudentManagement";
import Messages from "./Messages";
import WatchManager from "./WatchManager";
import { Assessments, CertificatePage, CourseDashboard, LearnPage, MyCourses, Notebook, StudentSettings, StudentShell } from "./student/StudentStudio";
import { CertificateGallery, CourseCatalog, ProfilePage, ProgramBoard, StudentHome } from "./student/StudentHub";
import CodingCourseManager from "./CodingCourseManager";
import { clearSession, getValidSession } from "./utils/session";
// --- Modified CourseList Component ---
const CourseList = () => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // ✅ NEW: Toast State for Professional Notifications
  const [toast, setToast] = useState<{ show: boolean; message: string; type: "success" | "error" }>({ 
    show: false, message: "", type: "success" 
  });

  const triggerToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
  };

  useEffect(() => {
    const fetchCourses = async () => {
      const session = getValidSession();
      if (!session?.token) { setLoading(false); return; }
      try {
        const res = await axios.get(`${API_BASE_URL}/courses`, { headers: { Authorization: `Bearer ${session.token}` } });
        setCourses(res.data);
      } catch (err: any) {
        if (err.response?.status === 401) { clearSession(); window.location.href = "/"; }
      } finally { setLoading(false); }
    };
    fetchCourses();
  }, []);

  // ✅ UPDATED: Handle Delete Course with Toast Feedback
  const handleDeleteCourse = async (e: React.MouseEvent, courseId: number) => {
    e.stopPropagation(); 
    
    // Note: For critical deletes, a native confirm is acceptable, 
    // but the Success/Failure messages must be professional Toasts.
    if (!window.confirm("Are you sure you want to delete this course? This cannot be undone.")) return;

    try {
        const token = localStorage.getItem("token");
        await axios.delete(`${API_BASE_URL}/courses/${courseId}`, {
         headers: { Authorization: `Bearer ${token}` }
        });
        
        // Remove from UI immediately
        setCourses(courses.filter((c: any) => c.id !== courseId));
        
        // ✅ Professional Success Message
        triggerToast("Course deleted successfully!", "success");
    } catch (err) {
        // ✅ Professional Error Message (Replaced Alert)
        triggerToast("Failed to delete course. Ensure no students are enrolled.", "error");
    }
  };

  if (loading) return <div style={{ padding: "40px", textAlign: "center" }}>Loading...</div>;
  
  return (
    <div style={{ animation: "fadeIn 0.5s ease", position: "relative" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
        <div>
            <h2 style={{ fontSize: "24px", fontWeight: "700", color: "#1e293b", margin: 0 }}>My Courses</h2>
            <p style={{ color: "#64748b", margin: "4px 0 0 0" }}>Manage your curriculum.</p>
        </div>
        <button onClick={() => navigate("/dashboard/create-course")} style={{ display: "flex", alignItems: "center", gap: "8px", background: "#005EB8", color: "white", padding: "12px 20px", borderRadius: "10px", border: "none", fontWeight: "600", cursor: "pointer" }}><PlusCircle size={18} /> Create New Course</button>
      </div>
      
      {courses.length === 0 ? ( 
        <div style={{ textAlign: "center", padding: "80px", background: "white", borderRadius: "16px", border: "1px solid #e2e8f0" }}>
            <BookOpen size={48} color="#cbd5e1" style={{ marginBottom: "16px" }} />
            <h3 style={{ color: "#1e293b", margin: "0 0 8px 0" }}>No courses found</h3>
        </div> 
      ) : ( 
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "24px" }}>
            {courses.map((course: any) => (
                <div key={course.id} style={{ background: "white", borderRadius: "16px", border: "1px solid #e2e8f0", overflow: "hidden", cursor: "pointer", transition: "transform 0.2s", position: "relative" }} onClick={() => navigate(`/dashboard/course/${course.id}/builder`)}>
                    <div style={{ height: "160px", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {course.image_url ? <img src={course.image_url} alt={course.title} style={{width:"100%", height:"100%", objectFit:"cover"}} /> : <FileText size={48} color="#cbd5e1" />}
                    </div>
                    
                    <div style={{ padding: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <h4 style={{ margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "80%" }}>{course.title}</h4>
                        
                        <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/course/${course.id}/recordings`); }}
                            style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "8px", padding: "8px 10px", cursor: "pointer", color: "#005EB8", fontSize: "12px", fontWeight: 700 }}
                        >Recordings</button>
                        <button 
                            onClick={(e) => handleDeleteCourse(e, course.id)}
                            style={{ 
                                background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "8px", 
                                padding: "8px", cursor: "pointer", color: "#EF4444", display: "flex", alignItems: "center", justifyContent: "center"
                            }}
                            title="Delete Course"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                </div>
            ))}
        </div> 
      )}

      {/* ✅ TOAST NOTIFICATION COMPONENT */}
      {toast.show && (
        <div style={{ 
            position: "fixed", top: "20px", right: "20px", 
            background: "white", padding: "16px 24px", borderRadius: "12px", 
            boxShadow: "0 10px 30px -5px rgba(0,0,0,0.15)", 
            borderLeft: `6px solid ${toast.type === "success" ? "#87C232" : "#ef4444"}`,
            display: "flex", alignItems: "center", gap: "12px", zIndex: 9999,
            animation: "slideIn 0.3s ease-out"
        }}>
            {toast.type === "success" ? <CheckCircle size={24} color="#87C232" /> : <AlertTriangle size={24} color="#ef4444" />}
            <div>
                <h4 style={{ margin: "0", fontSize: "14px", fontWeight: "700", color: "#1e293b" }}>
                    {toast.type === "success" ? "Success" : "Error"}
                </h4>
                <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>{toast.message}</p>
            </div>
            <button onClick={() => setToast(prev => ({ ...prev, show: false }))} style={{ background: "none", border: "none", cursor: "pointer", marginLeft: "10px", color: "#94a3b8" }}>
                <X size={16} />
            </button>
        </div>
      )}
    </div>
  );
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/design" element={<DesignPage />} />
        <Route path="/login" element={<PublicOnlyRoute><LearnerAuth /></PublicOnlyRoute>} />
        <Route path="/signup" element={<PublicOnlyRoute><LearnerAuth /></PublicOnlyRoute>} />
        <Route path="/forgot-password" element={<PublicOnlyRoute><LearnerAuth /></PublicOnlyRoute>} />
        <Route path="/admin-login" element={<PublicOnlyRoute><AdminLogin /></PublicOnlyRoute>} />

        <Route path="/dashboard" element={<ProtectedRoute requiredRole="instructor"><DashboardLayout /></ProtectedRoute>}>
          <Route index element={<AdminHome />} />
          <Route path="courses" element={<CourseList />} />
          <Route path="certificates" element={<CertificateDesk />} />
          <Route path="programs" element={<ProgramDesk />} />
          <Route path="watch" element={<WatchManager />} />
          <Route path="create-course" element={<CreateCourse />} />
          <Route path="course/:courseId/builder" element={<CourseBuilder />} />
          <Route path="course/:courseId/recordings" element={<RecordingAdmin />} />
          <Route path="assignments" element={<AssignmentManager />} />
          <Route path="add-admits" element={<AddAdmits />} />
          <Route path="course/:courseId/preview" element={<CodingCourseManager />} />
          <Route path="course/:courseId/CoursePreview" element={<CoursePreview />} />
          <Route path="code-arena" element={<CodeArena />} />
          <Route path="students" element={<StudentManagement />} />
          <Route path="settings" element={<InstructorSettings />} />
          <Route path="messages" element={<Messages />} />
        </Route>
        
        <Route element={<ProtectedRoute requiredRole="student"><StudentShell /></ProtectedRoute>}>
          <Route path="/home" element={<StudentHome />} />
          <Route path="/courses" element={<CourseCatalog />} />
          <Route path="/events" element={<ProgramBoard kind="event" />} />
          <Route path="/hackathons" element={<ProgramBoard kind="hackathon" />} />
          <Route path="/competitions" element={<ProgramBoard kind="competition" />} />
          <Route path="/certificates" element={<CertificateGallery />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/my-courses" element={<MyCourses />} />
          <Route path="/my-courses/:courseId" element={<CourseDashboard />} />
          <Route path="/my-courses/:courseId/recordings" element={<RecordingLibrary />} />
          <Route path="/my-courses/:courseId/recordings/:recordingId" element={<RecordingPlayer />} />
          <Route path="/my-courses/:courseId/notes" element={<Notebook />} />
          <Route path="/my-courses/:courseId/assessments" element={<Assessments />} />
          <Route path="/my-courses/:courseId/certificate" element={<CertificatePage />} />
          <Route path="/learn/:courseId/:lessonId" element={<LearnPage />} />
          <Route path="/settings" element={<StudentSettings />} />
        </Route>
        <Route path="/student-dashboard" element={<Navigate to="/home" replace />} />
        <Route path="/course/:courseId/player" element={<ProtectedRoute requiredRole="student"><CoursePlayer /></ProtectedRoute>} />
        <Route path="*" element={<FallbackRoute />} />
      </Routes>
    </Router>
  );
}

const ProtectedRoute = ({ children, requiredRole }: { children: any, requiredRole?: string }) => {
  const session = getValidSession();
  if (!session?.token) return <Navigate to={requiredRole === "instructor" ? "/admin-login" : "/login"} replace />;
  if (requiredRole && session.role !== requiredRole) {
    return session.role === "instructor" ? <Navigate to="/dashboard" /> : <Navigate to="/student-dashboard" />;
  }
  return children;
};

const PublicOnlyRoute = ({ children }: { children: any }) => {
  const session = getValidSession();
  if (!session?.token) return children;
  return session.role === "instructor" ? <Navigate to="/dashboard" replace /> : <Navigate to="/student-dashboard" replace />;
};

const FallbackRoute = () => {
  const session = getValidSession();
  if (!session?.token) return <Navigate to="/" replace />;
  return session.role === "instructor" ? <Navigate to="/dashboard" replace /> : <Navigate to="/student-dashboard" replace />;
};

export default App;