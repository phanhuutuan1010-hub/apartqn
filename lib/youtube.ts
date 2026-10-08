/** YouTube links (watch / youtu.be / shorts / embed) → 11-char video id. Anything else → null. */
export const YOUTUBE_RE = /^https:\/\/(www\.)?(youtube\.com\/(watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;

export function youtubeId(url: string | null | undefined): string | null {
  const m = url ? YOUTUBE_RE.exec(url.trim()) : null;
  return m ? m[4] : null;
}

/** Normalise what staff paste (m.youtube.com, http, extra params) to https://youtu.be/<id>; null when not YouTube. */
export function normaliseYoutube(input: string): string | null {
  const s = input.trim().replace(/^http:\/\//, 'https://').replace('://m.youtube.com', '://www.youtube.com').replace('://youtube.com', '://www.youtube.com');
  const id = youtubeId(s);
  return id ? `https://youtu.be/${id}` : null;
}
