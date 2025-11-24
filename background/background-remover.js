/**
 * Advanced Background Removal Module
 * Implements remove.bg-style background removal using computer vision algorithms
 * Including GrabCut-inspired segmentation, K-means clustering, and saliency detection
 */

class BackgroundRemover {
  constructor() {
    this.debug = false;
  }

  /**
   * Main entry point: removes background from image and returns cleaned canvas
   * @param {HTMLImageElement|HTMLCanvasElement} image - The source image
   * @param {boolean} excludeTopPortion - If true, excludes top 1/3.5 of image (removes face area)
   * @returns {HTMLCanvasElement|null} - Canvas with background removed, or null on failure
   */
  removeBackground(image, excludeTopPortion = true) {
    try {
      const startTime = performance.now();

      // Create working canvas
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(image, 0, 0);

      // Get image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Run advanced segmentation pipeline
      const mask = this.advancedSegmentation(imageData, canvas.width, canvas.height);

      if (!mask) {
        if (this.debug) console.log('[BG Remover] Segmentation failed, using fallback');
        return this.fallbackCenterCrop(canvas, excludeTopPortion);
      }

      // Apply spatial filtering to exclude top portion (face/head area)
      if (excludeTopPortion) {
        this.excludeTopRegion(mask, canvas.width, canvas.height);
      }

      // Apply mask to create result
      const result = this.applyMaskToImage(imageData, mask, canvas.width, canvas.height);

      const endTime = performance.now();
      if (this.debug) {
        console.log(`[BG Remover] Processing completed in ${(endTime - startTime).toFixed(2)}ms`);
      }

      return result;
    } catch (e) {
      console.error('[BG Remover] Error:', e);
      return null;
    }
  }

  /**
   * Exclude top 1/3.5 of the image to remove face/head area
   * This helps focus color extraction on clothing rather than skin/hair
   * @param {Uint8Array} mask - Binary mask (1 = keep, 0 = remove)
   * @param {number} width - Image width
   * @param {number} height - Image height
   */
  excludeTopRegion(mask, width, height) {
    const cutoffY = Math.floor(height / 3.5);

    // Set mask to 0 for all pixels in top 1/3.5
    for (let y = 0; y < cutoffY; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        mask[idx] = 0;
      }
    }
  }

  /**
   * Advanced segmentation pipeline combining multiple techniques
   */
  advancedSegmentation(imageData, width, height) {
    const data = imageData.data;

    // Step 1: Check for alpha channel (transparent images)
    const alphaResult = this.segmentByAlpha(data, width, height);
    if (alphaResult) {
      if (this.debug) console.log('[BG Remover] Using alpha channel segmentation');
      return alphaResult;
    }

    // Step 2: Try saliency-based segmentation (most robust for product images)
    const saliencyResult = this.segmentBySaliency(data, width, height);
    if (saliencyResult && this.validateMask(saliencyResult, width, height)) {
      if (this.debug) console.log('[BG Remover] Using saliency-based segmentation');
      return saliencyResult;
    }

    // Step 3: Try GrabCut-inspired segmentation
    const grabCutResult = this.grabCutSegmentation(data, width, height);
    if (grabCutResult && this.validateMask(grabCutResult, width, height)) {
      if (this.debug) console.log('[BG Remover] Using GrabCut-style segmentation');
      return grabCutResult;
    }

    // Step 4: Fallback to color clustering
    const clusterResult = this.segmentByColorClustering(data, width, height);
    if (clusterResult && this.validateMask(clusterResult, width, height)) {
      if (this.debug) console.log('[BG Remover] Using color clustering segmentation');
      return clusterResult;
    }

    return null;
  }

  /**
   * Strategy 1: Segment by alpha channel (for transparent PNGs)
   */
  segmentByAlpha(data, width, height) {
    let transparentPixels = 0;
    let opaquePixels = 0;

    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 128) transparentPixels++;
      else opaquePixels++;
    }

    const transparencyRatio = transparentPixels / (transparentPixels + opaquePixels);

    if (transparencyRatio < 0.05) return null; // Not a transparent image

    const mask = new Uint8Array(width * height);
    for (let i = 0; i < mask.length; i++) {
      mask[i] = data[i * 4 + 3] > 128 ? 1 : 0;
    }

    return mask;
  }

  /**
   * Strategy 2: Saliency-based segmentation
   * Detects visually important regions (usually the product)
   */
  segmentBySaliency(data, width, height) {
    // Calculate saliency map using frequency domain analysis
    const saliencyMap = this.calculateSaliencyMap(data, width, height);

    // Threshold saliency map to get initial mask
    const mean = saliencyMap.reduce((a, b) => a + b, 0) / saliencyMap.length;
    const std = Math.sqrt(
      saliencyMap.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / saliencyMap.length
    );

    const threshold = mean + 0.5 * std;
    const mask = new Uint8Array(width * height);

    for (let i = 0; i < saliencyMap.length; i++) {
      mask[i] = saliencyMap[i] > threshold ? 1 : 0;
    }

    // Morphological operations to clean up mask
    this.morphologicalClose(mask, width, height, 3);
    this.morphologicalOpen(mask, width, height, 2);

    // Keep only the largest connected component
    const refined = this.keepLargestComponent(mask, width, height);

    // Dilate slightly to include edges
    this.dilate(refined, width, height, 5);

    return refined;
  }

  /**
   * Calculate saliency map using spectral residual approach
   */
  calculateSaliencyMap(data, width, height) {
    const saliency = new Float32Array(width * height);
    const kernelSize = 3;
    const halfKernel = Math.floor(kernelSize / 2);

    // Simplified saliency: look for regions that stand out
    // Based on color and contrast differences from surroundings
    for (let y = halfKernel; y < height - halfKernel; y++) {
      for (let x = halfKernel; x < width - halfKernel; x++) {
        const idx = y * width + x;
        const pixelIdx = idx * 4;

        const centerR = data[pixelIdx];
        const centerG = data[pixelIdx + 1];
        const centerB = data[pixelIdx + 2];

        let totalDiff = 0;
        let count = 0;

        // Compare with neighbors
        for (let dy = -halfKernel; dy <= halfKernel; dy++) {
          for (let dx = -halfKernel; dx <= halfKernel; dx++) {
            if (dx === 0 && dy === 0) continue;

            const nIdx = ((y + dy) * width + (x + dx)) * 4;
            const diffR = centerR - data[nIdx];
            const diffG = centerG - data[nIdx + 1];
            const diffB = centerB - data[nIdx + 2];

            totalDiff += Math.sqrt(diffR * diffR + diffG * diffG + diffB * diffB);
            count++;
          }
        }

        saliency[idx] = totalDiff / count;
      }
    }

    // Apply Gaussian blur to saliency map
    return this.gaussianBlur(saliency, width, height, 5);
  }

  /**
   * Strategy 3: GrabCut-inspired segmentation
   * Iteratively refines foreground/background separation
   */
  grabCutSegmentation(data, width, height) {
    // Initial mask: assume center region is foreground
    const mask = this.getInitialMask(width, height);

    // Iterative refinement (simplified GrabCut)
    for (let iter = 0; iter < 3; iter++) {
      // Build color models for foreground and background
      const fgModel = this.buildColorModel(data, mask, width, height, 1);
      const bgModel = this.buildColorModel(data, mask, width, height, 0);

      // Reassign pixels based on color models
      for (let i = 0; i < width * height; i++) {
        const pixelIdx = i * 4;
        const r = data[pixelIdx];
        const g = data[pixelIdx + 1];
        const b = data[pixelIdx + 2];

        const fgDist = this.colorDistance([r, g, b], fgModel);
        const bgDist = this.colorDistance([r, g, b], bgModel);

        mask[i] = fgDist < bgDist ? 1 : 0;
      }

      // Morphological cleanup
      this.morphologicalClose(mask, width, height, 2);
    }

    // Keep largest component and refine edges
    const refined = this.keepLargestComponent(mask, width, height);
    this.dilate(refined, width, height, 3);

    return refined;
  }

  /**
   * Strategy 4: Color clustering (K-means)
   */
  segmentByColorClustering(data, width, height) {
    const k = 3; // Number of clusters
    const colors = [];

    // Sample colors from image (downsample for performance)
    const step = 4;
    for (let i = 0; i < data.length; i += 4 * step) {
      colors.push([data[i], data[i + 1], data[i + 2]]);
    }

    // K-means clustering
    const clusters = this.kMeans(colors, k);

    // Identify background cluster (usually from corners)
    const bgCluster = this.identifyBackgroundCluster(data, width, height, clusters);

    // Create mask
    const mask = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i++) {
      const pixelIdx = i * 4;
      const color = [data[pixelIdx], data[pixelIdx + 1], data[pixelIdx + 2]];
      const cluster = this.findNearestCluster(color, clusters);
      mask[i] = cluster === bgCluster ? 0 : 1;
    }

    // Clean up mask
    this.morphologicalClose(mask, width, height, 3);
    const refined = this.keepLargestComponent(mask, width, height);
    this.dilate(refined, width, height, 4);

    return refined;
  }

  /**
   * K-means clustering algorithm
   */
  kMeans(points, k, maxIter = 10) {
    // Initialize centroids randomly
    const centroids = [];
    for (let i = 0; i < k; i++) {
      const randomIdx = Math.floor(Math.random() * points.length);
      centroids.push([...points[randomIdx]]);
    }

    for (let iter = 0; iter < maxIter; iter++) {
      // Assign points to clusters
      const clusters = Array(k).fill(0).map(() => []);

      for (const point of points) {
        const nearest = this.findNearestCluster(point, centroids);
        clusters[nearest].push(point);
      }

      // Update centroids
      for (let i = 0; i < k; i++) {
        if (clusters[i].length === 0) continue;

        const sum = clusters[i].reduce((acc, p) => [
          acc[0] + p[0],
          acc[1] + p[1],
          acc[2] + p[2]
        ], [0, 0, 0]);

        centroids[i] = [
          sum[0] / clusters[i].length,
          sum[1] / clusters[i].length,
          sum[2] / clusters[i].length
        ];
      }
    }

    return centroids;
  }

  /**
   * Find nearest cluster for a color
   */
  findNearestCluster(color, centroids) {
    let minDist = Infinity;
    let nearest = 0;

    for (let i = 0; i < centroids.length; i++) {
      const dist = this.colorDistance(color, centroids[i]);
      if (dist < minDist) {
        minDist = dist;
        nearest = i;
      }
    }

    return nearest;
  }

  /**
   * Identify which cluster represents the background
   */
  identifyBackgroundCluster(data, width, height, clusters) {
    const cornerSamples = [
      [0, 0],
      [width - 1, 0],
      [0, height - 1],
      [width - 1, height - 1],
      [Math.floor(width * 0.1), 0],
      [Math.floor(width * 0.9), 0],
      [0, Math.floor(height * 0.1)],
      [0, Math.floor(height * 0.9)]
    ];

    const clusterVotes = new Array(clusters.length).fill(0);

    for (const [x, y] of cornerSamples) {
      const idx = (y * width + x) * 4;
      const color = [data[idx], data[idx + 1], data[idx + 2]];
      const cluster = this.findNearestCluster(color, clusters);
      clusterVotes[cluster]++;
    }

    // Cluster with most corner votes is likely background
    return clusterVotes.indexOf(Math.max(...clusterVotes));
  }

  /**
   * Build color model (mean color) for masked region
   */
  buildColorModel(data, mask, width, height, value) {
    let sumR = 0, sumG = 0, sumB = 0, count = 0;

    for (let i = 0; i < width * height; i++) {
      if (mask[i] === value) {
        const pixelIdx = i * 4;
        sumR += data[pixelIdx];
        sumG += data[pixelIdx + 1];
        sumB += data[pixelIdx + 2];
        count++;
      }
    }

    if (count === 0) return [0, 0, 0];
    return [sumR / count, sumG / count, sumB / count];
  }

  /**
   * Calculate color distance (Euclidean in RGB space)
   */
  colorDistance(color1, color2) {
    const dr = color1[0] - color2[0];
    const dg = color1[1] - color2[1];
    const db = color1[2] - color2[2];
    return Math.sqrt(dr * dr + dg * dg + db * db);
  }

  /**
   * Get initial mask (center rectangle as foreground)
   */
  getInitialMask(width, height) {
    const mask = new Uint8Array(width * height);
    const margin = 0.15; // 15% margin

    const x1 = Math.floor(width * margin);
    const x2 = Math.floor(width * (1 - margin));
    const y1 = Math.floor(height * margin);
    const y2 = Math.floor(height * (1 - margin));

    for (let y = y1; y < y2; y++) {
      for (let x = x1; x < x2; x++) {
        mask[y * width + x] = 1;
      }
    }

    return mask;
  }

  /**
   * Keep only the largest connected component in mask
   */
  keepLargestComponent(mask, width, height) {
    const visited = new Uint8Array(width * height);
    const result = new Uint8Array(width * height);
    let largestSize = 0;
    let largestComponent = [];

    const floodFill = (startIdx) => {
      const component = [];
      const stack = [startIdx];

      while (stack.length > 0) {
        const idx = stack.pop();

        if (visited[idx] || !mask[idx]) continue;

        visited[idx] = 1;
        component.push(idx);

        const x = idx % width;
        const y = Math.floor(idx / width);

        if (x > 0) stack.push(idx - 1);
        if (x < width - 1) stack.push(idx + 1);
        if (y > 0) stack.push(idx - width);
        if (y < height - 1) stack.push(idx + width);
      }

      return component;
    };

    for (let i = 0; i < mask.length; i++) {
      if (mask[i] && !visited[i]) {
        const component = floodFill(i);
        if (component.length > largestSize) {
          largestSize = component.length;
          largestComponent = component;
        }
      }
    }

    for (const idx of largestComponent) {
      result[idx] = 1;
    }

    return result;
  }

  /**
   * Morphological dilation
   */
  dilate(mask, width, height, iterations) {
    for (let iter = 0; iter < iterations; iter++) {
      const temp = new Uint8Array(mask);

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
   * Morphological erosion
   */
  erode(mask, width, height, iterations) {
    for (let iter = 0; iter < iterations; iter++) {
      const temp = new Uint8Array(mask);

      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const idx = y * width + x;
          if (temp[idx]) {
            // Check if all 4-neighbors are also foreground
            if (!temp[idx - 1] || !temp[idx + 1] ||
                !temp[idx - width] || !temp[idx + width]) {
              mask[idx] = 0;
            }
          }
        }
      }
    }
  }

  /**
   * Morphological closing (dilate then erode)
   */
  morphologicalClose(mask, width, height, iterations) {
    this.dilate(mask, width, height, iterations);
    this.erode(mask, width, height, iterations);
  }

  /**
   * Morphological opening (erode then dilate)
   */
  morphologicalOpen(mask, width, height, iterations) {
    this.erode(mask, width, height, iterations);
    this.dilate(mask, width, height, iterations);
  }

  /**
   * Gaussian blur for smoothing
   */
  gaussianBlur(data, width, height, kernelSize) {
    const result = new Float32Array(data.length);
    const kernel = this.createGaussianKernel(kernelSize);
    const halfKernel = Math.floor(kernelSize / 2);

    for (let y = halfKernel; y < height - halfKernel; y++) {
      for (let x = halfKernel; x < width - halfKernel; x++) {
        let sum = 0;
        let weightSum = 0;

        for (let ky = -halfKernel; ky <= halfKernel; ky++) {
          for (let kx = -halfKernel; kx <= halfKernel; kx++) {
            const weight = kernel[ky + halfKernel][kx + halfKernel];
            const idx = (y + ky) * width + (x + kx);
            sum += data[idx] * weight;
            weightSum += weight;
          }
        }

        result[y * width + x] = sum / weightSum;
      }
    }

    return result;
  }

  /**
   * Create Gaussian kernel
   */
  createGaussianKernel(size) {
    const kernel = [];
    const sigma = size / 3;
    const halfSize = Math.floor(size / 2);

    for (let y = -halfSize; y <= halfSize; y++) {
      const row = [];
      for (let x = -halfSize; x <= halfSize; x++) {
        const value = Math.exp(-(x * x + y * y) / (2 * sigma * sigma));
        row.push(value);
      }
      kernel.push(row);
    }

    return kernel;
  }

  /**
   * Validate mask quality
   */
  validateMask(mask, width, height) {
    const foregroundPixels = mask.reduce((sum, val) => sum + val, 0);
    const totalPixels = width * height;
    const ratio = foregroundPixels / totalPixels;

    // Mask should contain 15-85% foreground
    return ratio >= 0.15 && ratio <= 0.85;
  }

  /**
   * Apply mask to image data
   */
  applyMaskToImage(imageData, mask, width, height) {
    const result = document.createElement('canvas');
    result.width = width;
    result.height = height;
    const ctx = result.getContext('2d');

    const newImageData = new ImageData(width, height);
    const src = imageData.data;
    const dst = newImageData.data;

    for (let i = 0; i < mask.length; i++) {
      const srcIdx = i * 4;
      if (mask[i]) {
        dst[srcIdx] = src[srcIdx];
        dst[srcIdx + 1] = src[srcIdx + 1];
        dst[srcIdx + 2] = src[srcIdx + 2];
        dst[srcIdx + 3] = 255;
      } else {
        dst[srcIdx + 3] = 0; // Transparent
      }
    }

    ctx.putImageData(newImageData, 0, 0);
    return result;
  }

  /**
   * Fallback: center crop
   */
  fallbackCenterCrop(canvas, excludeTopPortion = true) {
    const cropPercent = 0.75;
    const cropWidth = Math.floor(canvas.width * cropPercent);
    const cropHeight = Math.floor(canvas.height * cropPercent);
    const startX = Math.floor((canvas.width - cropWidth) / 2);

    // If excluding top portion, start cropping below the face area
    let startY = Math.floor((canvas.height - cropHeight) / 2);
    if (excludeTopPortion) {
      const topExclusionHeight = Math.floor(canvas.height / 3.5);
      // Start cropping below the excluded top region
      startY = Math.max(topExclusionHeight, startY);

      // Adjust crop height if necessary to fit within bounds
      const adjustedCropHeight = Math.min(cropHeight, canvas.height - startY);

      const result = document.createElement('canvas');
      result.width = cropWidth;
      result.height = adjustedCropHeight;
      const ctx = result.getContext('2d');

      ctx.drawImage(
        canvas,
        startX, startY, cropWidth, adjustedCropHeight,
        0, 0, cropWidth, adjustedCropHeight
      );

      return result;
    }

    const result = document.createElement('canvas');
    result.width = cropWidth;
    result.height = cropHeight;
    const ctx = result.getContext('2d');

    ctx.drawImage(
      canvas,
      startX, startY, cropWidth, cropHeight,
      0, 0, cropWidth, cropHeight
    );

    return result;
  }
}

// Export for use in content script
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BackgroundRemover;
}
