import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, Search, X } from "lucide-react";
import BrandLogo from "../components/BrandLogo";
import { NAV } from "./catalog";
import { useDayTheme } from "./useDayTheme";

const PublicShell = ({ title, children }: { title?: string; children: ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [queryOpen, setQueryOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [progress, setProgress] = useState(0);
  const theme = useDayTheme();

  useEffect(() => {
    document.title = title ? `${title} · IQNex` : "IQNex · Learning that compounds";
  }, [title]);

  useEffect(() => {
    setOpen(false);
    setQueryOpen(false);
    if (!location.hash) window.scrollTo(0, 0);
  }, [location.pathname, location.hash]);

  useEffect(() => {
    const onScroll = () => {
      const height = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(height > 0 ? window.scrollY / height : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setQueryOpen((value) => !value);
      }
      if (event.key === "Escape") setQueryOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    const pages = [{ label: "Home", path: "/", group: "Explore" }, ...NAV];
    if (!term) return pages;
    return pages.filter((item) => `${item.label} ${item.group}`.toLowerCase().includes(term));
  }, [query]);

  return (
    <div data-theme={theme} className="iq-page min-h-screen" style={{ fontFamily: "Inter, sans-serif" }}>
      <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[80] focus:bg-white focus:text-slate-900 focus:px-3 focus:py-2 focus:rounded-md">
        Skip to content
      </a>
      <div className="fixed top-0 left-0 right-0 z-[70] h-0.5 bg-transparent">
        <div className="h-full iq-fill origin-left" style={{ transform: `scaleX(${progress})` }} />
      </div>

      <header className="sticky top-0 z-50 border-b iq-line iq-header backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" aria-label="IQNex home"><BrandLogo tone={theme === "dark" ? "onDark" : "ink"} size="sm" /></Link>
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
            {NAV.map((item) => (
              <Link key={item.path} to={item.path} className="px-3 py-2 text-sm iq-subtle iq-hover-ink">{item.label}</Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <button aria-label="Search pages" onClick={() => setQueryOpen(true)} className="hidden sm:flex items-center gap-2 rounded-full border iq-line px-3 py-1.5 text-xs iq-subtle">
              <Search size={14} /> Search <span className="iq-faint">Ctrl K</span>
            </button>
            <Link to="/login" className="rounded-full iq-accent-bg px-4 py-2 text-sm font-semibold">Start learning</Link>
            <button className="lg:hidden p-2" aria-label="Open menu" onClick={() => setOpen(true)}><Menu size={20} /></button>
          </div>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-[60] bg-black/60 lg:hidden" onClick={() => setOpen(false)}>
          <div className="ml-auto h-full w-[min(100%,20rem)] iq-surface p-5" onClick={(event) => event.stopPropagation()}>
            <button aria-label="Close menu" onClick={() => setOpen(false)} className="mb-6"><X /></button>
            {NAV.map((item) => (
              <Link key={item.path} to={item.path} className="block border-b iq-line py-3 text-sm">{item.label}</Link>
            ))}
          </div>
        </div>
      )}

      {queryOpen && (
        <div className="fixed inset-0 z-[70] bg-black/70 p-4" onClick={() => setQueryOpen(false)}>
          <div className="mx-auto mt-24 max-w-lg rounded-2xl border iq-line iq-surface p-3" onClick={(event) => event.stopPropagation()} role="dialog" aria-label="Search">
            <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Jump to a page" className="w-full bg-transparent px-3 py-3 text-sm outline-none" />
            <ul className="max-h-72 overflow-auto">
              {results.map((item) => (
                <li key={item.path}>
                  <button className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm iq-hover" onClick={() => navigate(item.path)}>
                    <span>{item.label}</span><span className="text-xs iq-faint">{item.group}</span>
                  </button>
                </li>
              ))}
              {results.length === 0 && <li className="px-3 py-4 text-sm iq-muted">No matching page.</li>}
            </ul>
          </div>
        </div>
      )}

      <main id="content">{children}</main>

      <footer className="border-t iq-line">
        <div className={`mx-auto grid max-w-6xl gap-8 px-4 py-12 ${NAV.length > 0 ? "sm:grid-cols-2" : ""}`}>
          <div>
            <BrandLogo tone={theme === "dark" ? "onDark" : "ink"} size="sm" />
            <p className="mt-3 max-w-sm text-sm iq-muted">IQ Math courses for analytics, programming, and applied AI. Sign in to continue the work that is already on your account.</p>
          </div>
          {NAV.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-[0.16em] iq-faint">On this site</p>
              <ul className="mt-3 space-y-2 text-sm">
                {NAV.map((item) => (
                  <li key={item.path}><Link className="iq-subtle iq-hover-ink" to={item.path}>{item.label}</Link></li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="border-t iq-line px-4 py-4 text-xs iq-faint">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
            <p>© {new Date().getFullYear()} IQNex</p>
            <p>
              <a className="iq-hover-ink" href="mailto:contact@iqmath.in">contact@iqmath.in</a>
              <span className="px-2">·</span>
              <a className="iq-hover-ink" href="https://wa.me/919360960219">WhatsApp +91 93609 60219</a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicShell;
