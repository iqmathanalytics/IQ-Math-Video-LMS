/** Card-sized covers load much faster than full Drive originals. */
export type CourseImageSize = "card" | "medium" | "large";

const WIDTH: Record<CourseImageSize, number> = {
  card: 480,
  medium: 720,
  large: 960,
};

/** Turn a stored cover value into an address an <img> can load. */
export const courseImageSrc = (value?: string | null, size: CourseImageSize = "card") => {
  const raw = (value || "").trim();
  if (!raw) return "";
  const file = raw.match(/drive\.google\.com\/file\/d\/([^/?]+)/i);
  const query = raw.match(/drive\.google\.com\/.*[?&]id=([^&]+)/i);
  const id = file?.[1] || query?.[1];
  if (id) return `https://drive.google.com/thumbnail?id=${id}&sz=w${WIDTH[size]}`;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return "";
};
