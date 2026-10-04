import { useState } from "react";
import { courseImageSrc, type CourseImageSize } from "../utils/courseImage";

type Props = {
  title: string;
  imageUrl?: string | null;
  className?: string;
  /** Keep card size for grids; use medium only for wider hero spots. */
  size?: CourseImageSize;
  priority?: boolean;
};

const CourseCover = ({ title, imageUrl, className, size = "card", priority = false }: Props) => {
  const letter = (title || "C").trim().charAt(0).toUpperCase() || "C";
  const src = courseImageSrc(imageUrl, size);
  const [failed, setFailed] = useState(false);
  const frame = `aspect-video w-full overflow-hidden bg-[var(--iq-inset,#e8eef5)] ${className ?? "rounded-xl"}`;

  if (!src || failed) {
    return (
      <div className={`flex items-center justify-center text-3xl font-semibold text-white ${frame}`} style={{ background: "#005EB8" }} aria-hidden>
        {letter}
      </div>
    );
  }

  return (
    <div className={frame}>
      <img
        src={src}
        alt=""
        width={640}
        height={360}
        sizes={size === "large" ? "(min-width: 768px) 720px, 100vw" : "(min-width: 1024px) 360px, (min-width: 640px) 45vw, 100vw"}
        className="h-full w-full object-cover"
        referrerPolicy="no-referrer"
        decoding="async"
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "low"}
        onError={() => setFailed(true)}
      />
    </div>
  );
};

export default CourseCover;
