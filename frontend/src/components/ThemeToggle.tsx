import { Moon, Sun } from "lucide-react";
import { togglePreferredTheme, useDayTheme } from "../public/useDayTheme";

type Props = {
  className?: string;
};

const ThemeToggle = ({ className = "" }: Props) => {
  const theme = useDayTheme();
  const dark = theme === "dark";

  return (
    <button
      type="button"
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title={dark ? "Light theme" : "Dark theme"}
      className={`relative inline-flex items-center justify-center rounded-full border iq-line p-2 iq-muted iq-hover ${className}`}
      onClick={() => togglePreferredTheme(theme)}
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
};

export default ThemeToggle;
