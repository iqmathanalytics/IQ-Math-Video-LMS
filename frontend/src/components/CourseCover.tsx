import { useState } from "react";
import { courseImageSrc } from "../utils/courseImage";

type Props = {
  title: string;
  imageUrl?: string | null;
  className?: string;
};

const CourseCover = ({ title, imageUrl, className }: Props) => {
  const letter = (title || "C").trim().charAt(0).toUpperCase() || "C";
  const src = courseImageSrc(imageUrl);
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
        className="h-full w-full object-cover"
        referrerPolicy="no-referrer"
        decoding="async"
        onError={() => setFailed(true)}
      />
    </div>
  );
};

export default CourseCover;
