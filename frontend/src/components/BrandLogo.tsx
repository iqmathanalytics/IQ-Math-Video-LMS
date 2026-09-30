import React from "react";

interface BrandLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showTagline?: boolean;
  className?: string;
  tone?: "ink" | "onDark";
}

const BrandLogo: React.FC<BrandLogoProps> = ({ size = "md", showTagline = false, className = "", tone = "ink" }) => {
  const mark = { sm: "h-8 w-auto", md: "h-10 w-auto", lg: "h-14 w-auto", xl: "h-16 w-auto" };
  const word = { sm: "text-lg", md: "text-2xl", lg: "text-4xl", xl: "text-5xl" };
  const ink = tone === "onDark" ? "text-white" : "text-[#0B1F33]";

  return (
    <div className={`flex items-center gap-2.5 leading-none ${className}`}>
      <img src="/logo.png" alt="" width={542} height={456} className={`${mark[size]} shrink-0 object-contain`} />
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
