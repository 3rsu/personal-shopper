/**
 * CONTENT SCRIPT
 *
 * Runs on all web pages. Handles:
 * - Detecting product images on e-commerce sites
 * - Extracting dominant colors using Color Thief
 * - Filtering/highlighting items based on color match
 * - Lazy loading for performance
 */

(function () {
  'use strict';

  // State
  let settings = {
    selectedSeason: null,
    filterEnabled: true,
    faceDetectionEnabled: true, // Enable face/skin/hair detection
    textColorEnhancementEnabled: true, // Enable text-based color enhancement
  };

  let colorProcessor = null;
  let processedImages = new WeakSet(); // Track actual image elements we've analyzed
  let processedSwatches = new WeakSet(); // Track analyzed swatch elements
  let stats = {
    totalImages: 0,
    matchingImages: 0,
    totalSwatches: 0,
    matchingSwatches: 0,
  };

  // Inactivity timer for auto-detection
  let inactivityTimer = null;
  let inactivityDelay = 2500; // 2.5 seconds
  let hasShownSummary = false;

  /**
   * Initialize the extension
   */
  async function initialize() {
    // Load color processor
    if (typeof ColorProcessor !== 'undefined') {
      colorProcessor = new ColorProcessor();
      console.log(
        '[Season Color Checker] ColorProcessor initialized with smart background filtering',
      );
    } else {
      console.error('[Season Color Checker] ERROR: ColorProcessor not loaded! Check manifest.json');
      return;
    }

    // Load settings from background
    chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
      if (response) {
        settings = response;
        console.log('[Season Color Checker] Settings loaded:', settings);

        // Only run if user has selected a season
        if (settings.selectedSeason && settings.filterEnabled) {
          // Check if the selected season exists in the palette
          if (SEASONAL_PALETTES[settings.selectedSeason]) {
            console.log(
              '[Season Color Checker] Starting filter with',
              settings.selectedSeason,
              'palette',
            );
            startFiltering();
          } else {
            console.error(
              '[Season Color Checker] ⚠️ OLD SEASON DETECTED! Your selected season "' +
                settings.selectedSeason +
                '" is no longer valid.',
            );
            console.error(
              '[Season Color Checker] 🔄 The extension now uses 12 sub-seasons instead of 4 basic seasons.',
            );
            console.error(
              '[Season Color Checker] 📋 Please click the extension icon and select a new season from:',
            );
            console.error(
              '[Season Color Checker]    🌺 Bright Spring, 🌸 Warm Spring, 🌼 Light Spring',
            );
            console.error(
              '[Season Color Checker]    🌿 Soft Summer, 🌊 Cool Summer, ☁️ Light Summer',
            );
            console.error(
              '[Season Color Checker]    🍁 Deep Autumn, 🍂 Warm Autumn, 🌾 Soft Autumn',
            );
            console.error(
              '[Season Color Checker]    💎 Bright Winter, ❄️ Cool Winter, 🌑 Deep Winter',
            );
          }
        } else if (!settings.selectedSeason) {
          console.warn(
            '[Season Color Checker] No season selected. Click extension icon to choose your palette.',
          );
        } else {
          console.log('[Season Color Checker] Filter is disabled');
        }
      } else {
        console.error('[Season Color Checker] Failed to load settings from background');
      }
    });

    // Listen for messages from background/popup
    chrome.runtime.onMessage.addListener(handleMessage);
  }

  /**
   * Handle messages from background script or popup
   */
  function handleMessage(request, sender, sendResponse) {
    if (request.action === 'seasonChanged') {
      settings.selectedSeason = request.season;
      resetAndRefilter();
      sendResponse({ success: true });
    }

    if (request.action === 'filterToggled') {
      settings.filterEnabled = request.enabled;
      if (request.enabled) {
        resetAndRefilter();
      } else {
        removeAllFilters();
      }
      sendResponse({ success: true });
    }

    if (request.action === 'toggleHighlights') {
      toggleHighlights(request.enabled);
      sendResponse({ success: true });
    }

    return true;
  }

  /**
   * Toggle highlights visibility (without disabling filter)
   */
  function toggleHighlights(enabled) {
    const body = document.body;

    if (enabled) {
      body.classList.remove('season-highlights-hidden');
    } else {
      body.classList.add('season-highlights-hidden');
    }
  }

  // Listen for custom events from overlay
  document.addEventListener('seasonFilterToggleHighlights', (e) => {
    toggleHighlights(e.detail.enabled);
  });

  /**
   * Start the filtering process
   */
  function startFiltering() {
    console.log('[Season Color Checker] Starting filtering process...');

    // Find and process product images
    findAndProcessImages();

    // Set up observer for dynamically loaded content (infinite scroll, etc.)
    observeNewImages();

    // Initialize overlay widget
    if (typeof window.initializeOverlay === 'function') {
      window.initializeOverlay(stats, settings);
      console.log('[Season Color Checker] Overlay widget initialized');
    } else {
      console.warn('[Season Color Checker] Overlay not available');
    }

    // Set up inactivity detection for color swatches
    setupInactivityDetection();

    // Watch for swatch selection changes (dynamic sites with AJAX)
    if (typeof watchSwatchChanges === 'function') {
      watchSwatchChanges();
      console.log('[Season Color Checker] Swatch change watcher initialized');
    }
  }

  /**
   * Find product images on the page
   */
  function findAndProcessImages() {
    const images = findProductImages();

    images.forEach((img) => {
      if (!processedImages.has(img)) {
        processImage(img);
      }
    });

    updateOverlay();
  }

  /**
   * Detect product images (vs UI elements, logos, etc.)
   */
  function findProductImages() {
    const allImages = document.querySelectorAll('img');
    const productImages = [];

    // Apply smart filtering to all images on the page
    allImages.forEach((img) => {
      // Skip common UI elements (logos, icons, social media buttons)
      const src = img.src.toLowerCase();
      const alt = (img.alt || '').toLowerCase();
      const className = (img.className || '').toLowerCase();

      // Skip logos and icons by src, alt, or class
      if (
        src.includes('logo') ||
        src.includes('icon') ||
        src.includes('sprite') ||
        alt.includes('logo') ||
        alt.includes('icon') ||
        className.includes('logo') ||
        className.includes('icon')
      ) {
        return;
      }

      // Skip social media and UI elements
      if (
        src.includes('facebook') ||
        src.includes('twitter') ||
        src.includes('instagram') ||
        src.includes('pinterest') ||
        src.includes('social') ||
        className.includes('social')
      ) {
        return;
      }

      // For loaded images, check size immediately
      if (img.complete) {
        // Skip if too small (likely icon, thumbnail, or UI element)
        if (img.naturalWidth < 100 || img.naturalHeight < 100) {
          return;
        }
      }
      // For unloaded images, include them - size will be checked in processImage()

      // Skip if completely hidden
      if (img.offsetParent === null && img.style.display === 'none') {
        return;
      }

      // Skip if the image has no src (placeholder or broken)
      if (!img.src || img.src === '' || img.src === window.location.href) {
        return;
      }

      productImages.push(img);
    });

    return productImages;
  }

  /**
   * Sample colors from border points around the image perimeter
   * @param {HTMLImageElement|HTMLCanvasElement} img - Image to sample
   * @returns {Array<Array<number>>} - Array of RGB color arrays
   */
  function sampleBorder(img) {
    try {
      const canvas = document.createElement('canvas');
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      const samples = [];
      const samplePoints = [
        // Corners
        [0, 0],
        [width - 1, 0],
        [0, height - 1],
        [width - 1, height - 1],
        // Midpoints of edges
        [Math.floor(width / 2), 0],
        [Math.floor(width / 2), height - 1],
        [0, Math.floor(height / 2)],
        [width - 1, Math.floor(height / 2)],
        // Quarter points
        [Math.floor(width / 4), 0],
        [Math.floor((3 * width) / 4), 0],
        [Math.floor(width / 4), height - 1],
        [Math.floor((3 * width) / 4), height - 1],
      ];

      for (const [x, y] of samplePoints) {
        const pixel = ctx.getImageData(x, y, 1, 1).data;
        samples.push([pixel[0], pixel[1], pixel[2]]);
      }

      return samples;
    } catch (e) {
      console.error('[Season Color Checker] Error sampling border:', e);
      return [];
    }
  }

  /**
   * Find the dominant background color from border samples using clustering
   * @param {Array<Array<number>>} borderColors - Array of RGB color arrays
   * @returns {Array<number>|null} - RGB array of background color, or null
   */
  function findDominantBackgroundColor(borderColors) {
    if (!borderColors || borderColors.length === 0) return null;

    // Group similar colors (deltaE < 10 threshold)
    const clusters = [];

    for (const color of borderColors) {
      let foundCluster = false;

      for (const cluster of clusters) {
        const clusterAvg = cluster.colors[0]; // Use first color as representative
        const deltaE = colorProcessor.calculateDeltaE(color, clusterAvg);

        if (deltaE < 10) {
          cluster.colors.push(color);
          foundCluster = true;
          break;
        }
      }

      if (!foundCluster) {
        clusters.push({ colors: [color] });
      }
    }

    // Find largest cluster (most common background color)
    let largestCluster = clusters[0];
    for (const cluster of clusters) {
      if (cluster.colors.length > largestCluster.colors.length) {
        largestCluster = cluster;
      }
    }

    // Return average of cluster colors
    if (largestCluster && largestCluster.colors.length > 0) {
      const avgR = Math.round(
        largestCluster.colors.reduce((sum, c) => sum + c[0], 0) / largestCluster.colors.length,
      );
      const avgG = Math.round(
        largestCluster.colors.reduce((sum, c) => sum + c[1], 0) / largestCluster.colors.length,
      );
      const avgB = Math.round(
        largestCluster.colors.reduce((sum, c) => sum + c[2], 0) / largestCluster.colors.length,
      );
      return [avgR, avgG, avgB];
    }

    return null;
  }

  /**
   * Extract center region of image, removing border percentages
   * @param {HTMLImageElement|HTMLCanvasElement} img - Image to crop
   * @returns {HTMLCanvasElement|null} - Cropped canvas focused on center product
   */
  function extractCenterRegion(img) {
    try {
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;

      // Calculate crop percentages
      const cropLeft = Math.floor(width * 0.2); // Remove 20% from left
      const cropRight = Math.floor(width * 0.2); // Remove 20% from right
      const cropTop = Math.floor(height * 0.15); // Remove 15% from top
      const cropBottom = Math.floor(height * 0.1); // Remove 10% from bottom

      const croppedWidth = width - cropLeft - cropRight;
      const croppedHeight = height - cropTop - cropBottom;

      if (croppedWidth <= 0 || croppedHeight <= 0) {
        return null;
      }

      // Create canvas with cropped dimensions
      const canvas = document.createElement('canvas');
      canvas.width = croppedWidth;
      canvas.height = croppedHeight;
      const ctx = canvas.getContext('2d');

      // Draw center region
      ctx.drawImage(
        img,
        cropLeft,
        cropTop,
        croppedWidth,
        croppedHeight, // Source: center region
        0,
        0,
        croppedWidth,
        croppedHeight, // Dest: fill canvas
      );

      return canvas;
    } catch (e) {
      console.error('[Season Color Checker] Error extracting center region:', e);
      return null;
    }
  }

  /**
   * Calculate HSL saturation from RGB
   * @param {Array<number>} rgb - RGB color array [r, g, b]
   * @returns {number} - Saturation value (0-1)
   */
  function getSaturation(rgb) {
    const r = rgb[0] / 255;
    const g = rgb[1] / 255;
    const b = rgb[2] / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    if (delta === 0) return 0;

    const lightness = (max + min) / 2;

    if (lightness === 0 || lightness === 1) return 0;

    return delta / (1 - Math.abs(2 * lightness - 1));
  }

  /**
   * Filter out background and desaturated colors from palette
   * @param {Array<Array<number>>} palette - Array of RGB color arrays
   * @param {Array<number>|null} backgroundColor - RGB array of detected background
   * @returns {Array<Array<number>>} - Filtered palette
   */
  function filterBackgroundColors(palette, backgroundColor) {
    if (!palette || palette.length === 0) return palette;

    return palette.filter((color) => {
      // Filter out colors similar to background (deltaE < 15)
      if (backgroundColor) {
        const deltaE = colorProcessor.calculateDeltaE(color, backgroundColor);
        if (deltaE < 15) {
          return false;
        }
      }

      // Filter out very desaturated colors (likely backgrounds/neutrals)
      const saturation = getSaturation(color);
      if (saturation < 0.15) {
        return false;
      }

      return true;
    });
  }

  /**
   * Extract upper region of image where faces typically appear
   * @param {HTMLImageElement|HTMLCanvasElement} img - Image to extract from
   * @param {number} topPercent - Percentage of image to extract from top (0-1)
   * @returns {HTMLCanvasElement|null} - Canvas with upper region
   */
  function extractUpperRegion(img, topPercent = 0.4) {
    try {
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;

      const extractHeight = Math.floor(height * topPercent);

      if (extractHeight <= 0 || width <= 0) {
        return null;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = extractHeight;
      const ctx = canvas.getContext('2d');

      // Draw top portion of image
      ctx.drawImage(
        img,
        0,
        0,
        width,
        extractHeight, // Source: top region
        0,
        0,
        width,
        extractHeight, // Dest: fill canvas
      );

      return canvas;
    } catch (e) {
      console.error('[Season Color Checker] Error extracting upper region:', e);
      return null;
    }
  }

  /**
   * Convert RGB to YCbCr color space (better for skin detection)
   * @param {Array<number>} rgb - RGB array [r, g, b]
   * @returns {Array<number>} - YCbCr array [y, cb, cr]
   */
  function rgbToYCbCr(rgb) {
    const r = rgb[0];
    const g = rgb[1];
    const b = rgb[2];

    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
    const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

    return [y, cb, cr];
  }

  /**
   * Check if RGB color is valid skin tone (works across all ethnicities)
   * Uses YCbCr color space thresholds
   * @param {Array<number>} rgb - RGB array [r, g, b]
   * @returns {boolean} - True if color is within skin tone range
   */
  function isValidSkinColor(rgb) {
    const [y, cb, cr] = rgbToYCbCr(rgb);

    // YCbCr thresholds for skin detection (empirically validated)
    // Works for all skin tones from very light to very dark
    return cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173;
  }

  /**
   * Check if RGB color is valid hair color
   * Hair is typically dark and somewhat saturated
   * @param {Array<number>} rgb - RGB array [r, g, b]
   * @returns {boolean} - True if color matches hair characteristics
   */
  function isValidHairColor(rgb) {
    // Convert to HSL to check lightness and saturation
    const r = rgb[0] / 255;
    const g = rgb[1] / 255;
    const b = rgb[2] / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    const lightness = (max + min) / 2;

    // Calculate saturation
    let saturation = 0;
    if (delta !== 0) {
      saturation =
        lightness === 0 || lightness === 1 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
    }

    // Hair is typically darker (lightness < 0.6) and has some saturation (> 0.2)
    // Allow lighter colors for blonde/gray hair, but require some color presence
    return lightness < 0.7 && saturation > 0.15;
  }

  /**
   * Detect skin tone from canvas using YCbCr color space
   * @param {HTMLCanvasElement} canvas - Canvas to analyze
   * @returns {Array<number>|null} - Dominant skin color as RGB, or null if no skin detected
   */
  function detectSkinTone(canvas) {
    try {
      const ctx = canvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = imageData.data;

      const skinPixels = [];

      // Sample every 4th pixel for performance (adjustable)
      const step = 4;
      for (let i = 0; i < pixels.length; i += 4 * step) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const rgb = [r, g, b];

        if (isValidSkinColor(rgb)) {
          skinPixels.push(rgb);
        }
      }

      if (skinPixels.length < 10) {
        return null; // Not enough skin pixels found
      }

      // Calculate average of all skin pixels
      const avgR = Math.round(skinPixels.reduce((sum, p) => sum + p[0], 0) / skinPixels.length);
      const avgG = Math.round(skinPixels.reduce((sum, p) => sum + p[1], 0) / skinPixels.length);
      const avgB = Math.round(skinPixels.reduce((sum, p) => sum + p[2], 0) / skinPixels.length);

      console.log('[Season Color Checker] Detected skin tone from', skinPixels.length, 'pixels');
      return [avgR, avgG, avgB];
    } catch (e) {
      console.error('[Season Color Checker] Error detecting skin tone:', e);
      return null;
    }
  }

  /**
   * Detect hair color from canvas (focuses on top portion)
   * @param {HTMLCanvasElement} canvas - Canvas to analyze
   * @returns {Array<number>|null} - Dominant hair color as RGB, or null if no hair detected
   */
  function detectHairColor(canvas) {
    try {
      // Extract top 15% of the canvas (where hair typically is)
      const hairCanvas = document.createElement('canvas');
      const hairHeight = Math.floor(canvas.height * 0.15);
      hairCanvas.width = canvas.width;
      hairCanvas.height = hairHeight;
      const hairCtx = hairCanvas.getContext('2d');

      hairCtx.drawImage(canvas, 0, 0, canvas.width, hairHeight, 0, 0, canvas.width, hairHeight);

      const ctx = hairCtx;
      const imageData = ctx.getImageData(0, 0, hairCanvas.width, hairCanvas.height);
      const pixels = imageData.data;

      const hairPixels = [];

      // Sample every 4th pixel for performance
      const step = 4;
      for (let i = 0; i < pixels.length; i += 4 * step) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const rgb = [r, g, b];

        if (isValidHairColor(rgb)) {
          hairPixels.push(rgb);
        }
      }

      if (hairPixels.length < 10) {
        return null; // Not enough hair pixels found
      }

      // Calculate average of all hair pixels
      const avgR = Math.round(hairPixels.reduce((sum, p) => sum + p[0], 0) / hairPixels.length);
      const avgG = Math.round(hairPixels.reduce((sum, p) => sum + p[1], 0) / hairPixels.length);
      const avgB = Math.round(hairPixels.reduce((sum, p) => sum + p[2], 0) / hairPixels.length);

      console.log('[Season Color Checker] Detected hair color from', hairPixels.length, 'pixels');
      return [avgR, avgG, avgB];
    } catch (e) {
      console.error('[Season Color Checker] Error detecting hair color:', e);
      return null;
    }
  }

  /**
   * Check if we can access image data without CORS errors
   * Returns true if the image is accessible, false if CORS-blocked
   */
  function canAccessImageData(img) {
    try {
      // Create a temporary 1x1 canvas (not added to DOM)
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext('2d');

      // Try to draw the image and read pixel data
      ctx.drawImage(img, 0, 0, 1, 1);
      ctx.getImageData(0, 0, 1, 1); // This will throw if CORS-blocked

      return true; // Success - image is accessible
    } catch (e) {
      // CORS blocked or other error
      return false;
    }
  }

  /**
   * 3-Tier Fallback System to handle CORS-blocked images
   * Tier 1: Try crossorigin="anonymous" + reload
   * Tier 2: Fetch via service worker as data URL
   * Tier 3: Show dismissable badge for user action
   *
   * @param {HTMLImageElement} img - The image element to process
   * @param {string} domain - The domain of the image
   * @returns {Promise<HTMLImageElement|null>} - Returns processable image or null if all methods fail
   */
  async function handleCorsImage(img, domain) {
    const originalSrc = img.src;

    // Check if domain has a preferred method cached
    let preferredMethod = null;
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getPreferredMethod',
        domain: domain,
      });
      preferredMethod = response?.preferredMethod;
    } catch (e) {
      // Continue without cache
    }

    // Tier 1: Try crossorigin="anonymous" (unless we know it won't work)
    if (preferredMethod !== 'fetch') {
      try {
        console.log(
          '[Season Color Checker] Tier 1: Trying crossorigin="anonymous" for:',
          originalSrc.substring(0, 80),
        );

        // Clone the image to avoid affecting the original
        const testImg = new Image();
        testImg.crossOrigin = 'anonymous';

        await new Promise((resolve, reject) => {
          testImg.onload = resolve;
          testImg.onerror = reject;
          const timeout = setTimeout(() => reject(new Error('Load timeout')), 2000);
          testImg.src = originalSrc;
          testImg.onload = () => {
            clearTimeout(timeout);
            resolve();
          };
        });

        // Check if we can now access the data
        if (canAccessImageData(testImg)) {
          console.log('[Season Color Checker] ✓ Tier 1 success: crossorigin worked');
          trackCorsEvent(domain, 'success', 'crossorigin');
          return testImg;
        }
      } catch (e) {
        console.log('[Season Color Checker] ✗ Tier 1 failed:', e.message);
      }
    }

    // Tier 2: Fetch via service worker (unless we know direct works)
    if (preferredMethod !== 'direct') {
      try {
        console.log(
          '[Season Color Checker] Tier 2: Fetching via service worker:',
          originalSrc.substring(0, 80),
        );

        const response = await chrome.runtime.sendMessage({
          action: 'fetchImage',
          url: originalSrc,
        });

        if (response.success && response.dataUrl) {
          // Create new image from data URL
          const fetchedImg = new Image();
          await new Promise((resolve, reject) => {
            fetchedImg.onload = resolve;
            fetchedImg.onerror = reject;
            const timeout = setTimeout(() => reject(new Error('Load timeout')), 2000);
            fetchedImg.src = response.dataUrl;
            fetchedImg.onload = () => {
              clearTimeout(timeout);
              resolve();
            };
          });

          console.log('[Season Color Checker] ✓ Tier 2 success: service worker fetch worked');
          trackCorsEvent(domain, 'success', 'fetch');
          return fetchedImg;
        } else {
          console.log('[Season Color Checker] ✗ Tier 2 failed:', response.error);
        }
      } catch (e) {
        console.log('[Season Color Checker] ✗ Tier 2 failed:', e.message);
      }
    }

    // Tier 3: All automatic methods failed - show badge
    console.log(
      '[Season Color Checker] ✗ All automatic methods failed for:',
      originalSrc.substring(0, 80),
    );
    trackCorsEvent(domain, 'failure', 'all-failed');

    // Show dismissable badge (will be implemented next)
    showCorsBadge(img);

    return null;
  }

  /**
   * Process a single image
   */
  async function processImage(img) {
    // Mark as processed (track the element itself, not the src)
    processedImages.add(img);
    stats.totalImages++;

    const startTime = performance.now(); // Track processing time

    try {
      // Wait for image to load
      if (!img.complete) {
        await new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      }

      // After loading, check if image is too small (icon or thumbnail)
      if (img.naturalWidth < 100 || img.naturalHeight < 100) {
        stats.totalImages--; // Don't count this image
        return;
      }

      // ========================================
      // STEP 1: SWATCH-FIRST PROCESSING (NEW)
      // Try to detect website swatch BEFORE ColorThief
      // ========================================
      if (typeof findSelectedSwatchForImage === 'function') {
        try {
          const selectedSwatch = findSelectedSwatchForImage(img);

          if (selectedSwatch) {
            const swatchColor = extractSwatchColor(selectedSwatch);

            if (swatchColor && swatchColor.confidence >= 0.7) {
              // High-confidence swatch detected! Skip ColorThief processing
              const processingTime = (performance.now() - startTime).toFixed(1);
              console.log(
                `[Season Color Checker] 🎨 Using website swatch (${swatchColor.source}, confidence: ${swatchColor.confidence.toFixed(2)}, ${processingTime}ms)`,
              );
              console.log('[Season Color Checker] Swatch color:', swatchColor.hex);

              // Get season palette
              const seasonPalette = SEASONAL_PALETTES[settings.selectedSeason];
              if (!seasonPalette) {
                console.warn(
                  '[Season Color Checker] Invalid season selected:',
                  settings.selectedSeason,
                );
                return;
              }

              // Use findClosestMatch for simple binary matching
              const matchResult = colorProcessor.findClosestMatch(
                swatchColor.hex,
                seasonPalette.colors,
              );

              // Store swatch data on element
              img.dataset.seasonMatch = matchResult.isMatch ? 'true' : 'false';
              img.dataset.matchScore = matchResult.isMatch ? '100' : '0';
              img.dataset.selectedSwatchColor = swatchColor.hex;
              img.dataset.selectedSwatchSource = swatchColor.source;
              img.dataset.dominantColors = JSON.stringify([swatchColor.hex]);
              img.dataset.swatchOnly = 'true'; // Flag for display logic

              // Apply simplified filter (match or no-match only)
              applySwatchOnlyFilter(img, matchResult, swatchColor);

              // Update stats
              if (matchResult.isMatch) {
                stats.matchingImages++;
              }

              // Log performance savings
              console.log(
                `[Season Color Checker] ⚡ Skipped ColorThief processing (saved ~100-150ms)`,
              );

              return; // EARLY EXIT - Skip ColorThief entirely
            } else if (swatchColor) {
              console.log(
                `[Season Color Checker] Found swatch but confidence too low (${swatchColor.confidence.toFixed(2)} < 0.7), falling back to ColorThief`,
              );
            }
          }
        } catch (swatchError) {
          console.log('[Season Color Checker] Swatch detection failed:', swatchError.message);
          // Fall through to ColorThief processing
        }
      }

      // ========================================
      // STEP 2: COLORTHIEF FALLBACK PROCESSING
      // Only runs if no high-confidence swatch detected
      // ========================================
      console.log(
        '[Season Color Checker] 🤖 Using ColorThief analysis (no high-confidence swatch detected)',
      );

      // Extract dominant colors using Color Thief
      if (typeof ColorThief === 'undefined') {
        console.error('ColorThief not loaded');
        return;
      }

      // Pre-check: Can we access this image's pixel data?
      let processableImage = img;
      if (!canAccessImageData(img)) {
        console.log(
          '[Season Color Checker] CORS detected, trying fallback methods:',
          img.src.substring(0, 80),
        );

        // Get domain for tracking
        const domain = getDomainFromUrl(img.src);

        // Try 3-tier fallback system
        processableImage = await handleCorsImage(img, domain);

        // If all methods failed, return
        if (!processableImage) {
          stats.totalImages--; // Don't count this image
          return;
        }
      } else {
        // Direct access works - track success
        const domain = getDomainFromUrl(img.src);
        if (domain) {
          trackCorsEvent(domain, 'success', 'direct');
        }
      }

      const colorThief = new ColorThief();
      let dominantColors;
      let backgroundColor = null;

      try {
        // Step 1: Sample border colors to detect background
        const borderColors = sampleBorder(processableImage);
        if (borderColors.length > 0) {
          backgroundColor = findDominantBackgroundColor(borderColors);
          if (backgroundColor) {
            console.log(
              '[Season Color Checker] Detected background color:',
              colorProcessor.rgbToHex(backgroundColor),
            );
          }
        }

        // Step 2: Extract center region (remove 20% L/R, 15% top, 10% bottom)
        let imageToAnalyze = processableImage;
        const centerCanvas = extractCenterRegion(processableImage);
        if (centerCanvas) {
          console.log('[Season Color Checker] Extracted center region for analysis');
          imageToAnalyze = centerCanvas;
        } else {
          console.log('[Season Color Checker] Center extraction failed, using full image');
        }

        // Step 3: Extract dominant colors from center region
        const rawColors = colorThief.getPalette(imageToAnalyze, 8); // Get more colors initially

        // Step 4: Filter out background and desaturated colors
        dominantColors = filterBackgroundColors(rawColors, backgroundColor);

        console.log(
          '[Season Color Checker] Filtered palette:',
          dominantColors.length,
          'colors after background removal',
        );

        // NEW Step 5: Extract text color mentions and apply weighting
        if (
          settings.textColorEnhancementEnabled &&
          typeof extractColorKeywordsFromDOM === 'function'
        ) {
          try {
            const textColorMentions = extractColorKeywordsFromDOM(img);

            if (textColorMentions && textColorMentions.length > 0) {
              console.log(
                '[Season Color Checker] Found text color mentions:',
                textColorMentions.map((m) => m.keyword).join(', '),
              );

              // Apply text-based weighting to palette
              if (typeof applyTextColorWeighting === 'function') {
                const weightedPalette = applyTextColorWeighting(
                  dominantColors,
                  textColorMentions,
                  colorProcessor,
                );

                // Use selectFinalPalette to ensure text-matched colors are preserved
                if (typeof selectFinalPalette === 'function') {
                  // Select final palette with guaranteed slots for text-matched colors
                  dominantColors = selectFinalPalette(weightedPalette, 5, 2);
                } else {
                  // Fallback: simple slice (old behavior)
                  dominantColors = weightedPalette.map((item) => item.rgb).slice(0, 5);
                }

                // Optionally augment palette with high-confidence text colors not in visual palette
                if (typeof augmentPaletteWithTextColors === 'function') {
                  dominantColors = augmentPaletteWithTextColors(
                    dominantColors,
                    textColorMentions,
                    colorProcessor,
                    2,
                  );
                }
              }
            } else {
              // No text colors found, just take top 5
              dominantColors = dominantColors.slice(0, 5);
            }
          } catch (textError) {
            console.log('[Season Color Checker] Text color extraction failed:', textError.message);
            // Continue without text enhancement - not critical
            dominantColors = dominantColors.slice(0, 5);
          }
        } else {
          // Text enhancement disabled, just take top 5
          dominantColors = dominantColors.slice(0, 5);
        }

        // NEW Step 6: Detect and use selected swatch color for matching (universal e-commerce)
        if (typeof findSelectedSwatchForImage === 'function') {
          try {
            const selectedSwatch = findSelectedSwatchForImage(img);

            if (selectedSwatch) {
              const swatchColor = extractSwatchColor(selectedSwatch);

              // Use swatch for matching if confidence >= 0.3 (30%)
              if (swatchColor && swatchColor.confidence >= 0.3) {
                const processingTime = (performance.now() - startTime).toFixed(1);
                console.log(
                  `[Season Color Checker] 🎨 Using website swatch for matching (${swatchColor.source}, confidence: ${swatchColor.confidence.toFixed(2)}, ${processingTime}ms)`,
                );
                console.log('[Season Color Checker] Swatch color:', swatchColor.hex);

                // Get season palette
                const seasonPalette = SEASONAL_PALETTES[settings.selectedSeason];
                if (!seasonPalette) {
                  console.warn(
                    '[Season Color Checker] Invalid season selected:',
                    settings.selectedSeason,
                  );
                  return;
                }

                // Use findClosestMatch for simple binary matching (SWATCH ONLY)
                const matchResult = colorProcessor.findClosestMatch(
                  swatchColor.hex,
                  seasonPalette.colors,
                );

                // Store swatch data on element
                img.dataset.seasonMatch = matchResult.isMatch ? 'true' : 'false';
                img.dataset.matchScore = matchResult.isMatch ? '100' : '0';
                img.dataset.selectedSwatchColor = swatchColor.hex;
                img.dataset.selectedSwatchSource = swatchColor.source;

                // Build display palette: swatch + top 2 ColorThief colors (for visual reference only)
                const colorThiefHexes = dominantColors
                  .slice(0, 3)
                  .map((rgb) => colorProcessor.rgbToHex(rgb));

                // Filter out colors too similar to swatch
                const uniqueColors = colorThiefHexes.filter((hex) => {
                  const deltaE = colorProcessor.calculateDeltaE(
                    colorProcessor.hexToRgb(hex),
                    colorProcessor.hexToRgb(swatchColor.hex),
                  );
                  return deltaE >= 15;
                });

                const displayColors = [swatchColor.hex, ...uniqueColors.slice(0, 2)];
                img.dataset.dominantColors = JSON.stringify(displayColors);
                img.dataset.swatchOnly = 'true'; // Flag for display logic

                // Apply simplified filter (match or no-match only)
                applySwatchOnlyFilter(img, matchResult, swatchColor);

                // Update stats
                if (matchResult.isMatch) {
                  stats.matchingImages++;
                }

                console.log(
                  `[Season Color Checker] ✓ Swatch-only matching complete (${matchResult.isMatch ? 'MATCH' : 'NO MATCH'})`,
                );

                return; // EARLY EXIT - Skip complex season detection
              } else if (swatchColor) {
                console.log(
                  `[Season Color Checker] Found swatch but confidence too low (${swatchColor.confidence.toFixed(2)} < 0.3), using ColorThief only`,
                );
                // Store swatch for display purposes but don't use for matching
                img.dataset.selectedSwatchColor = swatchColor.hex;
                img.dataset.selectedSwatchSource = swatchColor.source;

                // Apply swatch priority weighting to boost matching colors in ColorThief palette
                dominantColors = applySwatchPriorityWeighting(
                  dominantColors,
                  swatchColor,
                  colorProcessor,
                );
              }
            }
          } catch (swatchError) {
            console.log('[Season Color Checker] Swatch detection failed:', swatchError.message);
            // Continue with ColorThief-only processing
          }
        }
      } catch (e) {
        console.log('[Season Color Checker] Error extracting colors:', e.message);
        stats.totalImages--; // Don't count this image
        return;
      }

      if (!dominantColors || dominantColors.length === 0) {
        console.log('[Season Color Checker] No colors extracted after filtering');
        return;
      }

      // NEW: Detect skin tone and hair color (if enabled)
      let skinTone = null;
      let hairColor = null;

      if (settings.faceDetectionEnabled) {
        try {
          // Extract upper 40% of image where faces typically appear
          const upperRegion = extractUpperRegion(processableImage, 0.4);
          if (upperRegion) {
            // Detect skin tone from upper region
            skinTone = detectSkinTone(upperRegion);
            if (skinTone) {
              console.log(
                '[Season Color Checker] Detected skin tone:',
                colorProcessor.rgbToHex(skinTone),
              );
            }

            // Detect hair color from upper region
            hairColor = detectHairColor(upperRegion);
            if (hairColor) {
              console.log(
                '[Season Color Checker] Detected hair color:',
                colorProcessor.rgbToHex(hairColor),
              );
            }
          }
        } catch (e) {
          console.log('[Season Color Checker] Face detection failed:', e.message);
          // Continue without face data - not critical
        }
      }

      // Detect which season(s) the product belongs to
      const productSeasonResult = colorProcessor.detectProductSeason(
        dominantColors,
        SEASONAL_PALETTES,
      );

      // Get current season's palette for user comparison
      const seasonPalette = SEASONAL_PALETTES[settings.selectedSeason];
      if (!seasonPalette) {
        console.warn(
          '[Season Color Checker] Invalid season selected:',
          settings.selectedSeason,
          '- Please reselect your season from the popup',
        );
        return;
      }

      // Analyze compatibility with user's season
      const compatibility = colorProcessor.analyzeSeasonCompatibility(
        productSeasonResult,
        settings.selectedSeason,
      );

      // Legacy match result for backward compatibility
      const matchResult = colorProcessor.checkColorMatch(dominantColors, seasonPalette.colors);

      // Store enhanced match data on element BEFORE applying filter (so swatch function can access it)
      img.dataset.seasonMatch = compatibility.compatible ? 'true' : 'false';
      img.dataset.matchScore = matchResult.confidence.toFixed(0);
      img.dataset.productSeason = productSeasonResult.primarySeason?.seasonKey || 'unknown';
      img.dataset.productSeasonName = productSeasonResult.primarySeason?.seasonName || 'Unknown';
      img.dataset.compatibilityType = compatibility.matchType || 'none';

      // Build display palette: selected swatch first (if exists), then top ColorThief colors
      let displayColors;
      if (img.dataset.selectedSwatchColor) {
        const swatchHex = img.dataset.selectedSwatchColor;
        const colorThiefHexes = dominantColors
          .slice(0, 3)
          .map((rgb) => colorProcessor.rgbToHex(rgb));

        // Filter out colors too similar to the selected swatch (deltaE < 15 = essentially same color)
        const uniqueColors = colorThiefHexes.filter((hex) => {
          const deltaE = colorProcessor.calculateDeltaE(
            colorProcessor.hexToRgb(hex),
            colorProcessor.hexToRgb(swatchHex),
          );
          return deltaE >= 15; // Keep only colors that are visually distinct
        });

        // Display: [selected swatch] + [top 2 unique ColorThief colors]
        displayColors = [swatchHex, ...uniqueColors.slice(0, 2)];
        console.log(
          '[Season Color Checker] Display palette:',
          displayColors,
          '(website swatch + ColorThief)',
        );
      } else {
        // No selected swatch detected, use ColorThief colors only
        displayColors = dominantColors.slice(0, 3).map((rgb) => colorProcessor.rgbToHex(rgb));
      }

      img.dataset.dominantColors = JSON.stringify(displayColors);
      img.dataset.seasonData = JSON.stringify({
        primary: productSeasonResult.primarySeason,
        secondary: productSeasonResult.secondarySeasons,
        compatibility: compatibility,
      });

      // Store skin tone and hair color if detected
      if (skinTone) {
        img.dataset.skinTone = colorProcessor.rgbToHex(skinTone);
      }
      if (hairColor) {
        img.dataset.hairColor = colorProcessor.rgbToHex(hairColor);
      }

      // Apply visual filter based on compatibility
      applyFilter(img, matchResult, productSeasonResult, compatibility);

      // Update stats
      if (compatibility.compatible) {
        stats.matchingImages++;
      }
    } catch (error) {
      console.error('Error processing image:', error);
    }
  }

  /**
   * Apply simplified visual filter for swatch-only mode
   * Used when skipping ColorThief and relying solely on website swatch
   */
  function applySwatchOnlyFilter(img, matchResult, swatchColor) {
    // Remove existing filter classes
    img.classList.remove('season-match', 'season-no-match');

    // Make the image itself position: relative so badge can be positioned
    img.style.position = 'relative';

    // Add container wrapper if needed
    let container = img.closest('.season-filter-container');
    if (!container) {
      // Check if the parent can be used as container
      const parent = img.parentElement;

      // Try to use parent if it's already position: relative/absolute
      const parentStyle = window.getComputedStyle(parent);
      if (parentStyle.position === 'relative' || parentStyle.position === 'absolute') {
        container = parent;
        container.classList.add('season-filter-container');
      } else {
        // Only wrap if absolutely necessary
        container = document.createElement('div');
        container.className = 'season-filter-container';

        // Copy important layout properties from img to container
        const imgStyle = window.getComputedStyle(img);
        if (imgStyle.width && imgStyle.width !== 'auto') {
          container.style.width = imgStyle.width;
        }
        if (imgStyle.height && imgStyle.height !== 'auto') {
          container.style.height = imgStyle.height;
        }

        img.parentNode.insertBefore(container, img);
        container.appendChild(img);
      }
    }

    if (matchResult.isMatch) {
      // Green border for matches
      img.classList.add('season-match');
      container.classList.remove('season-dimmed');
    } else {
      // Dim non-matches
      img.classList.add('season-no-match');
      container.classList.add('season-dimmed');
    }

    // Add single color swatch display
    addColorPaletteSwatch(container, img);

    // Add simplified match badge (checkmark or X only)
    addSwatchOnlyBadge(container, matchResult, swatchColor);

    // Add simple tooltip
    addSwatchOnlyTooltip(img, matchResult, swatchColor);
  }

  /**
   * Apply visual filter to image
   */
  function applyFilter(img, matchResult, productSeasonResult, compatibility) {
    // Remove existing filter classes
    img.classList.remove('season-match', 'season-no-match');

    // Make the image itself position: relative so badge can be positioned
    img.style.position = 'relative';

    // Add container wrapper if needed
    let container = img.closest('.season-filter-container');
    if (!container) {
      // Check if the parent can be used as container
      const parent = img.parentElement;

      // Try to use parent if it's already position: relative/absolute
      const parentStyle = window.getComputedStyle(parent);
      if (parentStyle.position === 'relative' || parentStyle.position === 'absolute') {
        container = parent;
        container.classList.add('season-filter-container');
      } else {
        // Only wrap if absolutely necessary
        container = document.createElement('div');
        container.className = 'season-filter-container';

        // Copy important layout properties from img to container
        const imgStyle = window.getComputedStyle(img);
        if (imgStyle.width && imgStyle.width !== 'auto') {
          container.style.width = imgStyle.width;
        }
        if (imgStyle.height && imgStyle.height !== 'auto') {
          container.style.height = imgStyle.height;
        }

        img.parentNode.insertBefore(container, img);
        container.appendChild(img);
      }
    }

    if (compatibility.compatible) {
      // Green border for matches
      img.classList.add('season-match');
      container.classList.remove('season-dimmed');
    } else {
      // Dim non-matches
      img.classList.add('season-no-match');
      container.classList.add('season-dimmed');
    }

    // Add color palette debug display
    addColorPaletteSwatch(container, img);

    // Add enhanced match badge with season info
    addMatchBadge(container, matchResult, productSeasonResult, compatibility);

    // Add enhanced hover tooltip with season details
    addTooltip(img, matchResult, productSeasonResult, compatibility);
  }

  /**
   * Add color palette debug display showing dominant colors from ColorThief
   */
  function addColorPaletteSwatch(container, img) {
    // Remove existing palette display
    const existingPalette = container.querySelector('.color-palette-swatch-container');
    if (existingPalette) {
      existingPalette.remove();
    }

    // Get dominant colors from the image dataset
    const dominantColorsJson = img.dataset.dominantColors;
    if (!dominantColorsJson) {
      return; // No color data available
    }

    try {
      const dominantColors = JSON.parse(dominantColorsJson);

      // Create container for color swatches
      const paletteContainer = document.createElement('div');
      paletteContainer.className = 'color-palette-swatch-container';

      // Create a swatch for each dominant color
      dominantColors.forEach((hexColor, index) => {
        const swatch = document.createElement('div');
        swatch.className = 'season-color-swatch';
        swatch.style.backgroundColor = hexColor;

        // Mark first swatch if it came from website selection
        if (index === 0 && img.dataset.selectedSwatchColor === hexColor) {
          swatch.classList.add('website-sourced');
          swatch.dataset.fromWebsite = 'true';
          swatch.title = `${hexColor} (from website)`;
        } else {
          swatch.title = hexColor; // Show hex value on hover
        }

        paletteContainer.appendChild(swatch);
      });

      // Add skin tone swatch if detected
      if (img.dataset.skinTone) {
        const skinSwatch = document.createElement('div');
        skinSwatch.className = 'season-color-swatch skin-tone-swatch';
        skinSwatch.style.backgroundColor = img.dataset.skinTone;
        skinSwatch.title = `Skin Tone: ${img.dataset.skinTone}`;
        skinSwatch.textContent = '👤'; // Person icon
        paletteContainer.appendChild(skinSwatch);
      }

      // Add hair color swatch if detected
      if (img.dataset.hairColor) {
        const hairSwatch = document.createElement('div');
        hairSwatch.className = 'season-color-swatch hair-color-swatch';
        hairSwatch.style.backgroundColor = img.dataset.hairColor;
        hairSwatch.title = `Hair Color: ${img.dataset.hairColor}`;
        hairSwatch.textContent = '✂️'; // Scissors icon (represents hair)
        paletteContainer.appendChild(hairSwatch);
      }

      // Add to container
      container.appendChild(paletteContainer);
    } catch (error) {
      console.error('Error creating color palette swatch:', error);
    }
  }

  /**
   * Add match badge overlay with season information
   */
  function addMatchBadge(container, matchResult, productSeasonResult, compatibility) {
    // Remove existing badge
    const existingBadge = container.querySelector('.season-badge');
    if (existingBadge) {
      existingBadge.remove();
    }

    const badge = document.createElement('div');
    badge.className = 'season-badge';

    // Show product's season emoji and compatibility indicator
    const primarySeason = productSeasonResult?.primarySeason;
    if (primarySeason && primarySeason.emoji) {
      if (compatibility.compatible) {
        badge.innerHTML = `✓`;
        badge.classList.add('match');
      } else {
        badge.innerHTML = `˟`;
        badge.classList.add('no-match');
      }
    } else {
      // Fallback to simple checkmark/cross if no season detected
      if (matchResult.matches) {
        badge.innerHTML = '✓';
        badge.classList.add('match');
      } else {
        badge.innerHTML = '✗';
        badge.classList.add('no-match');
      }
    }

    container.appendChild(badge);
  }

  /**
   * Add hover tooltip showing match details with season information
   */
  function addTooltip(img, matchResult, productSeasonResult, compatibility) {
    const primarySeason = productSeasonResult?.primarySeason;
    const secondarySeasons = productSeasonResult?.secondarySeasons || [];

    if (!primarySeason) {
      img.title = `No clear season match detected`;
      return;
    }

    let tooltip = '';

    if (compatibility.compatible) {
      if (compatibility.matchType === 'primary') {
        tooltip = `✓ ${primarySeason.emoji} ${primarySeason.seasonName}\n`;
        tooltip += `Perfect match for your season! (${primarySeason.confidence.toFixed(0)}% match)`;
      } else if (compatibility.matchType === 'secondary') {
        tooltip = `✓ ${primarySeason.emoji} ${primarySeason.seasonName}\n`;
        tooltip += `Also works for your season (${matchResult.confidence.toFixed(0)}% match)`;
      }
      if (secondarySeasons.length > 0) {
        tooltip += `\nAlso works for: ${secondarySeasons.map((s) => s.seasonName).join(', ')}`;
      }
    } else {
      tooltip = `✗ ${primarySeason.emoji} ${primarySeason.seasonName} item\n`;
      tooltip += compatibility.reason;
      if (compatibility.recommendation) {
        tooltip += `\n${compatibility.recommendation}`;
      }
    }

    img.title = tooltip;
  }

  /**
   * Add simplified badge for swatch-only mode (checkmark or X with "W" indicator)
   */
  function addSwatchOnlyBadge(container, matchResult, swatchColor) {
    // Remove existing badge
    const existingBadge = container.querySelector('.season-badge');
    if (existingBadge) {
      existingBadge.remove();
    }

    const badge = document.createElement('div');
    badge.className = 'season-badge swatch-only-badge';

    // Simple checkmark or X
    if (matchResult.isMatch) {
      badge.innerHTML = '✓';
      badge.classList.add('match');
    } else {
      badge.innerHTML = '✗';
      badge.classList.add('no-match');
    }

    // Add "W" indicator badge to show this came from website swatch
    badge.title = `Website color (${swatchColor.source})`;

    container.appendChild(badge);
  }

  /**
   * Add simplified tooltip for swatch-only mode
   */
  function addSwatchOnlyTooltip(img, matchResult, swatchColor) {
    let tooltip = '';

    if (matchResult.isMatch) {
      tooltip = `✓ ${swatchColor.hex} matches your ${settings.selectedSeason} palette\n`;
      tooltip += `Color from website (${swatchColor.source})\n`;
      tooltip += `Delta E: ${matchResult.deltaE.toFixed(1)} (${matchResult.deltaE < 5 ? 'excellent' : matchResult.deltaE < 10 ? 'good' : 'acceptable'} match)`;
    } else {
      tooltip = `✗ ${swatchColor.hex} doesn't match your ${settings.selectedSeason} palette\n`;
      tooltip += `Color from website (${swatchColor.source})\n`;
      tooltip += `Delta E: ${matchResult.deltaE.toFixed(1)} (too different)`;
    }

    img.title = tooltip;
  }

  /**
   * Observe DOM for new images (lazy loading, infinite scroll)
   */
  function observeNewImages() {
    const observer = new MutationObserver((mutations) => {
      // Debounce to avoid processing too frequently
      clearTimeout(window.seasonFilterDebounce);
      window.seasonFilterDebounce = setTimeout(() => {
        findAndProcessImages();
      }, 500);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  /**
   * Reset and refilter all images
   */
  function resetAndRefilter() {
    processedImages = new WeakSet(); // Reset by creating a new WeakSet
    processedSwatches = new WeakSet();
    stats = { totalImages: 0, matchingImages: 0, totalSwatches: 0, matchingSwatches: 0 };
    hasShownSummary = false;
    removeAllFilters();
    startFiltering();
  }

  /**
   * Remove all filters from page
   */
  function removeAllFilters() {
    document.querySelectorAll('.season-match, .season-no-match').forEach((img) => {
      img.classList.remove('season-match', 'season-no-match');
      img.title = '';
    });

    document.querySelectorAll('.season-dimmed').forEach((container) => {
      container.classList.remove('season-dimmed');
    });

    document.querySelectorAll('.season-badge').forEach((badge) => {
      badge.remove();
    });

    updateOverlay();
  }

  /**
   * Update overlay widget with current stats
   */
  function updateOverlay() {
    if (typeof window.updateOverlay === 'function') {
      window.updateOverlay(stats, settings);
    }
  }

  /**
   * ===================================
   * COLOR SWATCH DETECTION FEATURE
   * ===================================
   */

  /**
   * Setup inactivity detection
   */
  function setupInactivityDetection() {
    const resetTimer = () => {
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        onUserIdle();
      }, inactivityDelay);
    };

    // Reset timer on user activity
    document.addEventListener('scroll', resetTimer, { passive: true });
    document.addEventListener('mousemove', resetTimer, { passive: true });
    document.addEventListener('click', resetTimer);
    document.addEventListener('keydown', resetTimer);

    // Start initial timer
    resetTimer();
  }

  /**
   * Called when user is idle for X seconds
   */
  function onUserIdle() {
    // Only show summary once per page load
    if (hasShownSummary) return;

    // Find and process color swatches
    const swatches = findColorSwatches();
    if (swatches.length === 0) return;

    console.log('[Season Color Checker] Found', swatches.length, 'color swatches to analyze');

    // Process each swatch
    swatches.forEach((swatch) => {
      if (!processedSwatches.has(swatch)) {
        processSwatch(swatch);
      }
    });

    // Show summary if we found swatches
    if (stats.totalSwatches > 0) {
      hasShownSummary = true;
      showSwatchSummary();
      updateOverlay();
    }
  }

  /**
   * Find color swatch elements on the page
   */
  function findColorSwatches() {
    const swatches = [];

    // Common swatch selectors for e-commerce sites
    const swatchSelectors = [
      '[class*="swatch"]',
      '[class*="color-option"]',
      '[class*="color-selector"]',
      '[class*="colour"]',
      '[class*="variant"]',
      '[data-color]',
      '[aria-label*="color"]',
      '[aria-label*="colour"]',
    ];

    // Find elements matching common swatch patterns
    swatchSelectors.forEach((selector) => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach((el) => {
          if (isValidSwatch(el)) {
            swatches.push(el);
          }
        });
      } catch (e) {
        // Invalid selector, skip
      }
    });

    // Also look for small divs with solid background colors (common pattern)
    const allDivs = document.querySelectorAll('div, span, button');
    allDivs.forEach((el) => {
      const style = window.getComputedStyle(el);
      const width = el.offsetWidth;
      const height = el.offsetHeight;

      // Check if it's swatch-sized (20-80px) and has a background color
      if (width >= 20 && width <= 80 && height >= 20 && height <= 80) {
        const bgColor = style.backgroundColor;
        if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
          // Make sure it's not already in the list
          if (!swatches.includes(el) && isValidSwatch(el)) {
            swatches.push(el);
          }
        }
      }
    });

    // Remove duplicates
    return [...new Set(swatches)];
  }

  /**
   * Check if element is a valid color swatch
   */
  function isValidSwatch(el) {
    // EXCLUDE our own extension elements from swatch detection
    // This prevents our badges and ColorThief swatches from being treated as website swatches
    if (
      el.classList.contains('season-badge') ||
      el.classList.contains('season-color-swatch') ||
      el.classList.contains('color-palette-swatch-container') ||
      el.classList.contains('season-filter-container') ||
      el.classList.contains('season-overlay') ||
      el.closest('.season-badge') ||
      el.closest('.color-palette-swatch-container') ||
      el.closest('.season-filter-container') ||
      el.closest('.season-overlay')
    ) {
      return false;
    }

    // Must be visible
    if (el.offsetParent === null) return false;
    if (el.style.display === 'none' || el.style.visibility === 'hidden') return false;

    const style = window.getComputedStyle(el);

    // Must have a background color
    const bgColor = style.backgroundColor;
    if (!bgColor || bgColor === 'rgba(0, 0, 0, 0)' || bgColor === 'transparent') {
      return false;
    }

    // Skip if it's too large (likely not a swatch)
    const width = el.offsetWidth;
    const height = el.offsetHeight;
    if (width > 100 || height > 100) return false;

    // Skip if it's too small (likely an icon or decoration)
    if (width < 15 || height < 15) return false;

    return true;
  }

  /**
   * Process a single color swatch
   */
  function processSwatch(swatch) {
    processedSwatches.add(swatch);
    stats.totalSwatches++;

    try {
      // Extract background color
      const style = window.getComputedStyle(swatch);
      const bgColor = style.backgroundColor;

      // Convert rgba/rgb to hex
      const hex = rgbStringToHex(bgColor);
      if (!hex) {
        stats.totalSwatches--;
        return;
      }

      // Convert hex to RGB array for color processor
      const rgb = colorProcessor.hexToRgb(hex);
      if (!rgb) {
        stats.totalSwatches--;
        return;
      }

      // Get season palette
      const seasonPalette = SEASONAL_PALETTES[settings.selectedSeason];
      if (!seasonPalette) {
        stats.totalSwatches--;
        return;
      }

      // Find closest matching color
      const result = colorProcessor.findClosestMatch(hex, seasonPalette.colors);

      // Store swatch data
      swatch.dataset.swatchColor = hex;
      swatch.dataset.swatchMatch = result.isMatch ? 'true' : 'false';
      swatch.dataset.swatchDeltaE = result.deltaE.toFixed(1);

      // Update stats
      if (result.isMatch) {
        stats.matchingSwatches++;
      }

      // Apply visual styling
      applySwatchStyle(swatch, result);
    } catch (error) {
      console.error('[Season Color Checker] Error processing swatch:', error);
      stats.totalSwatches--;
    }
  }

  /**
   * Convert rgb/rgba string to hex
   */
  function rgbStringToHex(rgbString) {
    // Parse rgb(r, g, b) or rgba(r, g, b, a)
    const match = rgbString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!match) return null;

    const r = parseInt(match[1]);
    const g = parseInt(match[2]);
    const b = parseInt(match[3]);

    return colorProcessor.rgbToHex([r, g, b]);
  }

  /**
   * Apply visual styling to swatch
   */
  function applySwatchStyle(swatch, result) {
    // Remove existing classes
    swatch.classList.remove('season-swatch-match', 'season-swatch-no-match');

    // Add match/no-match class
    if (result.isMatch) {
      swatch.classList.add('season-swatch-match');
    } else {
      swatch.classList.add('season-swatch-no-match');
    }

    // Add tooltip
    const hex = swatch.dataset.swatchColor;
    const deltaE = swatch.dataset.swatchDeltaE;

    if (result.isMatch) {
      swatch.title = `✓ ${hex} matches your ${settings.selectedSeason} palette (ΔE ${deltaE})`;
    } else {
      swatch.title = `✗ ${hex} doesn't match (ΔE ${deltaE})`;
    }
  }

  /**
   * Show swatch summary notification
   */
  function showSwatchSummary() {
    if (typeof window.showSwatchSummary === 'function') {
      window.showSwatchSummary(stats, settings);
    }
  }

  /**
   * Handle clicks on product images to add to wishlist
   */
  document.addEventListener(
    'click',
    (e) => {
      const img = e.target.closest('img.season-match');
      if (!img) return;

      // Check if clicking on the image itself (not just near it)
      if (e.target !== img) return;

      // Show "Add to wishlist" option
      if (confirm('Add this item to your wishlist?')) {
        const dominantColors = JSON.parse(img.dataset.dominantColors || '[]');
        const matchScore = parseInt(img.dataset.matchScore || '0');
        const imageUrl = img.src;

        // Fetch image as data URL to avoid CORS issues in popup
        chrome.runtime.sendMessage(
          {
            action: 'fetchImage',
            url: imageUrl,
          },
          (fetchResponse) => {
            if (fetchResponse && fetchResponse.success) {
              // Now add to wishlist with data URL
              chrome.runtime.sendMessage(
                {
                  action: 'addToWishlist',
                  imageUrl: fetchResponse.dataUrl,
                  pageUrl: window.location.href,
                  dominantColors: dominantColors,
                  matchScore: matchScore,
                },
                (response) => {
                  if (response && response.success) {
                    alert('Added to wishlist!');
                  }
                },
              );
            } else {
              // Fallback to original URL if fetch fails
              chrome.runtime.sendMessage(
                {
                  action: 'addToWishlist',
                  imageUrl: imageUrl,
                  pageUrl: window.location.href,
                  dominantColors: dominantColors,
                  matchScore: matchScore,
                },
                (response) => {
                  if (response && response.success) {
                    alert('Added to wishlist!');
                  }
                },
              );
            }
          },
        );
      }
    },
    true,
  );

  /**
   * Helper function to extract domain from URL
   */
  function getDomainFromUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (e) {
      return null;
    }
  }

  /**
   * Show dismissable CORS badge on image
   * Displays when all automatic CORS workarounds fail
   */
  function showCorsBadge(img) {
    // Check if badge already exists for this image
    if (img.dataset.corsBadgeShown === 'true') {
      return;
    }

    // Check if user has dismissed badges for this domain
    const domain = getDomainFromUrl(img.src);
    const dismissedDomains = JSON.parse(
      localStorage.getItem('seasonColorChecker_dismissedDomains') || '[]',
    );
    if (dismissedDomains.includes(domain)) {
      return;
    }

    // Mark this image as having a badge
    img.dataset.corsBadgeShown = 'true';

    // Ensure image parent has position relative
    const parent = img.parentElement;
    if (parent && getComputedStyle(parent).position === 'static') {
      parent.style.position = 'relative';
    }

    // Create badge container
    const badge = document.createElement('div');
    badge.className = 'season-color-checker-cors-badge';
    badge.innerHTML = `
      <div class="scc-badge-content">
        <span class="scc-badge-icon">🔒</span>
        <span class="scc-badge-text">Can't analyze</span>
        <button class="scc-badge-action" title="Try color picker">🎨</button>
        <button class="scc-badge-close" title="Dismiss">×</button>
      </div>
    `;

    // Position badge relative to image
    badge.style.cssText = `
      position: absolute;
      top: 8px;
      left: 8px;
      background: rgba(255, 107, 107, 0.95);
      color: white;
      padding: 6px 10px;
      border-radius: 4px;
      font-size: 12px;
      font-family: system-ui, -apple-system, sans-serif;
      z-index: 10000;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      display: flex;
      align-items: center;
      gap: 6px;
      pointer-events: auto;
    `;

    // Add event listeners
    const closeBtn = badge.querySelector('.scc-badge-close');
    const actionBtn = badge.querySelector('.scc-badge-action');

    closeBtn.onclick = (e) => {
      e.stopPropagation();
      badge.remove();
    };

    actionBtn.onclick = async (e) => {
      e.stopPropagation();

      // Launch EyeDropper if available
      if (window.EyeDropper) {
        try {
          const eyeDropper = new EyeDropper();
          const result = await eyeDropper.open();

          // Send color to background for checking
          chrome.runtime.sendMessage({
            action: 'checkColorFromPicker',
            color: result.sRGBHex,
            season: settings.selectedSeason,
          });

          badge.remove();
        } catch (err) {
          console.log('[Season Color Checker] EyeDropper cancelled or failed');
        }
      }
    };

    // Add "Don't show on this site" option on right-click
    badge.oncontextmenu = (e) => {
      e.preventDefault();
      if (confirm(`Don't show CORS warnings on ${domain}?`)) {
        dismissedDomains.push(domain);
        localStorage.setItem(
          'seasonColorChecker_dismissedDomains',
          JSON.stringify(dismissedDomains),
        );

        // Remove all badges on this domain
        document.querySelectorAll('.season-color-checker-cors-badge').forEach((b) => b.remove());
      }
    };

    // Insert badge (prefer parent for better positioning, fallback to body)
    if (parent && parent !== document.body) {
      parent.style.position = 'relative';
      parent.appendChild(badge);
    } else {
      // Fallback: position fixed relative to image position
      const rect = img.getBoundingClientRect();
      badge.style.position = 'fixed';
      badge.style.top = `${rect.top + 8}px`;
      badge.style.left = `${rect.left + 8}px`;
      document.body.appendChild(badge);
    }
  }

  /**
   * Track CORS event (notify service worker) - non-blocking
   */
  function trackCorsEvent(domain, eventType, method = 'direct') {
    if (!domain) return;

    // Send to service worker for tracking (fire and forget - don't wait for response)
    chrome.runtime
      .sendMessage({
        action: 'trackCorsEvent',
        domain: domain,
        eventType: eventType,
        method: method,
      })
      .catch(() => {
        // Ignore errors - tracking is optional
      });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();
