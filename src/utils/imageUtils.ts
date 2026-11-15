/**
 * Utility functions for resizing and cropping images to a maximum of 400px x 400px
 * for user avatars, emblems, status badges, and marketplace images.
 */

/**
 * Resizes an image (File or Data URL) to fit within maxWidth x maxHeight (default 400x400).
 * Preserves aspect ratio.
 */
export async function resizeImageToMax(
  input: File | string,
  maxWidth: number = 400,
  maxHeight: number = 400,
  quality: number = 0.92
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (typeof input === 'string' && input.startsWith('http')) {
      img.crossOrigin = 'anonymous';
    }

    const handleLoad = () => {
      let width = img.width;
      let height = img.height;

      // Calculate constrained dimensions (max 400x400)
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, width);
      canvas.height = Math.max(1, height);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get 2D context from canvas'));
        return;
      }

      // Smooth resizing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      // Export as PNG/DataURL
      const dataUrl = canvas.toDataURL('image/png', quality);
      resolve(dataUrl);
    };

    img.onerror = (err) => reject(new Error('Failed to load image for resizing'));

    if (typeof input === 'string') {
      img.src = input;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(input);
    }
  });
}

/**
 * Crops a portion of an image and scales it to a max output dimension (default 400x400).
 */
export async function cropAndScaleImage(
  imageSrc: string,
  cropArea: { x: number; y: number; width: number; height: number },
  targetWidth: number = 400,
  targetHeight: number = 400
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (imageSrc.startsWith('http')) {
      img.crossOrigin = 'anonymous';
    }

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Failed to get 2D context'));
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Draw specified crop area of source image into target 400x400 canvas
      ctx.drawImage(
        img,
        cropArea.x,
        cropArea.y,
        cropArea.width,
        cropArea.height,
        0,
        0,
        targetWidth,
        targetHeight
      );

      resolve(canvas.toDataURL('image/png', 0.92));
    };

    img.onerror = (err) => reject(err);
    img.src = imageSrc;
  });
}
