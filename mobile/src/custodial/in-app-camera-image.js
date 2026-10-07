// Canvas-derived JPEG only. Original files/EXIF/URLs never enter this path.
// Decoding/digest completion is still fenced by the acquisition owner.
const PROFILES = Object.freeze({
  cleaning: Object.freeze({ dimension: 768, bytes: 16 * 1024, characters: 22000 }),
  feedback: Object.freeze({ dimension: 1600, bytes: 2249982, characters: 3000000 }),
});
const failure = () => new Error('camera_photo_not_added');

export function freezeVideoFrame(video, createCanvas = () => document.createElement('canvas')) {
  const width = video.videoWidth, height = video.videoHeight;
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0
    || width > 8192 || height > 8192 || width * height > 16 * 1024 * 1024) throw failure();
  const canvas = createCanvas();
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) { canvas.width = 0; canvas.height = 0; throw failure(); }
  try { context.drawImage(video, 0, 0, width, height); }
  catch (error) { canvas.width = 0; canvas.height = 0; throw error; }
  let closed = false;
  return Object.freeze({ width, height,
    draw(target, targetWidth, targetHeight) {
      if (closed) throw failure();
      target.drawImage(canvas, 0, 0, targetWidth, targetHeight);
    },
    close() { if (closed) return; closed = true; canvas.width = 0; canvas.height = 0; },
  });
}

export async function encodeCameraJpeg(frame, profileName, {
  createCanvas = () => document.createElement('canvas'),
  decode = blob => createImageBitmap(blob),
  digest = bytes => crypto.subtle.digest('SHA-256', bytes),
  fromBase64 = value => atob(value),
  makeBlob = bytes => new Blob([bytes], { type: 'image/jpeg' }),
} = {}) {
  const profile = typeof profileName === 'string' && Object.hasOwn(PROFILES, profileName) ? PROFILES[profileName] : null;
  if (!profile || !frame || !Number.isSafeInteger(frame.width) || !Number.isSafeInteger(frame.height)
    || frame.width <= 0 || frame.height <= 0 || frame.width > 8192 || frame.height > 8192
    || frame.width * frame.height > 16 * 1024 * 1024 || typeof frame.draw !== 'function') throw failure();
  const canvas = createCanvas();
  try {
    // Finite re-encoding attempts, never quality/size recursion without a bound.
    for (const factor of [1, 0.8, 0.6, 0.4, 0.25]) {
      const scale = Math.min(1, profile.dimension * factor / Math.max(frame.width, frame.height));
      const width = Math.max(1, Math.round(frame.width * scale));
      const height = Math.max(1, Math.round(frame.height * scale));
      canvas.width = width; canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) throw failure();
      frame.draw(context, width, height);
      for (const quality of [0.78, 0.65, 0.5, 0.35]) {
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        if (typeof dataUrl !== 'string' || dataUrl.length > profile.characters) continue;
        const match = /^data:image\/jpeg;base64,((?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?)$/.exec(dataUrl);
        if (!match || !match[1]) throw failure();
        const binary = fromBase64(match[1]);
        if (binary.length > profile.bytes) continue;
        const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
        if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8
          || bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) throw failure();
        let bitmap;
        try {
          bitmap = await decode(makeBlob(bytes));
          if (!bitmap || bitmap.width !== width || bitmap.height !== height) throw failure();
        } finally { bitmap?.close?.(); }
        const hash = new Uint8Array(await digest(bytes));
        if (hash.length !== 32) throw failure();
        return Object.freeze({ content_type: 'image/jpeg',
          width, height, decoded_bytes: bytes.length,
          sha256: Array.from(hash, value => value.toString(16).padStart(2, '0')).join(''), data_url: dataUrl });
      }
    }
    throw failure();
  } finally { canvas.width = 0; canvas.height = 0; }
}
