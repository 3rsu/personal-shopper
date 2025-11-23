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
  let processedImages = new Set(); // Track which images we've analyzed
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
          console.log('[Season Color Checker] Starting filter with', settings.selectedSeason, 'palette');
          startFiltering();
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
      window.initializeOverlay(stats);
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
      if (!processedImages.has(img.src)) {
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

    // Site-specific selectors for major e-commerce platforms
    const siteSelectors = {
      // Amazon
      'amazon.com': '.s-image, .a-dynamic-image, img[data-a-image-name="productImage"]',
      // Shopify stores
      'shopify': '.product-card__image, .grid-product__image',
      // Generic
      'generic': 'img[alt*="product" i], img[class*="product" i]'
    };

    // Try site-specific selector first
    const hostname = window.location.hostname;
    let selector = siteSelectors.generic;

    if (hostname.includes('amazon')) {
      selector = siteSelectors['amazon.com'];
    } else if (document.querySelector('[data-shopify]') || hostname.includes('myshopify')) {
      selector = siteSelectors['shopify'];
    }

    // Try site-specific selector
    const siteSpecificImages = document.querySelectorAll(selector);
    if (siteSpecificImages.length > 0) {
      return Array.from(siteSpecificImages);
    }

    // Fallback: Generic detection based on image size and position
    allImages.forEach(img => {
      // Skip if too small (likely icon or thumbnail)
      if (img.naturalWidth < 100 || img.naturalHeight < 100) {
        return;
      }

      // Skip if not visible
      if (img.offsetParent === null) {
        return;
      }

      // Skip common UI elements
      const src = img.src.toLowerCase();
      const alt = (img.alt || '').toLowerCase();
      if (src.includes('logo') || src.includes('icon') ||
          alt.includes('logo') || alt.includes('icon')) {
        return;
      }

      productImages.push(img);
    });

    return productImages;
  }

  /**
   * Process a single image
   */
  async function processImage(img) {
    // Mark as processed
    processedImages.add(img.src);
    stats.totalImages++;

    try {
      // Wait for image to load
      if (!img.complete) {
        await new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      }

      // Extract dominant colors using Color Thief
      if (typeof ColorThief === 'undefined') {
        console.error('ColorThief not loaded');
        return;
      }

      const colorThief = new ColorThief();
      let dominantColors;

      try {
        // First, try to set crossOrigin attribute if not already set
        if (!img.crossOrigin) {
          img.crossOrigin = 'anonymous';
          // Wait a bit for the image to reload with CORS headers
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Get palette of 5 colors
        dominantColors = colorThief.getPalette(img, 5);
      } catch (e) {
        // CORS error - try creating a proxy image
        console.log('[Season Color Checker] CORS blocked, trying proxy for:', img.src.substring(0, 80));

        try {
          // Create a canvas and draw the image
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;

          // Create a new image with crossOrigin set
          const proxyImg = new Image();
          proxyImg.crossOrigin = 'anonymous';

          await new Promise((resolve, reject) => {
            proxyImg.onload = resolve;
            proxyImg.onerror = reject;
            proxyImg.src = img.src;
          });

          ctx.drawImage(proxyImg, 0, 0);

          // Try to get palette from canvas
          dominantColors = colorThief.getPalette(canvas, 5);
          console.log('[Season Color Checker] Proxy method succeeded');
        } catch (proxyError) {
          // Still failed - skip this image silently
          console.log('[Season Color Checker] Skipping CORS-blocked image');
          stats.totalImages--; // Don't count this image
          return;
        }
      }

      if (!dominantColors || dominantColors.length === 0) {
        console.log('[Season Color Checker] No colors extracted');
        return;
      }

      // Get current season's palette
      const seasonPalette = SEASONAL_PALETTES[settings.selectedSeason];
      if (!seasonPalette) {
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

    // Add container wrapper if needed
    let container = img.closest('.season-filter-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'season-filter-container';
      img.parentNode.insertBefore(container, img);
      container.appendChild(img);
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
    processedImages.clear();
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
