import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

/** Top-level routes where a back control would be noise. */
const ROOT_PATHS = new Set([
  "/",
  "/home",
  "/dashboard",
  "/login",
  "/signup",
  "/admin-login",
  "/forgot-password",
  "/reset-password",
]);

type Props = {
  /** Used when there is no browser history to go back to. */
  fallback?: string;
  className?: string;
  label?: string;
  /** Force show even on a root path (rare). */
  always?: boolean;
};

const BackButton = ({
  fallback = "/home",
  className = "",
  label = "Back",
  always = false,
}: Props) => {
  const navigate = useNavigate();
  const location = useLocation();

  if (!always && ROOT_PATHS.has(location.pathname)) return null;

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(fallback);
  };

  return (
    <button
      type="button"
      onClick={goBack}
      className={`inline-flex items-center gap-1.5 rounded-full border iq-line px-3 py-1.5 text-sm font-semibold iq-subtle iq-hover ${className}`}
      aria-label="Go back"
    >
      <ArrowLeft size={16} strokeWidth={2.25} />
      {label}
    </button>
  );
};

export default BackButton;
