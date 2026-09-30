import { useEffect, useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, BookOpen, UserPlus, PlusCircle, LogOut,
  ChevronRight, Code, Menu, Settings, Users, FolderOpen, MessageSquare, Award, PlayCircle, Search
} from "lucide-react";
import BrandLogo from "./components/BrandLogo";
import { clearSession } from "./utils/session";

const DashboardLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // ✅ Profile Dropdown State
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [idleWarn, setIdleWarn] = useState(false);
  const instructorData = { name: "Admin" };

  const groups = [
    {
      label: "Site",
      items: [
        { label: "Overview", path: "/dashboard", icon: <LayoutDashboard size={20} /> },
        { label: "Watch", path: "/dashboard/watch", icon: <PlayCircle size={20} /> },
      ],
    },
    {
      label: "Learning",
      items: [
        { label: "Uploaded courses", path: "/dashboard/courses", icon: <BookOpen size={20} /> },
        { label: "Create course", path: "/dashboard/create-course", icon: <PlusCircle size={20} /> },
        { label: "Assessments", path: "/dashboard/assignments", icon: <FolderOpen size={20} /> },
        { label: "Code arena", path: "/dashboard/code-arena", icon: <Code size={20} /> },
      ],
    },
    {
      label: "People",
      items: [
        { label: "Students", path: "/dashboard/students", icon: <Users size={20} /> },
        { label: "Admit students", path: "/dashboard/add-admits", icon: <UserPlus size={20} /> },
        { label: "Certificates", path: "/dashboard/certificates", icon: <Award size={20} /> },
        { label: "Messages", path: "/dashboard/messages", icon: <MessageSquare size={20} /> },
      ],
    },
  ];
  const menuItems = groups.flatMap((group) => group.items);
  const paletteItems = menuItems.filter((item) => item.label.toLowerCase().includes(paletteQuery.trim().toLowerCase()));

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
      }
      if (event.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const IDLE_MS = 30 * 60 * 1000;
    const WARN_MS = 25 * 60 * 1000;
    const mark = () => sessionStorage.setItem("admin_active_at", String(Date.now()));
    mark();
    const events = ["pointerdown", "keydown"] as const;
    events.forEach((name) => window.addEventListener(name, mark));
    const timer = window.setInterval(() => {
      const since = Date.now() - Number(sessionStorage.getItem("admin_active_at") || Date.now());
      if (since >= IDLE_MS) handleLogout();
      else setIdleWarn(since >= WARN_MS);
    }, 15000);
    return () => {
      events.forEach((name) => window.removeEventListener(name, mark));
      window.clearInterval(timer);
    };
  }, []);

  const handleLogout = () => {
    clearSession();
    navigate("/");
  };

  return (
    <div className="flex h-screen bg-slate-200 font-sans">

      {/* MOBILE OVERLAY */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-slate-50 border-r border-slate-300 shadow-xl transition-all duration-300 lg:static lg:shadow-none
            ${mobileMenuOpen ? "translate-x-0 w-72" : "-translate-x-full lg:translate-x-0"} 
            ${collapsed ? "lg:w-20" : "lg:w-72"}
        `}
      >

        {/* LOGO SECTION */}
        <div className={`p-6 border-b border-slate-300 flex items-center gap-2 ${collapsed ? "lg:justify-center lg:px-2" : "justify-between"}`}>
          {(!collapsed || mobileMenuOpen) && (
            <div>
              <BrandLogo size="md" />
              <span className="text-[11px] text-[#87C232] font-bold uppercase tracking-widest block mt-1">
                Admin console
              </span>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex p-2 rounded-lg text-slate-500 hover:bg-slate-200 transition-colors"
          >
            <Menu size={24} />
          </button>
          {/* Mobile Close Button */}
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-200 transition-colors"
          >
            <Menu size={24} />
          </button>
        </div>

        {/* NAVIGATION */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-4">
          {groups.map((group) => (
            <div key={group.label}>
              {(!collapsed || mobileMenuOpen) && <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-widest text-slate-400">{group.label}</p>}
              {group.items.map((item) => {
                const isActive = location.pathname === item.path || location.pathname === item.path + "/";
                return (
                  <div
                    key={item.path}
                    onClick={() => { navigate(item.path); setMobileMenuOpen(false); }}
                    title={collapsed ? item.label : ""}
                    className={`flex items-center p-3.5 rounded-xl cursor-pointer transition-all duration-200 group
                        ${collapsed ? "justify-center" : "justify-between"}
                        ${isActive ? "bg-slate-100 text-[#005EB8] shadow-sm font-bold" : "text-slate-500 hover:bg-slate-100 hover:text-slate-700 font-medium"}
                    `}
                  >
                    <div className="flex items-center gap-3.5">
                      <div className={`transition-transform duration-200 ${isActive ? "scale-110" : "group-hover:scale-110"}`}>{item.icon}</div>
                      {(!collapsed || mobileMenuOpen) && <span className="text-[15px]">{item.label}</span>}
                    </div>
                    {(!collapsed || mobileMenuOpen) && isActive && <ChevronRight size={16} className="text-[#005EB8]" strokeWidth={3} />}
                  </div>
                );
              })}
            </div>
          ))}
        </nav>

        {/* FOOTER */}
        <div className="p-5 border-t border-slate-300">
          <div
            onClick={handleLogout}
            className={`flex items-center gap-3 p-3 text-slate-500 cursor-pointer font-semibold rounded-lg transition-colors hover:bg-red-50 hover:text-red-500
                ${collapsed ? "justify-center" : "justify-start"}
            `}
          >
            <LogOut size={20} strokeWidth={2} /> {(!collapsed || mobileMenuOpen) && <span>Sign Out</span>}
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative w-full">

        {/* HEADER */}
        <header className="h-20 bg-slate-50 border-b border-slate-300 flex items-center justify-between px-6 lg:px-10 shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setMobileMenuOpen(true)} className="lg:hidden p-2 -ml-2 text-slate-600">
              <Menu size={24} />
            </button>
            <h1 className="text-xl lg:text-2xl font-bold text-[#1e293b]">
              {menuItems.find(i => i.path === location.pathname)?.label || "Dashboard"}
            </h1>
          </div>

          <div className="flex items-center gap-4 lg:gap-6">
            <button type="button" onClick={() => setPaletteOpen(true)} className="hidden items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-2 text-sm text-slate-500 sm:flex">
              <Search size={16} /> Search <span className="text-xs">Ctrl K</span>
            </button>

            {/* PROFILE DROPDOWN */}
            <div className="relative">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="w-10 h-10 rounded-full bg-[#005EB8] text-white flex items-center justify-center font-bold text-base shadow-lg shadow-blue-200/50 hover:scale-105 transition-transform"
              >
                IN
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 top-14 w-64 bg-slate-50 rounded-xl shadow-2xl p-4 z-[100] border border-slate-200 animate-fade-in-up">
                  <div className="mb-4 border-b border-slate-200 pb-4">
                    <p className="font-bold text-[#1e293b]">{instructorData.name}</p>
                  </div>
                  <button onClick={() => { navigate("/dashboard/settings"); setShowProfileMenu(false); }} className="flex items-center gap-3 w-full p-2.5 rounded-lg hover:bg-slate-100 text-[#1e293b] text-sm font-medium transition-colors text-left">
                    <Settings size={18} /> Settings
                  </button>
                  <button onClick={handleLogout} className="flex items-center gap-3 w-full p-2.5 rounded-lg hover:bg-red-50 text-red-500 text-sm font-bold transition-colors text-left mt-1">
                    <LogOut size={18} /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* CONTENT */}
        <div className="flex-1 p-4 lg:p-10 overflow-y-auto overflow-x-hidden bg-slate-200">
          <Outlet />
        </div>
        {paletteOpen && (
          <div className="fixed inset-0 z-[80] flex items-start justify-center bg-slate-900/40 p-4 pt-24" onClick={() => setPaletteOpen(false)}>
            <div className="w-full max-w-lg rounded-2xl bg-white p-3 shadow-2xl" onClick={(event) => event.stopPropagation()}>
              <input autoFocus value={paletteQuery} onChange={(event) => setPaletteQuery(event.target.value)} placeholder="Jump to a section" className="w-full rounded-xl border border-slate-200 px-3 py-3" />
              <ul className="mt-2">
                {paletteItems.map((item) => (
                  <li key={item.path}>
                    <button type="button" className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-slate-100" onClick={() => { navigate(item.path); setPaletteOpen(false); setPaletteQuery(""); }}>
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        {idleWarn && (
          <div className="fixed bottom-4 right-4 z-[80] max-w-sm rounded-2xl border border-slate-300 bg-white p-4 shadow-xl">
            <p className="text-sm font-semibold text-slate-800">Still working?</p>
            <p className="mt-1 text-sm text-slate-600">This console signs out after 30 minutes without activity.</p>
            <button type="button" className="mt-3 rounded-full bg-[#005EB8] px-3 py-2 text-sm font-semibold text-white" onClick={() => { sessionStorage.setItem("admin_active_at", String(Date.now())); setIdleWarn(false); }}>Stay signed in</button>
          </div>
        )}
      </main>
    </div>
  );
};

export default DashboardLayout;