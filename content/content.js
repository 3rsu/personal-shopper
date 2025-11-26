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
    textColorEnhancementEnabled: true, // Enable text-based color enhancement
  };

  let colorProcessor = null;
  let processedImages = new WeakSet(); // Track actual image elements we've analyzed
  let processedSwatches = new WeakSet(); // Track analyzed swatch elements
  let swatchAnalysisData = new WeakMap(); // Store swatch analysis without DOM modifications
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
   * Get current domain
   */
  function getCurrentDomain() {
    const hostname = window.location.hostname;
    return hostname.replace(/^www\./, '');
  }

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

        // Apply initial showSwatches state
        if (settings.showSwatches) {
          document.body.classList.add('show-swatches');
          console.log('[Season Color Checker] 🎨 Debug mode enabled: swatches will be visible');
        } else {
          console.log('[Season Color Checker] Debug mode disabled: swatches hidden');
        }

        // Check if extension should activate on this domain
        const currentDomain = getCurrentDomain();
        const favoriteSites = settings.favoriteSites || [];
        const isFavorite = favoriteSites.some(
          (site) => currentDomain.includes(site) || site.includes(currentDomain),
        );

        // Only activate if domain is in favorites
        if (!isFavorite) {
          console.log('[Season Color Checker] Not active on this site:', currentDomain);
          return; // Exit early
        }

        // Only run if user has selected a season
        if (settings.selectedSeason) {
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

    // Listen for storage changes (replaces message-based sync)
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync') {
        if (changes.selectedSeason) {
          settings.selectedSeason = changes.selectedSeason.newValue;
          resetAndRefilter();
        }

        if (changes.favoriteSites) {
          // Favorites changed - popup.js reloads the page when toggling favorites
          settings.favoriteSites = changes.favoriteSites.newValue;
        }

        if (changes.showSwatches) {
          // Toggle body class to show/hide swatches
          if (changes.showSwatches.newValue) {
            document.body.classList.add('show-swatches');
            console.log('[Season Color Checker] 🎨 Debug mode toggled ON: swatches now visible');
          } else {
            document.body.classList.remove('show-swatches');
            console.log('[Season Color Checker] 🎨 Debug mode toggled OFF: swatches now hidden');
          }
        }

        // Note: showOverlay changes are handled by overlay.js storage listener
      }
    });
  }

  /**
   * Handle messages from background script or popup
   */
  function handleMessage(request, sender, sendResponse) {
    if (request.action === 'toggleHighlights') {
      toggleHighlights(request.enabled);
      sendResponse({ success: true });
    }

    // NEW: Expose swatch detection JSON API
    if (request.action === 'getSwatchesJSON') {
      try {
        // Determine container to search
        const container = request.containerSelector
          ? document.querySelector(request.containerSelector)
          : document.body;

        if (!container) {
          sendResponse({
            success: false,
            error: 'Container not found',
          });
          return true;
        }

        // Get product image if available
        const productImage = request.productImageSelector
          ? document.querySelector(request.productImageSelector)
          : null;

        // Build options
        const options = {
          includeDisabled: request.includeDisabled !== false,
          includePatterns: request.includePatterns !== false,
          minConfidence: request.minConfidence || 0.3,
          maxSwatches: request.maxSwatches || 50,
          productImage: productImage,
        };

        // Call swatch detector API
        if (typeof window.getSwatchesAsJSON === 'function') {
          const result = window.getSwatchesAsJSON(container, options);

          // Remove element references before sending (can't send DOM elements via message)
          const serializedResult = {
            swatches: result.swatches.map((swatch) => ({
              id: swatch.id,
              color: swatch.color,
              colorRgb: swatch.colorRgb,
              label: swatch.label,
              image: swatch.image,
              selected: swatch.selected,
              confidence: swatch.confidence,
              source: swatch.source,
              isPattern: swatch.isPattern,
              isDisabled: swatch.isDisabled,
              attributes: swatch.attributes,
            })),
            selectedIndex: result.selectedIndex,
            totalCount: result.totalCount,
            errors: result.errors,
          };

          sendResponse({
            success: true,
            data: serializedResult,
          });
        } else {
          sendResponse({
            success: false,
            error: 'Swatch detector not loaded',
          });
        }
      } catch (error) {
        sendResponse({
          success: false,
          error: error.message,
        });
      }

      return true;
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

    // Initialize overlay widget first
    if (typeof window.initializeOverlay === 'function') {
      window.initializeOverlay(stats, settings);
      console.log('[Season Color Checker] Overlay widget initialized');
    } else {
      console.warn('[Season Color Checker] Overlay not available');
    }

    // Show loading state immediately
    if (typeof window.showLoadingState === 'function') {
      window.showLoadingState();
      console.log('[Season Color Checker] Loading state shown');
    }

    // Find and process product images
    findAndProcessImages();

    // Set up observer for dynamically loaded content (infinite scroll, etc.)
    observeNewImages();

    // Set up inactivity detection for color swatches
    setupInactivityDetection();

    // Watch for swatch selection changes (dynamic sites with AJAX)
    if (typeof watchSwatchChanges === 'function') {
      watchSwatchChanges();
      console.log('[Season Color Checker] Swatch change watcher initialized');
    }
  }

  /**
   * Detect page type based on number of product images
   * @param {Array} images - Array of product image elements
   * @returns {string} - 'detail' for single-product pages, 'listing' for multi-product pages
   */
  function detectPageType(images) {
    // If <= 16 images, likely a detail page (single product with multiple views)
    // If > 16 images, likely a listing page (multiple products)
    return images.length <= 16 ? 'detail' : 'listing';
  }

  /**
   * Find product images on the page
   */
  async function findAndProcessImages() {
    let images = findProductImages();
    const pageType = detectPageType(images);
    const totalToProcess = images.filter((img) => !processedImages.has(img)).length;
    const swatches = images.filter(
      (img) =>
        img.naturalHeight < 50 && img.naturalHeight < 50 && img.naturalHeight === img.naturalWidth,
    );
    images = images.filter((img) => !swatches.includes(img)); // Exclude swatches
    console.log('swatches', images);

    let processedCount = 0;
    console.log(
      'TOTAL TO PROCESS',
      totalToProcess,
      'swatches',
      swatches.length,
      images[30],
      images[30].naturalWidth,
      images[30].naturalHeight,
    );

    // Process all images
    const processingPromises = images.map(async (img) => {
      if (!processedImages.has(img)) {
        await processImage(img, pageType);
        processedCount++;

        // Update loading progress every 5 images or on last image
        if (processedCount % 5 === 0 || processedCount === totalToProcess) {
          if (typeof window.updateLoadingProgress === 'function') {
            window.updateLoadingProgress(processedCount, totalToProcess);
          }
        }
      }
    });

    // Wait for all images to be processed
    await Promise.all(processingPromises);

    // Hide loading state and show final stats
    if (typeof window.hideLoadingState === 'function') {
      window.hideLoadingState();
    }
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

      // Check HTML width/height attributes FIRST (works for lazy-loaded images too)
      const attrWidth = parseInt(img.getAttribute('width')) || 0;
      const attrHeight = parseInt(img.getAttribute('height')) || 0;

      // if (attrWidth > 0 && attrHeight > 0) {
      //   // If HTML attributes indicate small size, skip immediately
      //   if (attrWidth < 100 || attrHeight < 100) {
      //     return;
      //   }

      //   // Check for small square swatch images by HTML attributes
      //   if (attrWidth <= 100 && attrHeight <= 100) {
      //     const imgClasses = (img.className || '').toLowerCase();
      //     const imgAlt = (img.alt || '').toLowerCase();
      //     if (
      //       imgClasses.includes('swatch') ||
      //       imgClasses.includes('color') ||
      //       imgClasses.includes('variant') ||
      //       imgAlt.includes('swatch') ||
      //       imgAlt.includes('color')
      //     ) {
      //       return; // Skip website swatch images
      //     }
      //   }
      // }

      // For loaded images, check actual rendered size
      if (img.complete) {
        // Skip if too small (likely icon, thumbnail, or UI element)
        // if (img.offsetWidth < 100 || img.offsetHeight < 100) {
        //   return;
        // }
        // Skip images that look like website color swatches (small, square images)
        // These are typically 20-100px and used for color selection
        // if (img.offsetWidth <= 100 && img.offsetHeight <= 100) {
        //   // Check if it has swatch-related attributes or classes
        //   const imgClasses = (img.className || '').toLowerCase();
        //   const imgAlt = (img.alt || '').toLowerCase();
        //   if (
        //     imgClasses.includes('swatch') ||
        //     imgClasses.includes('color') ||
        //     imgClasses.includes('variant') ||
        //     imgAlt.includes('swatch') ||
        //     imgAlt.includes('color')
        //   ) {
        //     return; // Skip website swatch images
        //   }
        // }
      }
      // For unloaded images without size attributes, include them - size will be checked in processImage()

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
      const width = img.offsetWidth || img.width;
      const height = img.offsetHeight || img.height;
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
   * Find all distinct background colors from border samples using clustering
   * @param {Array<Array<number>>} borderColors - Array of RGB color arrays
   * @returns {Array<Array<number>>} - Array of RGB background colors (multiple backgrounds supported)
   */
  function findAllBackgroundColors(borderColors) {
    if (!borderColors || borderColors.length === 0) return [];

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

    // Return ALL significant clusters (2+ samples), not just the largest
    // This handles multi-region backgrounds (e.g., floor + sky)
    const backgroundColors = [];

    for (const cluster of clusters) {
      // Only include clusters with 2+ samples (filter out noise)
      if (cluster.colors.length >= 2) {
        // Calculate average color for this cluster
        const avgR = Math.round(
          cluster.colors.reduce((sum, c) => sum + c[0], 0) / cluster.colors.length,
        );
        const avgG = Math.round(
          cluster.colors.reduce((sum, c) => sum + c[1], 0) / cluster.colors.length,
        );
        const avgB = Math.round(
          cluster.colors.reduce((sum, c) => sum + c[2], 0) / cluster.colors.length,
        );
        backgroundColors.push([avgR, avgG, avgB]);
      }
    }

    return backgroundColors;
  }

  /**
   * Extract center region of image using static crop (fallback method)
   * @param {HTMLImageElement|HTMLCanvasElement} img - Image to crop
   * @returns {HTMLCanvasElement|null} - Cropped canvas focused on center product
   */
  function extractCenterRegionStatic(img) {
    try {
      const width = img.offsetWidth || img.width;
      const height = img.offsetHeight || img.height;

      // Calculate crop percentages
      const cropLeft = Math.floor(width * 0.4); // Remove 20% from left
      const cropRight = Math.floor(width * 0.4); // Remove 20% from right
      const cropTop = Math.floor(height * 0.2); // Remove 15% from top
      const cropBottom = Math.floor(height * 0.2); // Remove 10% from bottom

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
   * Extract center region using smartcrop.js for content-aware cropping
   * Falls back to static crop if smartcrop fails
   * @param {HTMLImageElement|HTMLCanvasElement} img - Image to crop
   * @returns {Promise<HTMLCanvasElement|null>} - Cropped canvas focused on important content
   */
  async function extractCenterRegion(img) {
    try {
      const width = img.offsetWidth || img.width;
      const height = img.offsetHeight || img.height;

      // Calculate target crop dimensions for upper body focus
      // Target: ~50% of width, ~60% of height (upper portion)
      const targetWidth = Math.floor(width * 0.5);
      const targetHeight = Math.floor(height * 0.6);

      // Define garment boost region (chest/upper torso area)
      // const garmentBoost = {
      //   x: Math.floor(width * 0.25), // 25% from left (center region)
      //   y: Math.floor(height * 0.3), // 30% from top (below typical face)
      //   width: Math.floor(width * 0.5), // 50% width (center torso)
      //   height: Math.floor(height * 0.35), // 35% height (chest area)
      //   weight: 1.0, // Full boost weight
      // };

      const garmentBoost = {
        x: Math.floor(width * 0.1), // Start 10% from the left (leaving 10% margin on sides)
        y: Math.floor(height * 0.05), // Start 5% from the top
        width: Math.floor(width * 0.8), // Cover 80% of the image width
        height: Math.floor(height * 0.85), // Cover 85% of the image height (Amazon's requirement)
        weight: 1.0, // Maximum boost weight
      };

      // Use smartcrop to find best crop for upper garment
      const result = await smartcrop.crop(img, {
        width: targetWidth,
        height: targetHeight,
        minScale: 0.8, // Allow slight downscaling if needed
        ruleOfThirds: true, // Better composition
        skinWeight: 0, // Disable skin detection to avoid face bias
        detailWeight: 0.4, // Boost edge/texture detection (garment details)
        saturationWeight: 0.4, // Boost color detection (garment colors)
        // boost: [garmentBoost], // Prioritize chest/torso area
      });

      const crop = result.topCrop;

      // Create canvas with cropped dimensions
      const canvas = document.createElement('canvas');
      canvas.width = crop.width;
      canvas.height = crop.height;
      const ctx = canvas.getContext('2d');

      // Draw smartcrop-selected region
      ctx.drawImage(
        img,
        crop.x,
        crop.y,
        crop.width,
        crop.height, // Source: smartcrop-selected region
        0,
        0,
        crop.width,
        crop.height, // Dest: fill canvas
      );
      console.log('Smart Crop Successful', crop);

      return canvas;
    } catch (e) {
      console.log('Smart Crop Failed', e);
      console.error('[Season Color Checker] Error with smartcrop, falling back to static crop:', e);

      // FALLBACK: Use original static crop logic
      return extractCenterRegionStatic(img);
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
   * @param {Array<Array<number>>} backgroundColors - Array of detected background colors (supports multiple backgrounds)
   * @param {Array<Object>} textColorMentions - Text color mentions from product description (optional)
   * @returns {Array<Array<number>>} - Filtered palette
   */
  function filterBackgroundColors(palette, backgroundColors, textColorMentions = []) {
    if (!palette || palette.length === 0) return palette;

    return palette.filter((color) => {
      // Check against ALL detected background colors (handles multi-region backgrounds like floor + sky)
      if (backgroundColors && backgroundColors.length > 0) {
        for (const backgroundColor of backgroundColors) {
          const deltaE = colorProcessor.calculateDeltaE(color, backgroundColor);

          if (deltaE < 30) {
            // Color is similar to this background region

            // TEXT-ENHANCEMENT BACKGROUND PROTECTION
            // If text mentions this color AND it's similar to background, KEEP it
            // Rationale: It's likely the product color, not the background
            // Example: "Navy Blue Sweater" on navy background → keep navy
            if (textColorMentions.length > 0) {
              const colorHex = colorProcessor.rgbToHex(color);
              const isTextMentioned = textColorMentions.some((mention) => {
                if (!mention.hex) return false;
                const textDeltaE = colorProcessor.calculateDeltaE(
                  colorProcessor.hexToRgb(mention.hex),
                  color,
                );
                return textDeltaE < 20; // Close match to text-mentioned color
              });

              if (isTextMentioned) {
                console.log(
                  '[Season Color Checker] Preserving color similar to background (text-mentioned):',
                  colorHex,
                );
                return true; // KEEP - text confirms this is the product color
              }
            }

            // Not text-mentioned, filter it out as background
            return false;
          }
        }
      }

      // Filter out very desaturated colors (likely backgrounds/neutrals)
      // BUT preserve dark colors (blacks, navies, charcoals) which are valid garment colors
      const saturation = getSaturation(color);

      // Calculate lightness to distinguish dark neutrals from light backgrounds
      const lightness = (Math.max(...color) + Math.min(...color)) / (2 * 255);

      // Only filter desaturated colors if they're NOT dark
      // Black/navy garments: low saturation + low lightness (< 0.3) → KEEP
      // Beige/gray backgrounds: low saturation + high lightness (> 0.3) → FILTER
      if (saturation < 0.15 && lightness > 0.3) {
        return false;
      }

      return true;
    });
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
  async function processImage(img, pageType = 'detail') {
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

      // CRITICAL: Check image size BEFORE any processing
      // This prevents expensive ColorThief analysis on small swatches/icons
      if (img.offsetWidth < 100 || img.offsetHeight < 100) {
        stats.totalImages--; // Don't count this image
        processedImages.delete(img); // Remove from processed set
        console.log(
          `[Season Color Checker] Skipped small image (${img.offsetWidth}x${img.offsetHeight}):`,
          img.src.substring(0, 100),
        );
        return;
      }

      // Additional check: Skip small square images that are likely color swatches
      if (img.offsetWidth <= 100 && img.offsetHeight <= 100) {
        const imgClasses = (img.className || '').toLowerCase();
        const imgAlt = (img.alt || '').toLowerCase();
        if (
          imgClasses.includes('swatch') ||
          imgClasses.includes('color') ||
          imgClasses.includes('variant') ||
          imgAlt.includes('swatch') ||
          imgAlt.includes('color')
        ) {
          stats.totalImages--;
          processedImages.delete(img);
          console.log('[Season Color Checker] Skipped swatch image:', img.src.substring(0, 100));
          return;
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
      let backgroundColors = [];

      try {
        // Step 1: Sample border colors to detect ALL background regions (supports multi-color backgrounds)
        const borderColors = sampleBorder(processableImage);
        if (borderColors.length > 0) {
          backgroundColors = findAllBackgroundColors(borderColors);
          if (backgroundColors.length > 0) {
            console.log(
              '[Season Color Checker] Detected',
              backgroundColors.length,
              'background region(s):',
              backgroundColors.map((bg) => colorProcessor.rgbToHex(bg)).join(', '),
            );
          }
        }

        // Step 2: Extract center region using smartcrop.js for content-aware cropping
        let imageToAnalyze = processableImage;
        const centerCanvas = await extractCenterRegion(processableImage);
        if (centerCanvas) {
          console.log('[Season Color Checker] Extracted center region for analysis');
          imageToAnalyze = centerCanvas;
        } else {
          console.log('[Season Color Checker] Center extraction failed, using full image');
        }

        // Step 3: Extract dominant colors from center region
        const rawColors = colorThief.getPalette(imageToAnalyze, 8); // Get more colors initially

        // Step 3.5: Extract text color mentions BEFORE background filtering
        // This allows us to protect text-mentioned colors from being filtered as background
        let textColorMentions = [];
        if (
          settings.textColorEnhancementEnabled &&
          typeof extractColorKeywordsFromDOM === 'function'
        ) {
          // Verify dictionary is loaded before attempting text color extraction
          if (typeof window.getAllColorNames !== 'function') {
            console.warn(
              '[Season Color Checker] Fashion dictionary not loaded, text enhancement disabled',
            );
            settings.textColorEnhancementEnabled = false;
          } else {
            try {
              textColorMentions = extractColorKeywordsFromDOM(img) || [];
              if (textColorMentions.length > 0) {
                console.log(
                  '[Season Color Checker] Found text color mentions (for background protection):',
                  textColorMentions.map((m) => m.keyword).join(', '),
                );
              }
            } catch (textError) {
              console.log(
                '[Season Color Checker] Text color extraction failed:',
                textError.message,
              );
              textColorMentions = [];
            }
          }
        }

        // Step 4: Filter out background and desaturated colors
        // Pass text mentions to protect product colors that match text descriptions
        dominantColors = filterBackgroundColors(rawColors, backgroundColors, textColorMentions);

        console.log(
          '[Season Color Checker] Filtered palette:',
          dominantColors.length,
          'colors after background removal',
        );

        // Step 5: Apply text-based weighting to palette
        if (
          settings.textColorEnhancementEnabled &&
          textColorMentions.length > 0 &&
          typeof applyTextColorWeighting === 'function'
        ) {
          try {
            // Text mentions already extracted in Step 3.5 for background protection
            console.log(
              '[Season Color Checker] Applying text-based weighting:',
              textColorMentions.map((m) => m.keyword).join(', '),
            );

            // Apply text-based weighting to palette
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
          } catch (textError) {
            console.log('[Season Color Checker] Text weighting failed:', textError.message);
            // Continue without text enhancement - not critical
            dominantColors = dominantColors.slice(0, 5);
          }
        } else {
          // Text enhancement disabled or no text mentions, just take top 5
          dominantColors = dominantColors.slice(0, 5);
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

      // Check if product colors match user's selected season
      const matchResult = colorProcessor.checkColorMatch(dominantColors, seasonPalette.colors);

      // Store match data on element
      img.dataset.seasonMatch = matchResult.matches ? 'true' : 'false';
      img.dataset.matchScore = matchResult.confidence.toFixed(0);

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

      // Apply visual filter based on match result
      applyFilter(img, matchResult);

      // Update stats
      if (matchResult.matches) {
        stats.matchingImages++;
      }

      // After processing, check for hover pair siblings
      detectAndLinkHoverPair(img);
    } catch (error) {
      console.error('Error processing image:', error);
    }
  }

  /**
   * Detect if this image is part of a hover-swap pair
   * Links sibling images that toggle visibility (opacity/display) on hover
   */
  function detectAndLinkHoverPair(img) {
    // Skip if already linked
    if (img.dataset.hoverGroup) {
      return;
    }

    const parent = img.parentElement;
    if (!parent) return;

    // Find sibling images in the same parent
    const siblingImages = Array.from(parent.querySelectorAll('img')).filter((sibling) => {
      // Must be product images (not tiny swatches/icons)
      if (sibling.offsetWidth < 100 || sibling.offsetHeight < 100) return false;
      // Must have been processed by our extension
      if (!sibling.dataset.seasonMatch) return false;
      return true;
    });

    // Only handle pairs (2-4 images, typical for hover swaps)
    if (siblingImages.length < 2 || siblingImages.length > 4) {
      return;
    }

    // Check if this looks like a hover-swap pattern
    const hasVisibilityToggle = detectVisibilityTogglePattern(siblingImages);
    if (!hasVisibilityToggle) {
      return;
    }

    // Validate that siblings have similar color palettes (same product)
    const areSimilar = validateColorSimilarity(siblingImages);
    if (!areSimilar) {
      return;
    }

    // Link siblings together with shared group ID
    const groupId = `hover-group-${Date.now()}-${Math.random()}`;
    siblingImages.forEach((sibling) => {
      sibling.dataset.hoverGroup = groupId;
    });

    // Determine shared match decision from visible image
    const visibleImage = getVisibleImage(siblingImages);
    const sharedDecision = {
      matches: visibleImage.dataset.seasonMatch === 'true',
      matchScore: parseFloat(visibleImage.dataset.matchScore) || 0,
    };

    // Store shared decision on parent
    parent.dataset.hoverGroupMatch = JSON.stringify(sharedDecision);

    // Set up swatch update observer for hover changes
    setupHoverSwatchObserver(parent, siblingImages);
  }

  /**
   * Detect if siblings use visibility toggle pattern (opacity, display, etc.)
   */
  function detectVisibilityTogglePattern(images) {
    const styles = images.map((img) => window.getComputedStyle(img));

    // Pattern 1: Opacity-based toggle (one hidden, one visible)
    const opacities = styles.map((s) => parseFloat(s.opacity));
    const hasOpacityToggle = opacities.some((o) => o < 0.3) && opacities.some((o) => o > 0.7);

    // Pattern 2: Absolute positioning with z-index stacking
    const positions = styles.map((s) => s.position);
    const hasAbsoluteStacking = positions.every((p) => p === 'absolute');

    // Pattern 3: Parent has transition/animation classes (common hover pattern)
    const parent = images[0].parentElement;
    const parentClasses = parent.className.toLowerCase();
    const hasHoverClasses = /hover|transition|swap|alternate|fade/.test(parentClasses);

    return hasOpacityToggle || hasAbsoluteStacking || hasHoverClasses;
  }

  /**
   * Get the currently visible image from a group
   */
  function getVisibleImage(images) {
    // Find image with highest visibility (opacity, not display:none, etc.)
    return images.reduce((mostVisible, img) => {
      const style = window.getComputedStyle(img);
      const opacity = parseFloat(style.opacity) || 0;
      const display = style.display;
      const visibility = style.visibility;

      // Calculate visibility score
      let score = opacity;
      if (display === 'none') score = 0;
      if (visibility === 'hidden') score = 0;

      const currentStyle = window.getComputedStyle(mostVisible);
      const currentOpacity = parseFloat(currentStyle.opacity) || 0;
      let currentScore = currentOpacity;
      if (currentStyle.display === 'none') currentScore = 0;
      if (currentStyle.visibility === 'hidden') currentScore = 0;

      return score > currentScore ? img : mostVisible;
    });
  }

  /**
   * Validate that sibling images have similar color palettes
   */
  function validateColorSimilarity(images) {
    // Get dominant colors from each image
    const palettes = images
      .map((img) => {
        try {
          return JSON.parse(img.dataset.dominantColors || '[]');
        } catch {
          return [];
        }
      })
      .filter((p) => p.length > 0);

    if (palettes.length < 2) return false;

    // Compare first two palettes (sufficient for validation)
    const palette1 = palettes[0];
    const palette2 = palettes[1];

    // Check if at least 1 color from each palette is similar (Delta E < 20)
    let similarCount = 0;
    for (const color1 of palette1.slice(0, 3)) {
      for (const color2 of palette2.slice(0, 3)) {
        const deltaE = calculateColorDistance(color1, color2);
        if (deltaE < 20) {
          similarCount++;
          break;
        }
      }
    }

    // Require at least 1 similar color (same garment, different angles/lighting)
    return similarCount >= 1;
  }

  /**
   * Calculate color distance between two hex colors using simple RGB distance
   */
  function calculateColorDistance(hex1, hex2) {
    const rgb1 = hexToRgb(hex1);
    const rgb2 = hexToRgb(hex2);

    if (!rgb1 || !rgb2) return 100; // Max distance if invalid

    // Simple Euclidean distance (good enough for validation)
    const rDiff = rgb1.r - rgb2.r;
    const gDiff = rgb1.g - rgb2.g;
    const bDiff = rgb1.b - rgb2.b;

    return Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff) / 4.41; // Normalize to 0-100
  }

  /**
   * Convert hex color to RGB
   */
  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
  }

  /**
   * Set up observer to update swatches and badges when hover changes visibility
   */
  function setupHoverSwatchObserver(parent, images) {
    // Observe style/class changes that might indicate hover state change
    const observer = new MutationObserver(() => {
      const visibleImage = getVisibleImage(images);

      // Update which image shows the color swatches and badge
      images.forEach((img) => {
        const swatchContainer = img.querySelector('.color-palette-swatch-container');
        if (swatchContainer) {
          // Show swatches only on the visible image
          swatchContainer.style.display = img === visibleImage ? 'flex' : 'none';
        }

        // Get the container for badge placement
        const container = img.closest('.season-filter-container') || img.parentElement;
        const badge = container.querySelector('.season-badge');

        if (badge) {
          // Show badge only on visible image
          badge.style.display = img === visibleImage ? 'block' : 'none';
        }
      });
    });

    // Watch for class and style changes on parent and images
    observer.observe(parent, {
      attributes: true,
      attributeFilter: ['class', 'style'],
      subtree: true,
    });

    // Store observer so we can disconnect later if needed
    parent._hoverSwatchObserver = observer;
  }

  /**
   * Apply simplified visual filter for swatch-only mode
   * Used when skipping ColorThief and relying solely on website swatch
   */
  function applySwatchOnlyFilter(img, matchResult, swatchColor) {
    // Don't apply filters to small images (icons, thumbnails)
    if (img.offsetWidth < 100 || img.offsetHeight < 100) {
      return;
    }

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
      // img.classList.add('season-match');
      // container.classList.remove('season-dimmed');
    } else {
      // Dim non-matches
      img.classList.add('season-no-match');
      // container.classList.add('season-dimmed');
    }

    // Add single color swatch display
    addColorPaletteSwatch(container, img);
  }

  /**
   * Apply visual filter to image
   */
  function applyFilter(img, matchResult) {
    // Don't apply filters to small images (icons, thumbnails)
    if (img.offsetWidth < 100 || img.offsetHeight < 100) {
      return;
    }

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

    if (matchResult.matches) {
      // Green border for matches
      // img.classList.add('season-match');
      // container.classList.remove('season-dimmed');
    } else {
      // Dim non-matches
      img.classList.add('season-no-match');
      // container.classList.add('season-dimmed');
    }

    // Add color palette debug display
    addColorPaletteSwatch(container, img);

    // Add match badge
    addMatchBadge(container, img, matchResult);

    // Add hover tooltip
    addTooltip(img, matchResult);
  }

  /**
   * Add color palette debug display showing dominant colors from ColorThief
   */
  function addColorPaletteSwatch(container, img) {
    // Don't add swatches to small images (icons, thumbnails)
    if (img.offsetWidth < 100 || img.offsetHeight < 100) {
      console.log(
        `[Season Color Checker] 🎨 Swatch skipped: image too small (${img.offsetWidth}x${img.offsetHeight}px)`,
      );
      return;
    }

    // Remove existing palette display
    const existingPalette = container.querySelector('.color-palette-swatch-container');
    if (existingPalette) {
      existingPalette.remove();
    }

    // Get dominant colors from the image dataset
    const dominantColorsJson = img.dataset.dominantColors;
    if (!dominantColorsJson) {
      console.log('[Season Color Checker] 🎨 Swatch skipped: no color data in dataset');
      return; // No color data available
    }

    try {
      const dominantColors = JSON.parse(dominantColorsJson);
      console.log(
        `[Season Color Checker] 🎨 Creating swatches for ${dominantColors.length} colors:`,
        dominantColors,
      );

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

      // Add to container
      container.appendChild(paletteContainer);
      console.log(
        `[Season Color Checker] ✅ Swatches added to image (visible: ${document.body.classList.contains(
          'show-swatches',
        )})`,
      );
    } catch (error) {
      console.error('[Season Color Checker] ❌ Error creating color palette swatch:', error);
    }
  }

  /**
   * Add match badge overlay
   */
  function addMatchBadge(container, img, matchResult) {
    // Don't add badges to small images (icons, thumbnails)
    if (img.offsetWidth < 100 || img.offsetHeight < 100) {
      return;
    }

    // Check if image is part of a hover group
    const parent = img.parentElement;
    let effectiveMatchResult = matchResult;

    if (parent && parent.dataset.hoverGroupMatch) {
      // Use shared decision from hover group
      try {
        const sharedDecision = JSON.parse(parent.dataset.hoverGroupMatch);
        effectiveMatchResult = {
          matches: sharedDecision.matches,
          confidence: sharedDecision.matchScore,
        };
      } catch (e) {
        // Fall back to individual result if parsing fails
        console.error('Error parsing hover group match:', e);
      }
    }

    // Check if image is currently hidden (don't show badge on hidden hover images)
    const style = window.getComputedStyle(img);
    const isHidden =
      parseFloat(style.opacity) < 0.3 || style.display === 'none' || style.visibility === 'hidden';

    if (isHidden && img.dataset.hoverGroup) {
      // Skip badge for hidden images in hover groups
      // The visible sibling will show the badge
      return;
    }

    // Only show badge for matches
    if (!effectiveMatchResult.matches) {
      return;
    }

    // Remove existing badge
    const existingBadge = container.querySelector('.season-badge');
    if (existingBadge) {
      existingBadge.remove();
    }

    const badge = document.createElement('div');
    badge.className = 'season-badge';

    // Show blob icon for matches only
    const icon = document.createElement('img');
    icon.src = chrome.runtime.getURL('icons/blob.png');
    icon.style.width = '100%';
    icon.style.height = '100%';
    icon.style.objectFit = 'contain';
    badge.appendChild(icon);
    badge.classList.add('match');

    container.appendChild(badge);
  }

  /**
   * Add hover tooltip showing match details
   */
  function addTooltip(img, matchResult) {
    const seasonName = SEASONAL_PALETTES[settings.selectedSeason]?.name || settings.selectedSeason;
    let tooltip = '';

    if (matchResult.matches) {
      tooltip = `✓ Matches your ${seasonName} palette\n`;
      tooltip += `Confidence: ${matchResult.confidence.toFixed(0)}%`;
    } else {
      tooltip = `✗ Doesn't match your ${seasonName} palette\n`;
      tooltip += `Confidence: ${matchResult.confidence.toFixed(0)}%`;
    }

    img.title = tooltip;
  }

  /**
   * Observe DOM for new images (lazy loading, infinite scroll)
   */
  function observeNewImages() {
    const observer = new MutationObserver((mutations) => {
      // Check if any mutation actually added new images
      const hasNewImages = mutations.some((mutation) => {
        // Check added nodes for images
        return Array.from(mutation.addedNodes).some((node) => {
          // Skip text nodes and other non-element nodes
          if (node.nodeType !== 1) return false;

          // Check if the node itself is an image
          if (node.tagName === 'IMG') return true;

          // Check if the node contains images
          return node.querySelector && node.querySelector('img') !== null;
        });
      });

      // Only process if images were actually added
      if (!hasNewImages) return;

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

    // document.querySelectorAll('.season-dimmed').forEach((container) => {
    //   container.classList.remove('season-dimmed');
    // });

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

    // Check page type - only process swatches on detail pages
    const images = findProductImages();
    const pageType = detectPageType(images);

    if (pageType === 'listing') {
      console.log(
        '[Season Color Checker] Skipping swatch detection on listing page (' +
          images.length +
          ' images)',
      );
      return;
    }

    console.log(
      '[Season Color Checker] Detail page detected (' +
        images.length +
        ' images), processing swatches',
    );

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

      // Store swatch data in internal WeakMap (not on DOM)
      swatchAnalysisData.set(swatch, {
        color: hex,
        match: result.isMatch,
        deltaE: result.deltaE.toFixed(1),
        timestamp: Date.now(),
      });

      // Update stats
      if (result.isMatch) {
        stats.matchingSwatches++;
      }

      // Skip visual styling - we don't want to modify website swatches
      // applySwatchStyle(swatch, result);
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
   * Apply visual styling to swatch (DISABLED - no longer modifying website swatches)
   *
   * Previously this function added CSS classes and tooltips to website swatch elements.
   * We now store swatch analysis data internally in swatchAnalysisData WeakMap instead.
   */
  function applySwatchStyle(swatch, result) {
    // NO-OP: We no longer modify website swatch elements visually
    // All swatch data is stored in swatchAnalysisData WeakMap
    return;
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
