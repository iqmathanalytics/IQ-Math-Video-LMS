import type { MouseEvent } from "react";
import { splitCourseText } from "../utils/courseText";

type Props = {
  description?: string;
  /** When set, Syllabus uses this instead of opening the external URL. */
  onSyllabusClick?: (event: MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => void;
};

const CourseFacts = ({ description, onSyllabusClick }: Props) => {
  const { duration, syllabus, text } = splitCourseText(description);
  if (!duration && !syllabus && !text) return null;
  return (
    <div className="mt-2 text-sm iq-muted">
      {duration && <p>{duration}</p>}
      {text && <p className={duration ? "mt-1" : ""}>{text}</p>}
      {syllabus && (
        onSyllabusClick ? (
          <button type="button" className="iq-link mt-1 inline-block text-left" onClick={onSyllabusClick}>
            Syllabus
          </button>
        ) : (
          <a className="iq-link" href={syllabus} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
            Syllabus
          </a>
        )
      )}
    </div>
  );
};

export default CourseFacts;
