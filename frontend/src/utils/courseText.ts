export type CourseText = {
  duration: string;
  syllabus: string;
  text: string;
};

const URL_PATTERN = /https?:\/\/[^\s]+/g;

export const splitCourseText = (value?: string | null): CourseText => {
  const raw = (value || "").trim();
  const durationMatch = raw.match(/\[Duration:\s*([^\]]+)\]/i);
  const withoutDuration = raw.replace(/\n*\[Duration:\s*[^\]]+\]/gi, "").trim();
  const syllabus = (withoutDuration.match(URL_PATTERN) || []).find((url) => /docs\.google\.com|drive\.google\.com/i.test(url)) || "";
  const text = withoutDuration.replace(URL_PATTERN, "").replace(/\s+/g, " ").trim();
  return {
    duration: durationMatch ? durationMatch[1].trim() : "",
    syllabus,
    text,
  };
};
