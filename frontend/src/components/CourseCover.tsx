import { useEffect, useState } from "react";
import {
  courseImageFallbackSrc,
  courseImageSizesAttr,
  courseImageSrc,
  courseImageSrcSet,
  type CourseImageSize,
} from "../utils/courseImage";

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
  const primary = courseImageSrc(imageUrl, size);
  const fallback = courseImageFallbackSrc(imageUrl, size);
  const [src, setSrc] = useState(primary);
  const [failed, setFailed] = useState(false);
  const frame = `aspect-video w-full overflow-hidden bg-[var(--iq-inset,#e8eef5)] ${className ?? "rounded-xl"}`;

  useEffect(() => {
    setSrc(primary);
    setFailed(false);
  }, [primary]);

  if (!primary || failed) {
    return (
      <div className={`flex items-center justify-center text-3xl font-semibold text-white ${frame}`} style={{ background: "#005EB8" }} aria-hidden>
        {letter}
      </div>
    );
  }

  return (
    <div className={frame} style={{ contentVisibility: priority ? "visible" : "auto", containIntrinsicSize: "360px 200px" }}>
      <img
        src={src}
        srcSet={src === primary ? courseImageSrcSet(imageUrl, size) : undefined}
        alt=""
        width={size === "large" ? 960 : size === "medium" ? 640 : 360}
        height={size === "large" ? 540 : size === "medium" ? 360 : 200}
        sizes={courseImageSizesAttr(size)}
        className="h-full w-full object-cover"
        referrerPolicy="no-referrer"
        decoding={priority ? "sync" : "async"}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "low"}
        onError={() => {
          if (fallback && src !== fallback) {
            setSrc(fallback);
            return;
          }
          setFailed(true);
        }}
      />
    </div>
  );
};

export default CourseCover;
