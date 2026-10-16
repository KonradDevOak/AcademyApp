// The longest edge a child photo is scaled down to before upload — plenty for an avatar-sized picture on the
// trainer's screen, and keeps the file far below the server's 2 MB limit.
export const MAX_PHOTO_EDGE = 512;
const JPEG_QUALITY = 0.85;

export const ACCEPTED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

// Originals larger than this are refused before decoding — a multi-hundred-megapixel image would stall the tab.
export const MAX_SOURCE_BYTES = 20 * 1024 * 1024;

// Scales to fit within maxEdge on the longest side, keeping the aspect ratio; never upscales.
export function computeTargetSize(width: number, height: number, maxEdge = MAX_PHOTO_EDGE): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

// Decodes the file, redraws it on a canvas at the target size and re-encodes it as JPEG. Re-encoding through a
// canvas also drops all metadata (EXIF, including GPS position); `imageOrientation: 'from-image'` applies the
// camera's rotation first so the picture is not saved sideways.
export async function resizeToJpeg(file: Blob, maxEdge = MAX_PHOTO_EDGE): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const { width, height } = computeTargetSize(bitmap.width, bitmap.height, maxEdge);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is not available.');
    context.drawImage(bitmap, 0, 0, width, height);

    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Could not encode the photo.'))), 'image/jpeg', JPEG_QUALITY)
    );
  } finally {
    bitmap.close();
  }
}
