/**
 * Klijentska kompresija slike pre uploada.
 * Downscale na max dimenziju + JPEG kompresija -> manji fajl, manji storage trošak,
 * brže učitavanje. Ako bilo šta krene po zlu, vraća originalni fajl (bezbedan fallback).
 */
const MAX_DIMENSION = 1600;
const QUALITY = 0.82;

export async function compressImage(file: File): Promise<File> {
  // Kompresuj samo prave rasterske slike; GIF (animacija) i ne-slike ostavi
  if (!file.type.startsWith('image/') || file.type === 'image/gif') {
    return file;
  }

  try {
    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = dataUrl;
    });

    let { width, height } = img;
    const longest = Math.max(width, height);
    if (longest > MAX_DIMENSION) {
      const scale = MAX_DIMENSION / longest;
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, width, height);

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', QUALITY)
    );
    if (!blob || blob.size >= file.size) {
      // Ako kompresija nije pomogla, zadrži original
      return file;
    }

    const newName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], newName, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

/**
 * Kompresija za male portfolio thumbnail-e (npr. sopstvena sličica za
 * Instagram/TikTok link kad kreator ne želi generički placeholder).
 * Agresivan downscale + kvalitet dok fajl ne stane pod THUMB_MAX_BYTES,
 * bez obzira koliko je original velik (10MB PNG, itd.) - nema smisla da
 * takva slika opterećuje bazu/storage. Vraća data: URL (čuva se direktno
 * u portfolio JSON-u, kao i naš postojeći placeholder).
 */
const THUMB_MAX_DIMENSION = 480;
const THUMB_MAX_BYTES = 50 * 1024;

export async function compressThumbnailToDataUrl(file: File): Promise<string> {
  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });

  let maxDim = THUMB_MAX_DIMENSION;
  let best = dataUrl;

  for (let shrinkAttempt = 0; shrinkAttempt < 4; shrinkAttempt++) {
    let { width, height } = img;
    const longest = Math.max(width, height);
    if (longest > maxDim) {
      const scale = maxDim / longest;
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) break;
    ctx.drawImage(img, 0, 0, width, height);

    for (const quality of [0.7, 0.5, 0.35, 0.2]) {
      const candidate = canvas.toDataURL('image/jpeg', quality);
      best = candidate;
      // Base64 je ~4/3 stvarne veličine bajtova
      const approxBytes = Math.round((candidate.length * 3) / 4);
      if (approxBytes <= THUMB_MAX_BYTES) {
        return candidate;
      }
    }

    maxDim = Math.round(maxDim * 0.65);
  }

  return best; // najbolje što smo uspeli da postignemo
}
