/** Card-sized covers load much faster than full Drive originals. */
export type CourseImageSize = "card" | "medium" | "large";

const WIDTH: Record<CourseImageSize, number> = {
  card: 360,
  medium: 640,
  large: 960,
};

const driveFileId = (value?: string | null) => {
  const raw = (value || "").trim();
  if (!raw) return "";
  const file = raw.match(/drive\.google\.com\/file\/d\/([^/?]+)/i);
  const query = raw.match(/drive\.google\.com\/.*[?&]id=([^&]+)/i);
  const uc = raw.match(/drive\.google\.com\/uc\?.*(?:id|export)=([^&]+)/i);
  const lh = raw.match(/lh3\.googleusercontent\.com\/d\/([^="?]+)/i);
  return file?.[1] || query?.[1] || uc?.[1] || lh?.[1] || "";
};

/** Fast Google user-content CDN URL (preferred). */
export const courseImageSrc = (value?: string | null, size: CourseImageSize = "card") => {
  const raw = (value || "").trim();
  if (!raw) return "";
  const id = driveFileId(raw);
  if (id) return `https://lh3.googleusercontent.com/d/${id}=w${WIDTH[size]}`;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return "";
};

/** Slower Drive thumbnail fallback if the CDN URL fails. */
export const courseImageFallbackSrc = (value?: string | null, size: CourseImageSize = "card") => {
  const id = driveFileId(value);
  if (!id) return "";
  return `https://drive.google.com/thumbnail?id=${id}&sz=w${WIDTH[size]}`;
};

export const courseImageSrcSet = (value?: string | null, size: CourseImageSize = "card") => {
  const id = driveFileId(value);
  if (!id) return undefined;
  const base = WIDTH[size];
  const widths = [Math.round(base * 0.75), base, Math.round(base * 1.5)];
  return widths.map((w) => `https://lh3.googleusercontent.com/d/${id}=w${w} ${w}w`).join(", ");
};

export const courseImageSizesAttr = (size: CourseImageSize = "card") => {
  if (size === "large") return "(min-width: 768px) 720px, 100vw";
  if (size === "medium") return "(min-width: 768px) 640px, 100vw";
  return "(min-width: 1024px) 320px, (min-width: 640px) 40vw, 92vw";
};
