import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import API_BASE_URL from './config';
import { 
  ArrowLeft, Trash2, Edit, Code, Plus, 
  X, CheckCircle, AlertTriangle 
} from "lucide-react";

// --- Types ---
interface CodeProblem {
  id: number;
  title: string;
  description: string;
  difficulty: string;
  test_cases: any; 
}

const CodingCourseManager = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("Easy");
  const [challenges, setChallenges] = useState<CodeProblem[]>([]);
  const [loading, setLoading] = useState(true);
  const [courseTitle, setCourseTitle] = useState("");

  // --- Modal / Edit State ---
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProblem, setEditingProblem] = useState<any>(null);
  const [editForm, setEditForm] = useState({ title: "", description: "", test_cases: "" });

  const token = localStorage.getItem("token");

  // ✅ Toast State
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  const triggerToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ ...toast, show: false }), 3000);
  };

  useEffect(() => { fetchData(); }, [courseId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const courseRes = await axios.get(`${API_BASE_URL}/courses/${courseId}`, { headers: { Authorization: `Bearer ${token}` } });
      setCourseTitle(courseRes.data.title);

      const res = await axios.get(`${API_BASE_URL}/courses/${courseId}/challenges`, { headers: { Authorization: `Bearer ${token}` } });
      setChallenges(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if(!window.confirm("Are you sure you want to delete this problem?")) return;
    try {
      await axios.delete(`${API_BASE_URL}/challenges/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      setChallenges(prev => prev.filter(c => c.id !== id));
      triggerToast("Problem deleted successfully", "success");
    } catch (err) {
      triggerToast("Failed to delete problem.", "error");
    }
  };

  const openEditModal = (problem: CodeProblem) => {
    setEditingProblem(problem);
    let tcString = problem.test_cases;
    if (typeof tcString !== 'string') {
        tcString = JSON.stringify(tcString, null, 2);
    }
    setEditForm({
        title: problem.title,
        description: problem.description,
        test_cases: tcString
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if(!editingProblem) return;
    try {
        await axios.patch(`${API_BASE_URL}/challenges/${editingProblem.id}`, {
            title: editForm.title,
            description: editForm.description,
            difficulty: activeTab, 
            test_cases: editForm.test_cases
        }, { headers: { Authorization: `Bearer ${token}` } });

        triggerToast("Problem updated successfully!", "success");
        setIsEditModalOpen(false);
        fetchData(); 
    } catch(err) {
        triggerToast("Failed to update.", "error");
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center">Loading Content...</div>;

  const filteredChallenges = challenges.filter(c => c.difficulty === activeTab);

  return (
    <div className="relative min-h-screen font-sans iq-inset">
      {/* 1. Header Area */}
      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b iq-line iq-surface px-4 py-3 md:px-8">
        <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="iq-btn iq-btn-icon shrink-0" aria-label="Back">
                <ArrowLeft size={16} />
            </button>
            <div>
                <h1 className="text-xl font-extrabold">{courseTitle || "Coding Course"}</h1>
                <p className="text-xs font-bold uppercase tracking-wide iq-link">Manager & Preview</p>
            </div>
        </div>
        <div className="flex gap-3">
            <button onClick={() => navigate(`/dashboard/course/${courseId}/builder`)} className="iq-btn iq-btn-primary">
                <Plus size={14} /> Add problem
            </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-8">
        {/* 2. Tabs */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
            {["Easy", "Medium", "Hard"].map(tab => (
                <button 
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`iq-btn ${activeTab === tab ? "iq-btn-primary" : "iq-btn-line"}`}
                >
                    {tab}
                </button>
            ))}
        </div>

        {/* 3. Problem List */}
        <div className="grid gap-4">
            {filteredChallenges.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
                    <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Code size={32} className="text-slate-300" />
                    </div>
                    <h3 className="text-slate-500 font-bold text-lg">No problems in {activeTab} yet.</h3>
                    <p className="text-slate-400 text-sm">Go back to the builder to add some!</p>
                </div>
            ) : (
                filteredChallenges.map((c) => (
                    <div key={c.id} className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-wrap justify-between items-center gap-3 group">
                        
                        {/* Left: Info */}
                        <div className="flex items-center gap-5">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold ${
                                activeTab === "Easy" ? "bg-green-100 text-green-700" : 
                                activeTab === "Medium" ? "bg-yellow-100 text-yellow-700" : 
                                "bg-red-100 text-red-700"
                            }`}>
                                <Code size={20} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 mb-1">{c.title}</h3>
                                <p className="text-slate-500 text-sm line-clamp-1 max-w-lg">{c.description}</p>
                            </div>
                        </div>

                        {/* Right: Actions (Using your requested icons) */}
                        <div className="flex items-center gap-3">
                            <button 
                                type="button"
                                onClick={() => openEditModal(c)}
                                className="iq-btn iq-btn-line"
                                title="Edit Problem"
                            >
                                <Edit size={14} /> Edit
                            </button>

                            <button 
                                type="button"
                                onClick={() => handleDelete(c.id)}
                                className="iq-btn iq-btn-danger"
                                title="Delete Problem"
                            >
                                <Trash2 size={14} /> Delete
                            </button>
                        </div>
                    </div>
                ))
            )}
        </div>
      </div>

      {/* 4. Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-xl text-slate-800">Edit Challenge</h3>
                    <button onClick={() => setIsEditModalOpen(false)}><X className="text-slate-400 hover:text-slate-600" /></button>
                </div>
                <div className="p-8 space-y-5 max-h-[70vh] overflow-y-auto">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Title</label>
                        <input value={editForm.title} onChange={(e) => setEditForm({...editForm, title: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Description</label>
                        <textarea rows={4} value={editForm.description} onChange={(e) => setEditForm({...editForm, description: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl text-slate-600 focus:ring-2 focus:ring-blue-500 outline-none resize-y" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Test Cases (JSON)</label>
                        <div className="bg-slate-900 rounded-xl p-4">
                            <textarea rows={6} value={editForm.test_cases} onChange={(e) => setEditForm({...editForm, test_cases: e.target.value})} className="w-full bg-transparent text-green-400 font-mono text-sm focus:outline-none resize-y" />
                        </div>
                    </div>
                </div>
                <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <button type="button" onClick={() => setIsEditModalOpen(false)} className="iq-btn iq-btn-line">Cancel</button>
                    <button type="button" onClick={handleSaveEdit} className="iq-btn iq-btn-primary">Save</button>
                </div>
            </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast.show && (
        <div style={{ position: "fixed", top: "20px", right: "20px", background: "var(--iq-surface)", padding: "16px 24px", borderRadius: "12px", boxShadow: "0 10px 30px -5px rgba(0,0,0,0.15)", borderLeft: `6px solid ${toast.type === "success" ? "#87C232" : "#ef4444"}`, display: "flex", alignItems: "center", gap: "12px", zIndex: 9999, animation: "slideIn 0.3s ease-out" }}>
            {toast.type === "success" ? <CheckCircle size={24} color="#87C232" /> : <AlertTriangle size={24} color="#ef4444" />}
            <div><h4 style={{ margin: "0", fontSize: "14px", fontWeight: "700", color: "var(--iq-text)" }}>{toast.type === "success" ? "Success" : "Error"}</h4><p style={{ margin: 0, fontSize: "13px", color: "var(--iq-muted)" }}>{toast.message}</p></div>
            <button onClick={() => setToast({ ...toast, show: false })} style={{ background: "none", border: "none", cursor: "pointer", marginLeft: "10px", color: "var(--iq-faint)" }}><X size={16} /></button>
        </div>
      )}
    </div>
  );
};

export default CodingCourseManager;