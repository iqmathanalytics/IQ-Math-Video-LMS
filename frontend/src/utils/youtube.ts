export type ParsedYouTube = { type: "video"; videoId: string; startSeconds: number } | { type: "playlist"; playlistId: string };

const startFromQuery = (value: string) => {
  const seconds = value.match(/[?&](?:t|start)=(\d+)/);
  if (seconds) return Number(seconds[1]);
  const clock = value.match(/[?&]t=(\d+)m(\d+)s/);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  return 0;
};

export const parseYouTubeUrl = (value: string): ParsedYouTube | null => {
  const raw = value.trim();
  if (!raw) return null;
  const videoPatterns = [
    /(?:v=|vi=)([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /youtube\.com\/(?:embed|shorts|live)\/([\w-]{11})/,
    /^([\w-]{11})$/,
  ];
  for (const pattern of videoPatterns) {
    const match = raw.match(pattern);
    if (match) return { type: "video", videoId: match[1], startSeconds: startFromQuery(raw) };
  }
  const playlist = raw.match(/[?&]list=([\w-]+)/);
  if (playlist) return { type: "playlist", playlistId: playlist[1] };
  return null;
};

export const embedSrcFromLink = (value: string) => {
  const raw = (value || "").trim();
  const videoId = youtubeIdFromLink(raw);
  if (videoId) return `https://www.youtube-nocookie.com/embed/${videoId}`;
  const drive = raw.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
  if (drive) return `https://drive.google.com/file/d/${drive[1]}/preview`;
  const doc = raw.match(/docs\.google\.com\/(document|presentation|spreadsheets)\/d\/([\w-]+)/);
  if (doc) return `https://docs.google.com/${doc[1]}/d/${doc[2]}/preview`;
  return "";
};

export const youtubeIdFromLink = (value: string) => {
  const raw = value.trim();
  const patterns = [
    /(?:v=|vi=)([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /youtube\.com\/(?:embed|shorts)\/([\w-]{11})/,
    /^([\w-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match) return match[1];
  }
  return "";
};
