import React from "react";

interface BrandLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showTagline?: boolean;
  className?: string;
  tone?: "ink" | "onDark";
}

const Mark = ({ className }: { className: string }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
    <rect x="1" y="1" width="46" height="46" rx="14" fill="#0B1F33" />
    <circle cx="16" cy="18" r="3.2" fill="#7CFF6B" />
    <circle cx="32" cy="16" r="3.2" fill="#4DA3FF" />
    <circle cx="30" cy="32" r="3.2" fill="#7CFF6B" />
    <path d="M16 18 L32 16 L30 32 L16 18" fill="none" stroke="#E8EEF7" strokeWidth="1.4" />
    <text x="14" y="27" fill="#F8FAFC" fontFamily="Space Grotesk, Inter, sans-serif" fontSize="11" fontWeight="700">IQ</text>
  </svg>
);

const BrandLogo: React.FC<BrandLogoProps> = ({ size = "md", showTagline = false, className = "", tone = "ink" }) => {
  const mark = { sm: "h-7 w-7", md: "h-9 w-9", lg: "h-12 w-12", xl: "h-16 w-16" };
  const word = { sm: "text-lg", md: "text-2xl", lg: "text-4xl", xl: "text-5xl" };
  const ink = tone === "onDark" ? "text-white" : "text-[#0B1F33]";

  return (
    <div className={`flex items-center gap-2.5 leading-none ${className}`}>
      <Mark className={`${mark[size]} shrink-0`} />
      <div className="flex flex-col items-start">
        <div className={`font-semibold tracking-tight ${word[size]}`} style={{ fontFamily: '"Space Grotesk", Inter, sans-serif' }}>
          <span className={ink}>IQ</span>
          <span className="text-[#5f9e22]">Nex</span>
        </div>
        {showTagline && (
          <span className={`tracking-[0.16em] uppercase font-semibold ${tone === "onDark" ? "text-slate-400" : "text-slate-500"} ${size === "xl" || size === "lg" ? "text-xs mt-1" : "text-[10px] mt-0.5"}`}>
            by IQ Math
          </span>
        )}
      </div>
    </div>
  );
};

export default BrandLogo;
