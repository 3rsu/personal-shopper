/**
 * CONTENT SCRIPT
 *
 * Runs on all web pages. Handles:
 * - Detecting product images on e-commerce sites
 * - Extracting dominant colors using Color Thief
 * - Filtering/highlighting items based on color match
 * - Lazy loading for performance
 */

(function() {
  'use strict';

  // State
  let settings = {
    selectedSeason: null,
    filterEnabled: true
  };

  let colorProcessor = null;
  let backgroundRemover = null;
  let processedImages = new WeakSet(); // Track actual image elements we've analyzed
  let processedSwatches = new WeakSet(); // Track analyzed swatch elements
  let stats = {
    totalImages: 0,
    matchingImages: 0,
    totalSwatches: 0,
    matchingSwatches: 0
  };

  // Inactivity timer for auto-detection
  let inactivityTimer = null;
  let inactivityDelay = 2500; // 2.5 seconds
  let hasShownSummary = false;

  /**
   * Initialize the extension
   */
  async function initialize() {
    console.log('[Season Color Checker] Initializing...');

    // Check dependencies
    console.log('[Season Color Checker] ColorThief available:', typeof ColorThief !== 'undefined');
    console.log('[Season Color Checker] SEASONAL_PALETTES available:', typeof SEASONAL_PALETTES !== 'undefined');
    console.log('[Season Color Checker] ColorProcessor available:', typeof ColorProcessor !== 'undefined');

    // Load color processor
    if (typeof ColorProcessor !== 'undefined') {
      colorProcessor = new ColorProcessor();
      console.log('[Season Color Checker] ColorProcessor initialized');
    } else {
      console.error('[Season Color Checker] ERROR: ColorProcessor not loaded! Check manifest.json');
      return;
    }

    // Load background remover
    if (typeof BackgroundRemover !== 'undefined') {
      backgroundRemover = new BackgroundRemover();
      console.log('[Season Color Checker] BackgroundRemover initialized');
    } else {
      console.warn('[Season Color Checker] WARNING: BackgroundRemover not loaded - will use images without background removal');
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
            console.log('[Season Color Checker] Starting filter with', settings.selectedSeason, 'palette');
            startFiltering();
          } else {
            console.error('[Season Color Checker] ⚠️ OLD SEASON DETECTED! Your selected season "' + settings.selectedSeason + '" is no longer valid.');
            console.error('[Season Color Checker] 🔄 The extension now uses 12 sub-seasons instead of 4 basic seasons.');
            console.error('[Season Color Checker] 📋 Please click the extension icon and select a new season from:');
            console.error('[Season Color Checker]    🌺 Bright Spring, 🌸 Warm Spring, 🌼 Light Spring');
            console.error('[Season Color Checker]    🌿 Soft Summer, 🌊 Cool Summer, ☁️ Light Summer');
            console.error('[Season Color Checker]    🍁 Deep Autumn, 🍂 Warm Autumn, 🌾 Soft Autumn');
            console.error('[Season Color Checker]    💎 Bright Winter, ❄️ Cool Winter, 🌑 Deep Winter');
          }
        } else if (!settings.selectedSeason) {
          console.warn('[Season Color Checker] No season selected. Click extension icon to choose your palette.');
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
  }

  /**
   * Find product images on the page
   */
  function findAndProcessImages() {
    const images = findProductImages();
    console.log('[Season Color Checker] Found', images.length, 'product images to analyze');

    images.forEach(img => {
      if (!processedImages.has(img)) {
        processImage(img);
      }
    });

    console.log('[Season Color Checker] Processing complete. Stats:', stats);
    updateOverlay();
  }

  /**
   * Detect product images (vs UI elements, logos, etc.)
   */
  function findProductImages() {
    const allImages = document.querySelectorAll('img');
    const productImages = [];

    // Apply smart filtering to all images on the page
    allImages.forEach(img => {
      // Skip common UI elements (logos, icons, social media buttons)
      const src = img.src.toLowerCase();
      const alt = (img.alt || '').toLowerCase();
      const className = (img.className || '').toLowerCase();

      // Skip logos and icons by src, alt, or class
      if (src.includes('logo') || src.includes('icon') || src.includes('sprite') ||
          alt.includes('logo') || alt.includes('icon') ||
          className.includes('logo') || className.includes('icon')) {
        return;
      }

      // Skip social media and UI elements
      if (src.includes('facebook') || src.includes('twitter') || src.includes('instagram') ||
          src.includes('pinterest') || src.includes('social') ||
          className.includes('social')) {
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
        domain: domain
      });
      preferredMethod = response?.preferredMethod;
    } catch (e) {
      // Continue without cache
    }

    // Tier 1: Try crossorigin="anonymous" (unless we know it won't work)
    if (preferredMethod !== 'fetch') {
      try {
        console.log('[Season Color Checker] Tier 1: Trying crossorigin="anonymous" for:', originalSrc.substring(0, 80));

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
        console.log('[Season Color Checker] Tier 2: Fetching via service worker:', originalSrc.substring(0, 80));

        const response = await chrome.runtime.sendMessage({
          action: 'fetchImage',
          url: originalSrc
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
    console.log('[Season Color Checker] ✗ All automatic methods failed for:', originalSrc.substring(0, 80));
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

      // Extract dominant colors using Color Thief
      if (typeof ColorThief === 'undefined') {
        console.error('ColorThief not loaded');
        return;
      }

      // Pre-check: Can we access this image's pixel data?
      let processableImage = img;
      if (!canAccessImageData(img)) {
        console.log('[Season Color Checker] CORS detected, trying fallback methods:', img.src.substring(0, 80));

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

      try {
        // Remove background before color extraction
        let imageToAnalyze = processableImage;

        if (backgroundRemover) {
          const cleanedCanvas = backgroundRemover.removeBackground(processableImage);
          if (cleanedCanvas) {
            console.log('[Season Color Checker] Background removed for color analysis');
            imageToAnalyze = cleanedCanvas;
          } else {
            console.log('[Season Color Checker] Background removal failed, using original image');
          }
        }

        // Extract colors from cleaned image (or original if background removal failed)
        dominantColors = colorThief.getPalette(imageToAnalyze, 5);
      } catch (e) {
        console.log('[Season Color Checker] Error extracting colors:', e.message);
        stats.totalImages--; // Don't count this image
        return;
      }

      if (!dominantColors || dominantColors.length === 0) {
        console.log('[Season Color Checker] No colors extracted');
        return;
      }

      // Get current season's palette
      const seasonPalette = SEASONAL_PALETTES[settings.selectedSeason];
      if (!seasonPalette) {
        console.warn('[Season Color Checker] Invalid season selected:', settings.selectedSeason, '- Please reselect your season from the popup');
        return;
      }

      // Check if colors match
      const matchResult = colorProcessor.checkColorMatch(
        dominantColors,
        seasonPalette.colors
      );

      // Apply visual filter based on match
      applyFilter(img, matchResult);

      // Update stats
      if (matchResult.matches) {
        stats.matchingImages++;
      }

      // Store match data on element for later use
      img.dataset.seasonMatch = matchResult.matches ? 'true' : 'false';
      img.dataset.matchScore = matchResult.confidence.toFixed(0);
      img.dataset.dominantColors = JSON.stringify(
        dominantColors.slice(0, 3).map(rgb => colorProcessor.rgbToHex(rgb))
      );

    } catch (error) {
      console.error('Error processing image:', error);
    }
  }

  /**
   * Apply visual filter to image
   */
  function applyFilter(img, matchResult) {
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
      img.classList.add('season-match');
      container.classList.remove('season-dimmed');
    } else {
      // Dim non-matches
      img.classList.add('season-no-match');
      container.classList.add('season-dimmed');
    }

    // Add match badge
    addMatchBadge(container, matchResult);

    // Add hover tooltip
    addTooltip(img, matchResult);
  }

  /**
   * Add match badge overlay
   */
  function addMatchBadge(container, matchResult) {
    // Remove existing badge
    const existingBadge = container.querySelector('.season-badge');
    if (existingBadge) {
      existingBadge.remove();
    }

    const badge = document.createElement('div');
    badge.className = 'season-badge';

    if (matchResult.matches) {
      badge.innerHTML = '✓';
      badge.classList.add('match');
    } else {
      badge.innerHTML = '✗';
      badge.classList.add('no-match');
    }

    container.appendChild(badge);
  }

  /**
   * Add hover tooltip showing match details
   */
  function addTooltip(img, matchResult) {
    img.title = matchResult.matches
      ? `✓ Matches your ${settings.selectedSeason} palette (${matchResult.confidence.toFixed(0)}% match)`
      : `✗ Doesn't match your ${settings.selectedSeason} palette`;
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
      subtree: true
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
    document.querySelectorAll('.season-match, .season-no-match').forEach(img => {
      img.classList.remove('season-match', 'season-no-match');
      img.title = '';
    });

    document.querySelectorAll('.season-dimmed').forEach(container => {
      container.classList.remove('season-dimmed');
    });

    document.querySelectorAll('.season-badge').forEach(badge => {
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
    swatches.forEach(swatch => {
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
      '[aria-label*="colour"]'
    ];

    // Find elements matching common swatch patterns
    swatchSelectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
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
    allDivs.forEach(el => {
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
      const result = colorProcessor.findClosestColor([rgb], seasonPalette.colors);

      // Store swatch data
      swatch.dataset.swatchColor = hex;
      swatch.dataset.swatchMatch = result.matches ? 'true' : 'false';
      swatch.dataset.swatchDeltaE = result.distance.toFixed(1);

      // Update stats
      if (result.matches) {
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
    if (result.matches) {
      swatch.classList.add('season-swatch-match');
    } else {
      swatch.classList.add('season-swatch-no-match');
    }

    // Add tooltip
    const hex = swatch.dataset.swatchColor;
    const deltaE = swatch.dataset.swatchDeltaE;

    if (result.matches) {
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
  document.addEventListener('click', (e) => {
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
      chrome.runtime.sendMessage({
        action: 'fetchImage',
        url: imageUrl
      }, (fetchResponse) => {
        if (fetchResponse && fetchResponse.success) {
          // Now add to wishlist with data URL
          chrome.runtime.sendMessage({
            action: 'addToWishlist',
            imageUrl: fetchResponse.dataUrl,
            pageUrl: window.location.href,
            dominantColors: dominantColors,
            matchScore: matchScore
          }, (response) => {
            if (response && response.success) {
              alert('Added to wishlist!');
            }
          });
        } else {
          // Fallback to original URL if fetch fails
          chrome.runtime.sendMessage({
            action: 'addToWishlist',
            imageUrl: imageUrl,
            pageUrl: window.location.href,
            dominantColors: dominantColors,
            matchScore: matchScore
          }, (response) => {
            if (response && response.success) {
              alert('Added to wishlist!');
            }
          });
        }
      });
    }
  }, true);

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
    const dismissedDomains = JSON.parse(localStorage.getItem('seasonColorChecker_dismissedDomains') || '[]');
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
            season: settings.selectedSeason
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
        localStorage.setItem('seasonColorChecker_dismissedDomains', JSON.stringify(dismissedDomains));

        // Remove all badges on this domain
        document.querySelectorAll('.season-color-checker-cors-badge').forEach(b => b.remove());
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
    chrome.runtime.sendMessage({
      action: 'trackCorsEvent',
      domain: domain,
      eventType: eventType,
      method: method
    }).catch(() => {
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
