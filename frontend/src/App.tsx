import { lazy, Suspense, type ComponentType, type ReactNode } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import LandingPage from "./LandingPage";
import { getValidSession } from "./utils/session";

const hold = (node: ReactNode) => <Suspense fallback={<div className="min-h-screen" />}>{node}</Suspense>;
const view = <T,>(load: () => Promise<T>, pick: (mod: T) => ComponentType) => lazy(async () => ({ default: pick(await load()) }));

const AdminLogin = view(() => import("./AdminLogin"), (mod) => mod.default);
const LearnerAuth = view(() => import("./learner/LearnerAuth"), (mod) => mod.default);
const SitePages = () => import("./public/SitePages");
const ContactPage = view(SitePages, (mod) => mod.ContactPage);
const DesignPage = view(SitePages, (mod) => mod.DesignPage);
const PricingPage = view(SitePages, (mod) => mod.PricingPage);
const SharedCourse = view(() => import("./public/SharedCourse"), (mod) => mod.default);
const DashboardLayout = view(() => import("./DashboardLayout"), (mod) => mod.default);
const CreateCourse = view(() => import("./CreateCourse"), (mod) => mod.default);
const CourseBuilder = view(() => import("./CourseBuilder"), (mod) => mod.default);
const AssignmentManager = view(() => import("./AssignmentManager"), (mod) => mod.default);
const CoursePlayer = view(() => import("./CoursePlayer"), (mod) => mod.default);
const AddAdmits = view(() => import("./AddAdmits"), (mod) => mod.default);
const CoursePreview = view(() => import("./CoursePreview"), (mod) => mod.default);
const CodeArena = view(() => import("./CodeArena"), (mod) => mod.default);
const AdminHome = view(() => import("./admin/AdminHome"), (mod) => mod.default);
const CourseDesk = view(() => import("./admin/CourseDesk"), (mod) => mod.default);
const CertificateDesk = view(() => import("./admin/CertificateDesk"), (mod) => mod.default);
const PromoDesk = view(() => import("./admin/PromoDesk"), (mod) => mod.default);
const Recordings = () => import("./recordings/Recordings");
const RecordingAdmin = view(Recordings, (mod) => mod.RecordingAdmin);
const RecordingLibrary = view(Recordings, (mod) => mod.RecordingLibrary);
const RecordingPlayer = view(Recordings, (mod) => mod.RecordingPlayer);
const InstructorSettings = view(() => import("./InstructorSettings"), (mod) => mod.default);
const StudentManagement = view(() => import("./StudentManagement"), (mod) => mod.default);
const Messages = view(() => import("./Messages"), (mod) => mod.default);
const WatchManager = view(() => import("./WatchManager"), (mod) => mod.default);
const Studio = () => import("./student/StudentStudio");
const Assessments = view(Studio, (mod) => mod.Assessments);
const CertificatePage = view(Studio, (mod) => mod.CertificatePage);
const CourseDashboard = view(Studio, (mod) => mod.CourseDashboard);
const LearnPage = view(Studio, (mod) => mod.LearnPage);
const MyCourses = view(Studio, (mod) => mod.MyCourses);
const Notebook = view(Studio, (mod) => mod.Notebook);
const StudentSettings = view(Studio, (mod) => mod.StudentSettings);
const StudentShell = view(Studio, (mod) => mod.StudentShell);
const Hub = () => import("./student/StudentHub");
const CertificateGallery = view(Hub, (mod) => mod.CertificateGallery);
const CourseCatalog = view(Hub, (mod) => mod.CourseCatalog);
const ProfilePage = view(Hub, (mod) => mod.ProfilePage);
const StudentHome = view(Hub, (mod) => mod.StudentHome);
const Programs = () => import("./Programs");
const InstructorPrograms = view(Programs, (mod) => mod.InstructorPrograms);
const StudentPrograms = view(Programs, (mod) => mod.StudentPrograms);
const CodingCourseManager = view(() => import("./CodingCourseManager"), (mod) => mod.default);

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/pricing" element={hold(<PricingPage />)} />
        <Route path="/contact" element={hold(<ContactPage />)} />
        <Route path="/design" element={hold(<DesignPage />)} />
        <Route path="/share/courses/:courseId" element={hold(<SharedCourse />)} />
        <Route path="/login" element={hold(<PublicOnlyRoute><LearnerAuth /></PublicOnlyRoute>)} />
        <Route path="/signup" element={hold(<PublicOnlyRoute><LearnerAuth /></PublicOnlyRoute>)} />
        <Route path="/forgot-password" element={hold(<PublicOnlyRoute><LearnerAuth /></PublicOnlyRoute>)} />
        <Route path="/reset-password" element={hold(<LearnerAuth />)} />
        <Route path="/admin-login" element={hold(<PublicOnlyRoute><AdminLogin /></PublicOnlyRoute>)} />

        <Route path="/dashboard" element={hold(<ProtectedRoute requiredRole="instructor"><DashboardLayout /></ProtectedRoute>)}>
          <Route index element={hold(<AdminHome />)} />
          <Route path="courses" element={hold(<CourseDesk />)} />
          <Route path="certificates" element={hold(<CertificateDesk />)} />
          <Route path="promo-codes" element={hold(<PromoDesk />)} />
          <Route path="watch" element={hold(<WatchManager />)} />
          <Route path="create-course" element={hold(<CreateCourse />)} />
          <Route path="course/:courseId/builder" element={hold(<CourseBuilder />)} />
          <Route path="course/:courseId/recordings" element={hold(<RecordingAdmin />)} />
          <Route path="assignments" element={hold(<AssignmentManager />)} />
          <Route path="add-admits" element={hold(<AddAdmits />)} />
          <Route path="course/:courseId/preview" element={hold(<CodingCourseManager />)} />
          <Route path="course/:courseId/CoursePreview" element={hold(<CoursePreview />)} />
          <Route path="code-arena" element={hold(<CodeArena />)} />
          <Route path="students" element={hold(<StudentManagement />)} />
          <Route path="settings" element={hold(<InstructorSettings />)} />
          <Route path="messages" element={hold(<Messages />)} />
          <Route path="programs" element={hold(<InstructorPrograms />)} />
        </Route>
        
        <Route element={hold(<ProtectedRoute requiredRole="student"><StudentShell /></ProtectedRoute>)}>
          <Route path="/home" element={hold(<StudentHome />)} />
          <Route path="/courses" element={hold(<CourseCatalog />)} />
          <Route path="/certificates" element={hold(<CertificateGallery />)} />
          <Route path="/profile" element={hold(<ProfilePage />)} />
          <Route path="/my-courses" element={hold(<MyCourses />)} />
          <Route path="/my-courses/:courseId" element={hold(<CourseDashboard />)} />
          <Route path="/my-courses/:courseId/recordings" element={hold(<RecordingLibrary />)} />
          <Route path="/my-courses/:courseId/recordings/:recordingId" element={hold(<RecordingPlayer />)} />
          <Route path="/my-courses/:courseId/notes" element={hold(<Notebook />)} />
          <Route path="/my-courses/:courseId/assessments" element={hold(<Assessments />)} />
          <Route path="/my-courses/:courseId/certificate" element={hold(<CertificatePage />)} />
          <Route path="/learn/:courseId/:lessonId" element={hold(<LearnPage />)} />
          <Route path="/settings" element={hold(<StudentSettings />)} />
          <Route path="/programs" element={hold(<StudentPrograms />)} />
        </Route>
        <Route path="/student-dashboard" element={<Navigate to="/home" replace />} />
        <Route path="/course/:courseId/player" element={hold(<ProtectedRoute requiredRole="student"><CoursePlayer /></ProtectedRoute>)} />
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
  if (session.role === "instructor") return <Navigate to="/dashboard" replace />;
  // Honor ?next= so share → login (already signed in) still lands on that course in Courses.
  const params = new URLSearchParams(window.location.search);
  const next = params.get("next");
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    return <Navigate to={next} replace />;
  }
  return <Navigate to="/student-dashboard" replace />;
};

const FallbackRoute = () => {
  const session = getValidSession();
  if (!session?.token) return <Navigate to="/" replace />;
  return session.role === "instructor" ? <Navigate to="/dashboard" replace /> : <Navigate to="/student-dashboard" replace />;
};

export default App;
