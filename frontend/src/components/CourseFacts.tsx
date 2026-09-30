import { splitCourseText } from "../utils/courseText";

const CourseFacts = ({ description }: { description?: string }) => {
  const { duration, syllabus, text } = splitCourseText(description);
  if (!duration && !syllabus && !text) return null;
  return (
    <div className="mt-2 text-sm iq-muted">
      {duration && <p>{duration}</p>}
      {text && <p className={duration ? "mt-1" : ""}>{text}</p>}
      {syllabus && (
        <a className="iq-link" href={syllabus} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
          Syllabus
        </a>
      )}
    </div>
  );
};

export default CourseFacts;
