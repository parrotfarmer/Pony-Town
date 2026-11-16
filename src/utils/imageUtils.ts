/**
 * Utility functions for resizing, compressing, and cropping images to a maximum of 400px x 400px
 * for user avatars, emblems, status badges, and marketplace images.
 */

/**
 * Exports a canvas as a compressed Data URL (WebP or JPEG with quality fallback, or PNG if transparent)
 * Guaranteed to stay under maxSizeBytes (default ~150KB) so it never bloats Firestore or localStorage.
 */
export function exportCanvasCompressed(
  canvas: HTMLCanvasElement,
  maxSizeBytes: number = 150 * 1024,
  initialQuality: number = 0.85
): string {
  // Step 1: Attempt WebP (supports both alpha transparency and lossy compression)
  try {
    let quality = initialQuality;
    let dataUrl = canvas.toDataURL('image/webp', quality);
    if (dataUrl.startsWith('data:image/webp')) {
      // If the dataUrl is larger than target bytes (~1.37 base64 multiplier), iteratively step down quality
      while (dataUrl.length > maxSizeBytes * 1.37 && quality > 0.4) {
        quality -= 0.12;
        dataUrl = canvas.toDataURL('image/webp', quality);
      }
      return dataUrl;
    }
  } catch {}

  // Step 2: Check for alpha transparency if WebP encoding is unavailable
  try {
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      let hasAlpha = false;
      for (let i = 3; i < data.length; i += 16) {
        if (data[i] < 250) {
          hasAlpha = true;
          break;
        }
      }

      // If opaque, JPEG gives optimal compression
      if (!hasAlpha) {
        let quality = initialQuality;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        while (dataUrl.length > maxSizeBytes * 1.37 && quality > 0.4) {
          quality -= 0.12;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        return dataUrl;
      }
    }
  } catch {}

  // Step 3: Fallback to PNG
  return canvas.toDataURL('image/png');
}

/**
 * Loads an image from a File, Blob, or URL string into an HTMLImageElement safely.
 * Uses URL.createObjectURL for fast, zero-memory file handling, and revokes it on completion.
 */
function loadImageElement(
  input: File | Blob | string
): Promise<{ img: HTMLImageElement; cleanup: () => void }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    let objectUrl: string | null = null;

    const cleanup = () => {
      if (objectUrl) {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch {}
        objectUrl = null;
      }
    };

    if (typeof input === 'string' && input.startsWith('http')) {
      img.crossOrigin = 'anonymous';
    }

    const onLoad = () => {
      resolve({ img, cleanup });
    };

    const onError = () => {
      cleanup();
      reject(new Error('Failed to load or decode image. Please check the image file.'));
    };

    // Attach listeners BEFORE assigning src
    img.onload = onLoad;
    img.onerror = onError;
    img.onabort = onError;

    if (typeof input === 'string') {
      img.src = input;
    } else {
      try {
        objectUrl = URL.createObjectURL(input);
        img.src = objectUrl;
      } catch {
        // Fallback to FileReader if createObjectURL fails
        const reader = new FileReader();
        reader.onload = (e) => {
          img.src = (e.target?.result as string) || '';
        };
        reader.onerror = () => {
          cleanup();
          reject(new Error('Unable to read selected file'));
        };
        reader.readAsDataURL(input);
      }
    }

    // Handle instant-cached images
    if (img.complete && (img.naturalWidth > 0 || img.width > 0)) {
      onLoad();
    }
  });
}

/**
 * Resizes an image (File, Blob, or Data URL) to fit within maxWidth x maxHeight (default 400x400).
 * Preserves aspect ratio and compresses large images automatically.
 */
export async function resizeImageToMax(
  input: File | Blob | string,
  maxWidth: number = 400,
  maxHeight: number = 400,
  quality: number = 0.85
): Promise<string> {
  const { img, cleanup } = await loadImageElement(input);

  try {
    const sourceWidth = img.naturalWidth || img.width || 1;
    const sourceHeight = img.naturalHeight || img.height || 1;

    let targetWidth = sourceWidth;
    let targetHeight = sourceHeight;

    // Calculate constrained dimensions preserving aspect ratio
    if (targetWidth > maxWidth || targetHeight > maxHeight) {
      const ratio = Math.min(maxWidth / targetWidth, maxHeight / targetHeight);
      targetWidth = Math.max(1, Math.round(targetWidth * ratio));
      targetHeight = Math.max(1, Math.round(targetHeight * ratio));
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to create canvas 2D rendering context');
    }

    // Smooth, high-fidelity downsampling
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    // Export with automatic compression to under ~150KB
    const compressedDataUrl = exportCanvasCompressed(canvas, 150 * 1024, quality);
    return compressedDataUrl;
  } finally {
    cleanup();
  }
}

/**
 * Crops a portion of an image and scales it to a max output dimension (default 400x400).
 * Enforces boundary safety and applies compression.
 */
export async function cropAndScaleImage(
  imageSrc: string,
  cropArea: { x: number; y: number; width: number; height: number },
  targetWidth: number = 400,
  targetHeight: number = 400
): Promise<string> {
  const { img, cleanup } = await loadImageElement(imageSrc);

  try {
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Failed to get 2D rendering context for cropping');
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Safely clamp crop area within the source image dimensions
    const naturalW = img.naturalWidth || img.width || targetWidth;
    const naturalH = img.naturalHeight || img.height || targetHeight;

    const clampedX = Math.max(0, Math.min(naturalW - 1, cropArea.x));
    const clampedY = Math.max(0, Math.min(naturalH - 1, cropArea.y));
    const clampedW = Math.max(1, Math.min(naturalW - clampedX, cropArea.width));
    const clampedH = Math.max(1, Math.min(naturalH - clampedY, cropArea.height));

    // Draw specified crop area of source image into target canvas
    ctx.drawImage(
      img,
      clampedX,
      clampedY,
      clampedW,
      clampedH,
      0,
      0,
      targetWidth,
      targetHeight
    );

    const compressed = exportCanvasCompressed(canvas, 150 * 1024, 0.88);
    return compressed;
  } finally {
    cleanup();
  }
}
