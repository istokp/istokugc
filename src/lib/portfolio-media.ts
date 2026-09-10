/**
 * Shared helpers for portfolio click / playback across admin, dashboard, public profile.
 */

// Sličica kad nemamo pravu (Instagram/TikTok ne dozvoljavaju direktan pristup thumbnail-u,
// a i za direktno otpremljene video fajlove nemamo generisan frame) - jednostavan,
// minimalistički play-dugme umesto spoljne stock fotografije.
export const VIDEO_PLACEHOLDER_THUMBNAIL =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjUwMCIgdmlld0JveD0iMCAwIDQwMCA1MDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImJnIiB4MT0iMCIgeTE9IjAiIHgyPSIxIiB5Mj0iMSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiNmNWY1ZjUiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjZTVlNWU1Ii8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogIDwvZGVmcz4KICA8cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjUwMCIgZmlsbD0idXJsKCNiZykiLz4KICA8Y2lyY2xlIGN4PSIyMDAiIGN5PSIyNTAiIHI9IjQ4IiBmaWxsPSIjMWExYTFhIi8+CiAgPHBhdGggZD0iTTE4NiAyMjggTDIyMiAyNTAgTDE4NiAyNzIgWiIgZmlsbD0iI2ZmZmZmZiIvPgo8L3N2Zz4K';

// Neki stariji portfolio linkovi su sačuvani bez http(s):// prefiksa
// (npr. "www.tiktok.com/@..."). Kao <a href> to se tretira kao relativna
// putanja unutar sajta (npr. /kreator/www.tiktok.com/@...) umesto spoljni
// link. Normalizuj pre upotrebe u bilo kom href-u.
export function normalizeExternalUrl(url: string): string {
  if (!url) return url;
  const trimmed = url.trim();
  return /^(https?:)?\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

// Instagram/TikTok ne mogu da se prikažu inline (nema pravog embed-a), pa
// nema smisla otvarati poseban popup sa "Otvori na X" dugmetom - klik odmah
// otvara pravi video na platformi u novom tabu. YouTube i upload video se i
// dalje puštaju inline kroz VideoPlayerModal.
export function opensExternally(type: string): boolean {
  return type === 'instagram' || type === 'tiktok';
}

export type PortfolioVideoType = 'youtube' | 'instagram' | 'tiktok' | 'upload';

export function getPortfolioVideoType(item: {
  type?: string | null;
  url?: string | null;
}): PortfolioVideoType {
  const type = (item.type || '').toLowerCase();
  if (type === 'youtube' || type === 'tiktok' || type === 'instagram' || type === 'upload') {
    return type;
  }
  const url = (item.url || '').toLowerCase();
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('tiktok.com')) return 'tiktok';
  if (url.includes('instagram.com')) return 'instagram';
  return 'upload';
}

export function isPortfolioVideo(item: {
  type?: string | null;
  url?: string | null;
  thumbnail?: string | null;
}): boolean {
  const url = (item.url || '').toLowerCase();
  const type = (item.type || '').toLowerCase();

  if (type === 'youtube' || type === 'tiktok' || type === 'instagram') return true;
  if (/youtube\.com|youtu\.be|tiktok\.com|instagram\.com/.test(url)) return true;
  if (/\.(mp4|webm|mov|avi)(\?|$)/i.test(url)) return true;
  if (url.startsWith('data:video')) return true;
  if (type === 'upload' && (url.includes('video') || /\.(mp4|webm|mov|avi)(\?|$)/i.test(item.thumbnail || ''))) {
    return true;
  }
  return false;
}
