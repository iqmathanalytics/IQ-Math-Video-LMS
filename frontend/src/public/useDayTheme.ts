import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from "react";

export type DayTheme = "light" | "dark";

const STORAGE_KEY = "iqnex-theme";

/** Local clock: light from 6:00 to 18:00, dark from 18:00 to 6:00. */
export const themeForNow = (date = new Date()): DayTheme => {
  const hour = date.getHours();
  return hour >= 6 && hour < 18 ? "light" : "dark";
};

const readStored = (): DayTheme | null => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === "light" || value === "dark") return value;
  } catch {
    /* ignore */
  }
  return null;
};

const writeStored = (theme: DayTheme) => {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
};

const applyDomTheme = (theme: DayTheme) => {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.style.colorScheme = theme;
  document.querySelectorAll<HTMLElement>("[data-theme]").forEach((node) => {
    node.setAttribute("data-theme", theme);
  });
};

type ThemeContextValue = {
  theme: DayTheme;
  setTheme: (theme: DayTheme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<DayTheme>(() => readStored() || themeForNow());

  const setTheme = (next: DayTheme) => {
    writeStored(next);
    setThemeState(next);
    applyDomTheme(next);
  };

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  useEffect(() => {
    applyDomTheme(theme);
  }, [theme]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      const next = event.newValue === "light" || event.newValue === "dark" ? event.newValue : themeForNow();
      setThemeState(next);
      applyDomTheme(next);
    };
    window.addEventListener("storage", onStorage);
    const id = window.setInterval(() => {
      if (!readStored()) {
        const next = themeForNow();
        setThemeState(next);
        applyDomTheme(next);
      }
    }, 60_000);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.clearInterval(id);
    };
  }, []);

  return createElement(ThemeContext.Provider, { value: { theme, setTheme, toggleTheme } }, children);
};

/** Prefer ThemeProvider; falls back to stored/clock theme if used outside. */
export const useDayTheme = (): DayTheme => {
  const ctx = useContext(ThemeContext);
  const [fallback, setFallback] = useState<DayTheme>(() => readStored() || themeForNow());

  useEffect(() => {
    if (ctx) return;
    const sync = () => setFallback(readStored() || themeForNow());
    window.addEventListener("storage", sync);
    const id = window.setInterval(sync, 60_000);
    return () => {
      window.removeEventListener("storage", sync);
      window.clearInterval(id);
    };
  }, [ctx]);

  return ctx?.theme ?? fallback;
};

export const useThemeControls = () => {
  const ctx = useContext(ThemeContext);
  if (ctx) return ctx;
  return {
    theme: readStored() || themeForNow(),
    setTheme: (next: DayTheme) => {
      writeStored(next);
      applyDomTheme(next);
    },
    toggleTheme: () => {
      const current = readStored() || themeForNow();
      const next: DayTheme = current === "dark" ? "light" : "dark";
      writeStored(next);
      applyDomTheme(next);
    },
  };
};

export const setPreferredTheme = (theme: DayTheme) => {
  writeStored(theme);
  applyDomTheme(theme);
  window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY, newValue: theme }));
};

export const togglePreferredTheme = (current: DayTheme): DayTheme => {
  const next: DayTheme = current === "dark" ? "light" : "dark";
  setPreferredTheme(next);
  return next;
};
