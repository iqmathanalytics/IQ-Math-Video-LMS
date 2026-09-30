import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
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
import CourseDesk from "./admin/CourseDesk";
import CertificateDesk from "./admin/CertificateDesk";
import { RecordingAdmin, RecordingLibrary, RecordingPlayer } from "./recordings/Recordings"; 
import InstructorSettings from "./InstructorSettings"; 
import StudentManagement from "./StudentManagement";
import Messages from "./Messages";
import WatchManager from "./WatchManager";
import { Assessments, CertificatePage, CourseDashboard, LearnPage, MyCourses, Notebook, StudentSettings, StudentShell } from "./student/StudentStudio";
import { CertificateGallery, CourseCatalog, ProfilePage, StudentHome } from "./student/StudentHub";
import CodingCourseManager from "./CodingCourseManager";
import { getValidSession } from "./utils/session";

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
          <Route path="courses" element={<CourseDesk />} />
          <Route path="certificates" element={<CertificateDesk />} />
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