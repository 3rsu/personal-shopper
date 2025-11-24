/**
 * Background Removal Wrapper
 * Uses @imgly/background-removal library for professional-grade AI background removal
 */

class BackgroundRemover {
  constructor() {
    this.debug = true;
    this.initialized = false;
    this.config = {
      debug: this.debug,
      device: 'cpu', // Use CPU to avoid GPU compatibility issues
      model: 'isnet_quint8', // Small model (~40MB) for faster loading
      output: {
        format: 'image/png',
        quality: 0.8,
        type: 'foreground'
      }
    };
  }

  /**
   * Main entry point: removes background from image and returns cleaned canvas
   * @param {HTMLImageElement|HTMLCanvasElement} image - The source image
   * @param {boolean} excludeTopPortion - Unused, kept for backward compatibility
   * @returns {Promise<HTMLCanvasElement|null>} - Canvas with background removed, or null on failure
   */
  async removeBackground(image, excludeTopPortion = false) {
    try {
      const startTime = performance.now();

      // Check if the library is available
      if (typeof window.imglyRemoveBackground !== 'function') {
        console.error('[BG Remover] @imgly/background-removal not loaded');
        return null;
      }

      if (this.debug) {
        console.log('[BG Remover] Starting background removal...');
      }

      // Convert HTMLImageElement or Canvas to Blob
      const blob = await this.imageToBlob(image);
      if (!blob) {
        console.error('[BG Remover] Failed to convert image to blob');
        return null;
      }

      // Call the background removal function
      const resultBlob = await window.imglyRemoveBackground(blob, this.config);

      // Convert result blob to canvas
      const canvas = await this.blobToCanvas(resultBlob);

      const endTime = performance.now();
      if (this.debug) {
        console.log(`[BG Remover] Processing completed in ${(endTime - startTime).toFixed(2)}ms`);
      }

      return canvas;
    } catch (e) {
      console.error('[BG Remover] Error:', e);
      return null;
    }
  }

  /**
   * Convert image or canvas to Blob
   */
  async imageToBlob(image) {
    return new Promise((resolve, reject) => {
      if (image instanceof Blob) {
        resolve(image);
        return;
      }

      // Convert to canvas if it's an image
      let canvas;
      if (image instanceof HTMLImageElement) {
        canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth || image.width;
        canvas.height = image.naturalHeight || image.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);
      } else if (image instanceof HTMLCanvasElement) {
        canvas = image;
      } else {
        reject(new Error('Unsupported image type'));
        return;
      }

      // Convert canvas to blob
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob'));
        }
      }, 'image/png');
    });
  }

  /**
   * Convert Blob to Canvas
   */
  async blobToCanvas(blob) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);

      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        resolve(canvas);
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image from blob'));
      };

      img.src = url;
    });
  }
}

// Export for use in content script
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BackgroundRemover;
}
