/** Turn a stored cover value into an address an <img> can load. */
export const courseImageSrc = (value?: string | null) => {
  const raw = (value || "").trim();
  if (!raw) return "";
  const file = raw.match(/drive\.google\.com\/file\/d\/([^/?]+)/i);
  const query = raw.match(/drive\.google\.com\/.*[?&]id=([^&]+)/i);
  const id = file?.[1] || query?.[1];
  if (id) return `https://drive.google.com/thumbnail?id=${id}&sz=w1200`;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return "";
};
