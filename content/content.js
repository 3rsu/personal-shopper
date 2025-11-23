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
  let processedImages = new WeakSet(); // Track actual image elements we've analyzed
  let stats = {
    totalImages: 0,
    matchingImages: 0
  };

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

    return true;
  }

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
      if (!canAccessImageData(img)) {
        console.log('[Season Color Checker] CORS blocked, skipping:', img.src.substring(0, 80));
        stats.totalImages--; // Don't count this image
        return;
      }

      const colorThief = new ColorThief();
      let dominantColors;

      try {
        // Safe to proceed - image is accessible
        dominantColors = colorThief.getPalette(img, 5);
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
    stats = { totalImages: 0, matchingImages: 0 };
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

      chrome.runtime.sendMessage({
        action: 'addToWishlist',
        imageUrl: img.src,
        pageUrl: window.location.href,
        dominantColors: dominantColors,
        matchScore: matchScore
      }, (response) => {
        if (response && response.success) {
          alert('Added to wishlist!');
        }
      });
    }
  }, true);

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

})();
