import Tesseract from "tesseract.js";

export type DocQualityResult = {
  ok: boolean;
  reason?: string;
  blurScore?: number;
  textLength?: number;
};

const BLUR_THRESHOLD = 60; // Laplacian variance below this = too blurry
const MIN_TEXT_CHARS = 8; // recognized alphanumeric chars — proxy for "a document is actually here"
const MAX_DIM = 700; // downscale for speed; blur/OCR don't need full resolution

function fileToImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve(img);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };
    img.src = url;
  });
}

function laplacianVariance(gray: Float32Array, w: number, h: number): number {
  let sum = 0;
  let sumSq = 0;
  let count = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - w] - gray[i + w];
      sum += lap;
      sumSq += lap * lap;
      count++;
    }
  }
  if (count === 0) return 0;
  const mean = sum / count;
  return sumSq / count - mean * mean;
}

/**
 * Runs two free, in-browser checks on a document photo before it's uploaded:
 *  1. Blur detection (Laplacian variance on a grayscale downscale) — catches
 *     shaky/out-of-focus photos.
 *  2. OCR text-presence check (Tesseract.js) — catches photos of the wrong
 *     thing entirely (a wall, a hand, a blank page) by confirming there's
 *     actually readable text on it.
 * This is NOT forgery detection — it only filters out obviously unusable photos
 * before they reach admin review.
 */
export async function checkDocumentImageQuality(file: File): Promise<DocQualityResult> {
  try {
    const img = await fileToImage(file);
    const scale = Math.min(1, MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return { ok: true }; // fail-open if canvas unsupported on this device

    ctx.drawImage(img, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    const gray = new Float32Array(w * h);
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      gray[j] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }

    const blurScore = laplacianVariance(gray, w, h);
    if (blurScore < BLUR_THRESHOLD) {
      return {
        ok: false,
        reason: "This photo looks blurry. Hold your camera steady, make sure there's good light, and try again.",
        blurScore,
      };
    }

    const { data: ocrData } = await Tesseract.recognize(canvas, "eng", { logger: () => {} });
    const text = (ocrData.text || "").replace(/[^a-zA-Z0-9]/g, "");
    if (text.length < MIN_TEXT_CHARS) {
      return {
        ok: false,
        reason: "We couldn't read any text on this photo. Make sure the whole document is visible, flat, and well-lit.",
        blurScore,
        textLength: text.length,
      };
    }

    return { ok: true, blurScore, textLength: text.length };
  } catch {
    // If the check itself fails (corrupt file, OCR engine couldn't load, etc.)
    // fail OPEN — a broken client-side tool shouldn't block a legitimate submission.
    return { ok: true };
  }
}
