import { useEffect, useState } from "react";

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

const listeners = new Set<(theme: DayTheme) => void>();

const notify = (theme: DayTheme) => {
  listeners.forEach((listener) => listener(theme));
};

export const setPreferredTheme = (theme: DayTheme) => {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
  notify(theme);
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", theme);
  }
};

export const togglePreferredTheme = (current: DayTheme): DayTheme => {
  const next: DayTheme = current === "dark" ? "light" : "dark";
  setPreferredTheme(next);
  return next;
};

export const useDayTheme = () => {
  const [theme, setTheme] = useState<DayTheme>(() => readStored() || themeForNow());

  useEffect(() => {
    const apply = (next: DayTheme) => {
      setTheme(next);
      document.documentElement.setAttribute("data-theme", next);
    };

    apply(readStored() || themeForNow());
    listeners.add(apply);

    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      apply(event.newValue === "light" || event.newValue === "dark" ? event.newValue : themeForNow());
    };
    window.addEventListener("storage", onStorage);

    const id = window.setInterval(() => {
      if (!readStored()) apply(themeForNow());
    }, 60_000);

    return () => {
      listeners.delete(apply);
      window.removeEventListener("storage", onStorage);
      window.clearInterval(id);
    };
  }, []);

  return theme;
};
