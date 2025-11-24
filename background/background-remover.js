/**
 * Background Removal Module
 * Removes backgrounds from product images to improve color extraction accuracy
 */

class BackgroundRemover {
  constructor() {
    this.debug = true;
  }

  /**
   * Main entry point: removes background from image and returns cleaned canvas
   * @param {HTMLImageElement} image - The source image
   * @returns {HTMLCanvasElement|null} - Canvas with background removed, or null on failure
   */
  removeBackground(image) {
    try {
      // Create working canvas
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(image, 0, 0);

      // Try different strategies in order
      const strategies = [
        () => this.removeByAlphaChannel(canvas, ctx),
        () => this.removeByEdgeDetection(canvas, ctx),
        () => this.removeByCornerFloodFill(canvas, ctx),
        () => this.removeByCenterCrop(canvas, ctx)
      ];

      for (const strategy of strategies) {
        const result = strategy();
        if (result) {
          if (this.debug) {
            console.log('[Background Remover] Successfully applied strategy:', strategy.name);
          }
          return result;
        }
      }

      // If all strategies fail, return center-crop as last resort
      return this.removeByCenterCrop(canvas, ctx);
    } catch (e) {
      console.error('[Background Remover] Error:', e);
      return null;
    }
  }

  /**
   * Strategy 1: Remove background using alpha channel (for transparent PNGs)
   */
  removeByAlphaChannel(canvas, ctx) {
    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Check if image has meaningful transparency
      let transparentPixels = 0;
      let opaquePixels = 0;

      for (let i = 3; i < data.length; i += 4) {
        if (data[i] < 128) {
          transparentPixels++;
        } else {
          opaquePixels++;
        }
      }

      // If at least 10% of pixels are transparent, use alpha channel
      const transparencyRatio = transparentPixels / (transparentPixels + opaquePixels);
      if (transparencyRatio > 0.1) {
        // Create new canvas with only opaque pixels
        const result = document.createElement('canvas');
        result.width = canvas.width;
        result.height = canvas.height;
        const resultCtx = result.getContext('2d');

        // Copy only pixels with alpha > 128
        const resultData = resultCtx.createImageData(canvas.width, canvas.height);
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] > 128) {
            resultData.data[i] = data[i];
            resultData.data[i + 1] = data[i + 1];
            resultData.data[i + 2] = data[i + 2];
            resultData.data[i + 3] = 255;
          }
        }

        resultCtx.putImageData(resultData, 0, 0);
        return result;
      }

      return null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Strategy 2: Remove background using edge detection
   */
  removeByEdgeDetection(canvas, ctx) {
    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Find edges using simple gradient detection
      const edges = new Uint8Array(canvas.width * canvas.height);
      const threshold = 30;

      for (let y = 1; y < canvas.height - 1; y++) {
        for (let x = 1; x < canvas.width - 1; x++) {
          const idx = (y * canvas.width + x) * 4;
          const idxRight = (y * canvas.width + x + 1) * 4;
          const idxDown = ((y + 1) * canvas.width + x) * 4;

          // Calculate gradients
          const gradX = Math.abs(data[idx] - data[idxRight]) +
                       Math.abs(data[idx + 1] - data[idxRight + 1]) +
                       Math.abs(data[idx + 2] - data[idxRight + 2]);

          const gradY = Math.abs(data[idx] - data[idxDown]) +
                       Math.abs(data[idx + 1] - data[idxDown + 1]) +
                       Math.abs(data[idx + 2] - data[idxDown + 2]);

          const gradient = Math.sqrt(gradX * gradX + gradY * gradY);
          edges[y * canvas.width + x] = gradient > threshold ? 1 : 0;
        }
      }

      // Find the largest connected component (likely the product)
      const mask = this.findLargestComponent(edges, canvas.width, canvas.height);

      // Check if we found a meaningful foreground (at least 15% of image)
      const foregroundRatio = mask.reduce((sum, val) => sum + val, 0) / mask.length;
      if (foregroundRatio < 0.15 || foregroundRatio > 0.85) {
        return null; // Too small or too large, probably not a good separation
      }

      // Create result canvas with only foreground pixels
      return this.applyMask(canvas, mask);
    } catch (e) {
      return null;
    }
  }

  /**
   * Strategy 3: Remove background by flood-filling from corners
   */
  removeByCornerFloodFill(canvas, ctx) {
    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const mask = new Uint8Array(canvas.width * canvas.height).fill(1);

      // Sample corner colors
      const corners = [
        { x: 0, y: 0 },
        { x: canvas.width - 1, y: 0 },
        { x: 0, y: canvas.height - 1 },
        { x: canvas.width - 1, y: canvas.height - 1 }
      ];

      // Get corner color (average of all corners)
      let avgR = 0, avgG = 0, avgB = 0;
      corners.forEach(corner => {
        const idx = (corner.y * canvas.width + corner.x) * 4;
        avgR += data[idx];
        avgG += data[idx + 1];
        avgB += data[idx + 2];
      });
      avgR /= corners.length;
      avgG /= corners.length;
      avgB /= corners.length;

      // Flood fill from corners with similar colors
      const tolerance = 40;
      const visited = new Uint8Array(canvas.width * canvas.height);

      const floodFill = (startX, startY) => {
        const stack = [{ x: startX, y: startY }];

        while (stack.length > 0) {
          const { x, y } = stack.pop();

          if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) continue;

          const idx = y * canvas.width + x;
          if (visited[idx]) continue;

          const pixelIdx = idx * 4;
          const colorDiff = Math.sqrt(
            Math.pow(data[pixelIdx] - avgR, 2) +
            Math.pow(data[pixelIdx + 1] - avgG, 2) +
            Math.pow(data[pixelIdx + 2] - avgB, 2)
          );

          if (colorDiff > tolerance) continue;

          visited[idx] = 1;
          mask[idx] = 0; // Mark as background

          // Add neighbors
          stack.push({ x: x + 1, y });
          stack.push({ x: x - 1, y });
          stack.push({ x, y: y + 1 });
          stack.push({ x, y: y - 1 });
        }
      };

      // Flood fill from each corner
      corners.forEach(corner => floodFill(corner.x, corner.y));

      // Check if we removed a reasonable amount (10-70% of pixels)
      const foregroundRatio = mask.reduce((sum, val) => sum + val, 0) / mask.length;
      if (foregroundRatio < 0.3 || foregroundRatio > 0.9) {
        return null; // Didn't remove enough or removed too much
      }

      return this.applyMask(canvas, mask);
    } catch (e) {
      return null;
    }
  }

  /**
   * Strategy 4: Center-crop weighted sampling (fallback)
   * Assumes product is in the center and weights those pixels more heavily
   */
  removeByCenterCrop(canvas, ctx) {
    try {
      // Create a mask that gives more weight to center pixels
      // We'll crop to center 70% of the image
      const cropPercent = 0.70;
      const cropWidth = Math.floor(canvas.width * cropPercent);
      const cropHeight = Math.floor(canvas.height * cropPercent);
      const startX = Math.floor((canvas.width - cropWidth) / 2);
      const startY = Math.floor((canvas.height - cropHeight) / 2);

      const result = document.createElement('canvas');
      result.width = cropWidth;
      result.height = cropHeight;
      const resultCtx = result.getContext('2d');

      // Draw the center crop
      resultCtx.drawImage(
        canvas,
        startX, startY, cropWidth, cropHeight,
        0, 0, cropWidth, cropHeight
      );

      return result;
    } catch (e) {
      return null;
    }
  }

  /**
   * Helper: Find largest connected component in edge image
   */
  findLargestComponent(edges, width, height) {
    const visited = new Uint8Array(width * height);
    const mask = new Uint8Array(width * height);
    let largestSize = 0;
    let largestComponent = null;

    const floodFill = (startIdx) => {
      const component = [];
      const stack = [startIdx];

      while (stack.length > 0) {
        const idx = stack.pop();
        if (visited[idx] || !edges[idx]) continue;

        visited[idx] = 1;
        component.push(idx);

        const x = idx % width;
        const y = Math.floor(idx / width);

        // Add 4-connected neighbors
        if (x > 0) stack.push(idx - 1);
        if (x < width - 1) stack.push(idx + 1);
        if (y > 0) stack.push(idx - width);
        if (y < height - 1) stack.push(idx + width);
      }

      return component;
    };

    // Find all components
    for (let i = 0; i < edges.length; i++) {
      if (edges[i] && !visited[i]) {
        const component = floodFill(i);
        if (component.length > largestSize) {
          largestSize = component.length;
          largestComponent = component;
        }
      }
    }

    // Fill the mask with the largest component
    if (largestComponent) {
      largestComponent.forEach(idx => mask[idx] = 1);

      // Dilate the mask to include pixels near edges
      this.dilateMask(mask, width, height, 5);
    }

    return mask;
  }

  /**
   * Helper: Dilate a binary mask
   */
  dilateMask(mask, width, height, iterations) {
    const temp = new Uint8Array(mask.length);

    for (let iter = 0; iter < iterations; iter++) {
      temp.set(mask);

      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const idx = y * width + x;
          if (temp[idx]) {
            mask[idx - 1] = 1;
            mask[idx + 1] = 1;
            mask[idx - width] = 1;
            mask[idx + width] = 1;
          }
        }
      }
    }
  }

  /**
   * Helper: Apply mask to canvas
   */
  applyMask(canvas, mask) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Zero out pixels not in mask
    for (let i = 0; i < mask.length; i++) {
      if (!mask[i]) {
        const pixelIdx = i * 4;
        data[pixelIdx + 3] = 0; // Make transparent
      }
    }

    // Create result canvas
    const result = document.createElement('canvas');
    result.width = canvas.width;
    result.height = canvas.height;
    const resultCtx = result.getContext('2d');
    resultCtx.putImageData(imageData, 0, 0);

    return result;
  }
}

// Export for use in content script
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BackgroundRemover;
}
