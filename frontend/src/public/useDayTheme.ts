import { useEffect, useState } from "react";

export type DayTheme = "light" | "dark";

/** Local clock: light from 6:00 to 18:00, dark from 18:00 to 6:00. */
export const themeForNow = (date = new Date()): DayTheme => {
  const hour = date.getHours();
  return hour >= 6 && hour < 18 ? "light" : "dark";
};

export const useDayTheme = () => {
  const [theme, setTheme] = useState<DayTheme>(() => themeForNow());

  useEffect(() => {
    const tick = () => setTheme(themeForNow());
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);

  return theme;
};
