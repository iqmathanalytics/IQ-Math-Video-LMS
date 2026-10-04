import { useEffect, useId, useRef } from "react";
import { youtubeIdFromLink } from "../utils/youtube";

type Props = {
  url: string;
  title?: string;
  className?: string;
  /** Fires once when a YouTube lesson reaches the end. Drive embeds cannot report this. */
  onEnded?: () => void;
};

const ytOriginOk = (origin: string) =>
  origin === "https://www.youtube.com" || origin === "https://www.youtube-nocookie.com";

/**
 * Plays YouTube or Drive lesson media. For YouTube, listens for player ENDED
 * so the parent can auto-tick Mark as Complete.
 */
const LessonMedia = ({ url, title = "Lesson", className = "aspect-video w-full bg-black", onEnded }: Props) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const endedRef = useRef(false);
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;
  const playerId = useId().replace(/:/g, "");

  const raw = String(url || "").trim();
  const videoId = youtubeIdFromLink(raw);
  const drive = raw.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
  const pageOrigin = typeof window !== "undefined" ? window.location.origin : "";

  const src = videoId
    ? `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&enablejsapi=1&origin=${encodeURIComponent(pageOrigin)}`
    : drive
      ? `https://drive.google.com/file/d/${drive[1]}/preview`
      : raw.includes("drive.google.com")
        ? raw.replace(/\/view.*/, "/preview").replace(/\/edit.*/, "/preview")
        : "";

  const trackEnded = Boolean(onEnded);

  useEffect(() => {
    endedRef.current = false;
    if (!videoId || !trackEnded) return;

    const notifyListening = () => {
      const win = iframeRef.current?.contentWindow;
      if (!win) return;
      try {
        win.postMessage(JSON.stringify({ event: "listening", id: playerId }), "*");
      } catch {
        /* ignore */
      }
    };

    const onMessage = (event: MessageEvent) => {
      if (!ytOriginOk(event.origin)) return;
      let data: unknown = event.data;
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch {
          return;
        }
      }
      if (!data || typeof data !== "object") return;
      const payload = data as { event?: string; info?: number | { playerState?: number }; id?: string };
      if (payload.id && payload.id !== playerId) return;

      let state: number | undefined;
      if (payload.event === "onStateChange" && typeof payload.info === "number") state = payload.info;
      else if (payload.info && typeof payload.info === "object" && typeof payload.info.playerState === "number") {
        state = payload.info.playerState;
      }
      // YouTube PlayerState.ENDED === 0
      if (state === 0 && !endedRef.current) {
        endedRef.current = true;
        onEndedRef.current?.();
      }
    };

    window.addEventListener("message", onMessage);
    const kick = window.setInterval(notifyListening, 800);
    const iframe = iframeRef.current;
    iframe?.addEventListener("load", notifyListening);

    return () => {
      window.removeEventListener("message", onMessage);
      window.clearInterval(kick);
      iframe?.removeEventListener("load", notifyListening);
    };
  }, [videoId, playerId, trackEnded]);

  if (!src) {
    return <div className={`flex items-center justify-center p-10 text-center text-sm ${className}`}>This lesson has no playable video.</div>;
  }

  return (
    <div className={className}>
      <iframe
        ref={iframeRef}
        id={`yt-${playerId}`}
        key={src}
        className="h-full w-full"
        src={src}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  );
};

export default LessonMedia;
