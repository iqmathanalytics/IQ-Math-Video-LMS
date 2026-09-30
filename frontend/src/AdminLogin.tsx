import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Lock, Mail, ArrowRight, CheckCircle, AlertCircle, X, ShieldCheck, Eye, EyeOff } from "lucide-react";
import API_BASE_URL from './config';
import { saveSession } from "./utils/session";

interface ToastState { show: boolean; message: string; type: "success" | "error"; }

const AdminLogin = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => { meta.remove(); };
  }, []);

  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<ToastState>({ show: false, message: "", type: "success" });

  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ email: "", password: "" });

  const gradientBg = "bg-gradient-to-r from-[#005EB8] to-[#87C232]";
  const borderFocus = "focus-within:ring-2 focus-within:ring-[#005EB8] focus-within:border-transparent";

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const triggerToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast((prev) => ({ ...prev, show: false })), 3000);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const loginParams = new URLSearchParams();
      loginParams.append("username", formData.email);
      loginParams.append("password", formData.password);

      const res = await axios.post(`${API_BASE_URL}/login`, loginParams);

      if (res.data.role !== "instructor") {
        triggerToast("Sign-in failed.", "error");
        setLoading(false); return;
      }
      saveSession(res.data.access_token, res.data.role);
      triggerToast("Signed in.", "success");
      setTimeout(() => navigate("/dashboard"), 1000);
    } catch (err: any) {
      if (!err?.response) {
        triggerToast("Backend unreachable. Ensure API is running.", "error");
      } else {
        triggerToast("Sign-in failed.", "error");
      }
    } finally { setLoading(false); }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#E2E8F0] font-sans p-4 overflow-hidden relative">

      {/* Decorative Blurs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-[#005EB8]/5 blur-[100px]"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-[#87C232]/5 blur-[100px]"></div>

      <div className="relative bg-[#F8FAFC] rounded-2xl shadow-2xl w-full max-w-[450px] p-6 lg:p-10 border border-slate-200 z-10">
        <div className="flex flex-col items-center text-center">
          <div className="mb-2 flex items-center justify-center p-3 bg-white rounded-2xl border border-slate-100 shadow-sm"><ShieldCheck size={32} className="text-[#005EB8]" /></div>

          <h1 className="text-3xl font-extrabold text-slate-800 mt-4 mb-2">IQNex Admin Console</h1>
          <p className="text-slate-500 text-sm mb-6 px-4">Sign in with the admin email and password for this site.</p>

          <form onSubmit={handleAuth} className="w-full space-y-5">
            <div className={`flex items-center bg-white rounded-xl px-4 py-3.5 border border-slate-200 transition-all ${borderFocus} shadow-sm`}>
              <Mail className="text-slate-400 mr-3 shrink-0" size={20} strokeWidth={1.5} />
              <input type="email" name="email" placeholder="Instructor Email" required value={formData.email} className="bg-transparent outline-none flex-1 text-sm font-medium text-slate-700 placeholder-slate-400" onChange={handleInputChange} />
            </div>

            <div className={`flex items-center bg-white rounded-xl px-4 py-3.5 border border-slate-200 transition-all ${borderFocus} shadow-sm`}>
              <Lock className="text-slate-400 mr-3 shrink-0" size={20} strokeWidth={1.5} />
              <input
                type={showPassword ? "text" : "password"}
                name="password" placeholder="Password" required value={formData.password}
                className="bg-transparent outline-none flex-1 text-sm font-medium text-slate-700 placeholder-slate-400"
                onChange={handleInputChange}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-slate-400 hover:text-[#005EB8] focus:outline-none transition-colors ml-2 shrink-0">
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            <button type="submit" disabled={loading} className={`w-full py-3.5 rounded-xl font-bold text-white shadow-lg shadow-blue-500/30 transition-all transform active:scale-95 flex items-center justify-center gap-2 mt-4 ${gradientBg} hover:opacity-90`}>
              {loading ? "Verifying..." : "Access Dashboard"} <ArrowRight size={18} />
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-200 w-full">
            <p className="text-xs text-slate-400 font-medium">This page is not listed on the public site. Questions go to contact@iqmath.in.</p>
          </div>
        </div>
      </div>
      {toast.show && (<div className="fixed top-5 right-5 z-50 bg-white px-6 py-4 rounded-xl shadow-2xl border-l-4 border-l-current flex items-center gap-3 animate-fade-in" style={{ borderColor: toast.type === "success" ? "#87C232" : "#ef4444" }}>{toast.type === "success" ? <CheckCircle className="text-[#87C232]" size={24} /> : <AlertCircle className="text-red-500" size={24} />}<div><h4 className="font-bold text-slate-800 text-sm">{toast.type === "success" ? "Success" : "Error"}</h4><p className="text-slate-500 text-xs">{toast.message}</p></div><button onClick={() => setToast({ ...toast, show: false })} className="ml-2 text-slate-400 hover:text-slate-600"><X size={16} /></button></div>)}
    </div>
  );
};

export default AdminLogin;