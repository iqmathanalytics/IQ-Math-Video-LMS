import type { ReactNode } from "react";

export const fieldClass =
  "w-full rounded-xl border iq-line iq-surface px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--iq-accent)]";

export const Field = ({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) => (
  <label className="block text-sm">
    <span className="iq-subtle">{label}</span>
    <div className="mt-1">{children}</div>
    {error && <span className="mt-1 block text-xs text-[#b42318]">{error}</span>}
  </label>
);

export const passwordScore = (password: string) => {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
};

export const PasswordMeter = ({ password }: { password: string }) => {
  const score = passwordScore(password);
  const label = ["Too short", "Weak", "Okay", "Strong", "Strong"][score];
  return (
    <div className="mt-2">
      <div className="flex gap-1" aria-hidden="true">
        {[0, 1, 2, 3].map((index) => (
          <span key={index} className={`h-1 flex-1 rounded-full ${index < score ? "iq-fill" : "iq-track"}`} />
        ))}
      </div>
      <p className="mt-1 text-xs iq-faint">{password ? label : "Use 8 or more characters, with upper and lower case and a number."}</p>
    </div>
  );
};

export const SubmitButton = ({ busy, children }: { busy?: boolean; children: ReactNode }) => (
  <button type="submit" disabled={busy} className="inline-flex w-full items-center justify-center rounded-full iq-accent-bg px-4 py-3 text-sm font-semibold disabled:opacity-60">
    {busy ? "Please wait…" : children}
  </button>
);
