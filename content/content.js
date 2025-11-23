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
    filterEnabled: true,
    minPrice: null,
    maxPrice: null,
    priceFilterEnabled: false
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

    if (request.action === 'priceFilterChanged') {
      settings.minPrice = request.minPrice;
      settings.maxPrice = request.maxPrice;
      settings.priceFilterEnabled = request.enabled;
      console.log('[Season Color Checker] Price filter updated:', settings.minPrice, '-', settings.maxPrice, 'enabled:', settings.priceFilterEnabled);
      resetAndRefilter();
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
   * Extract price from product element
   * Handles multiple formats: $49.99, €45,00, ¥5,000, sale prices
   */
  function extractPrice(productElement) {
    if (!productElement) return null;

    // Site-specific price selectors
    const priceSelectors = {
      // Amazon
      'amazon.com': [
        '.a-price .a-offscreen',
        '.a-price-whole',
        'span[data-a-color="price"]',
        '.a-price span:first-child'
      ],
      // Shopify stores
      'shopify': [
        '.price',
        '.product-price',
        '[data-price]',
        '.price-item--regular'
      ],
      // Generic
      'generic': [
        '[class*="price"]',
        '[id*="price"]',
        '[data-price]',
        'span:has-text("$")',
        'span:has-text("€")',
        'span:has-text("¥")'
      ]
    };

    // Determine which selectors to use
    const hostname = window.location.hostname;
    let selectors = priceSelectors.generic;

    if (hostname.includes('amazon')) {
      selectors = [...priceSelectors['amazon.com'], ...priceSelectors.generic];
    } else if (document.querySelector('[data-shopify]') || hostname.includes('myshopify')) {
      selectors = [...priceSelectors['shopify'], ...priceSelectors.generic];
    }

    // Try each selector
    for (const selector of selectors) {
      const priceElements = productElement.querySelectorAll(selector);

      for (const elem of priceElements) {
        const priceText = elem.textContent || elem.getAttribute('data-price') || elem.getAttribute('content');
        if (!priceText) continue;

        const price = parsePrice(priceText);
        if (price !== null && price > 0) {
          // Also extract currency if available
          const currency = extractCurrency(priceText);
          return { price, currency, rawText: priceText.trim() };
        }
      }
    }

    // Fallback: Search nearby text for price patterns
    const nearbyText = productElement.textContent || '';
    const price = parsePrice(nearbyText);
    if (price !== null && price > 0) {
      const currency = extractCurrency(nearbyText);
      return { price, currency, rawText: nearbyText.substring(0, 50) };
    }

    return null;
  }

  /**
   * Parse price from text string
   * Handles: $49.99, €45,00, ¥5,000, "Sale: $29.99 (was $49.99)"
   */
  function parsePrice(text) {
    if (!text) return null;

    // Remove common non-price text
    text = text.replace(/shipping|free|delivery|tax/gi, '');

    // Match common price patterns
    // Matches: $49.99, 49.99, €45,00, ¥5,000, 1,234.56
    const patterns = [
      /[$€£¥₹]\s*(\d{1,3}(?:[,\s]\d{3})*(?:\.\d{2})?)/,  // $1,234.56
      /(\d{1,3}(?:[,\s]\d{3})*(?:\.\d{2})?)\s*[$€£¥₹]/,  // 1,234.56$
      /(\d{1,3}(?:[,\s]\d{3})*(?:[.,]\d{2}))/             // 1,234.56 or 1.234,56
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        // Extract the numeric part
        let priceStr = match[1] || match[0];

        // Remove currency symbols
        priceStr = priceStr.replace(/[$€£¥₹]/g, '');

        // Handle different decimal separators
        // If there's a comma followed by exactly 2 digits at the end, it's a decimal separator
        if (/,\d{2}$/.test(priceStr)) {
          priceStr = priceStr.replace(/\./g, '').replace(',', '.');
        } else {
          // Remove thousand separators (commas and spaces)
          priceStr = priceStr.replace(/[,\s]/g, '');
        }

        const price = parseFloat(priceStr);
        if (!isNaN(price) && price > 0) {
          return price;
        }
      }
    }

    return null;
  }

  /**
   * Extract currency symbol from text
   */
  function extractCurrency(text) {
    if (!text) return '$';

    if (text.includes('$')) return '$';
    if (text.includes('€')) return '€';
    if (text.includes('£')) return '£';
    if (text.includes('¥')) return '¥';
    if (text.includes('₹')) return '₹';

    return '$'; // Default to USD
  }

  /**
   * Check if price is within range
   */
  function isPriceInRange(price) {
    if (!settings.priceFilterEnabled || price === null) {
      return true; // No price filter active or no price found
    }

    const { minPrice, maxPrice } = settings;

    // If no range set, show all
    if (minPrice === null && maxPrice === null) {
      return true;
    }

    // Check bounds
    if (minPrice !== null && price < minPrice) {
      return false;
    }
    if (maxPrice !== null && price > maxPrice) {
      return false;
    }

    return true;
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
      // Extract price from product container
      const productContainer = img.closest('[data-product]') ||
                              img.closest('.product') ||
                              img.closest('[class*="product"]') ||
                              img.parentElement?.parentElement ||
                              img.parentElement;

      const priceData = extractPrice(productContainer);
      const price = priceData?.price || null;
      const currency = priceData?.currency || '$';

      // Store price data on image
      if (price !== null) {
        img.dataset.price = price;
        img.dataset.currency = currency;
        img.dataset.priceRaw = priceData.rawText;
      }

      // Check if price is in range
      const priceMatch = isPriceInRange(price);

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
        console.warn('[Season Color Checker] Invalid season selected:', settings.selectedSeason, '- Please reselect your season from the popup');
        return;
      }

      // Check if colors match
      const matchResult = colorProcessor.checkColorMatch(
        dominantColors,
        seasonPalette.colors
      );

      // Combined filter decision: both color AND price must match (when filters are active)
      const colorMatch = matchResult.matches;
      const shouldShow = colorMatch && priceMatch;

      // Apply visual filter based on combined match
      applyFilter(img, matchResult, priceMatch, price, currency);

      // Update stats (only count if passes all active filters)
      if (shouldShow) {
        stats.matchingImages++;
      }

      // Store match data on element for later use
      img.dataset.seasonMatch = matchResult.matches ? 'true' : 'false';
      img.dataset.matchScore = matchResult.confidence.toFixed(0);
      img.dataset.priceMatch = priceMatch ? 'true' : 'false';
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
  function applyFilter(img, matchResult, priceMatch, price, currency) {
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

    // Determine if item should be shown (passes all active filters)
    const colorMatches = matchResult.matches;
    const shouldShow = colorMatches && priceMatch;

    if (shouldShow) {
      // Green border for matches
      img.classList.add('season-match');
      container.classList.remove('season-dimmed');
    } else {
      // Dim non-matches
      img.classList.add('season-no-match');
      container.classList.add('season-dimmed');
    }

    // Add match badge (color)
    addMatchBadge(container, matchResult);

    // Add price badge if price is available
    if (price !== null) {
      addPriceBadge(container, price, currency, priceMatch);
    }

    // Add hover tooltip
    addTooltip(img, matchResult, priceMatch, price, currency);
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
   * Add price badge overlay
   */
  function addPriceBadge(container, price, currency, priceMatch) {
    // Remove existing price badge
    const existingBadge = container.querySelector('.season-price-badge');
    if (existingBadge) {
      existingBadge.remove();
    }

    const badge = document.createElement('div');
    badge.className = 'season-price-badge';

    // Format price
    const formattedPrice = `${currency}${price.toFixed(2)}`;
    badge.textContent = formattedPrice;

    // Add class based on match status
    if (priceMatch) {
      badge.classList.add('price-match');
    } else {
      badge.classList.add('price-no-match');
    }

    container.appendChild(badge);
  }

  /**
   * Add hover tooltip showing match details
   */
  function addTooltip(img, matchResult, priceMatch, price, currency) {
    let tooltip = matchResult.matches
      ? `✓ Matches your ${settings.selectedSeason} palette (${matchResult.confidence.toFixed(0)}% match)`
      : `✗ Doesn't match your ${settings.selectedSeason} palette`;

    // Add price info if available
    if (price !== null) {
      const priceStr = `${currency}${price.toFixed(2)}`;
      const priceStatus = priceMatch ? '✓' : '✗';

      if (settings.priceFilterEnabled) {
        const rangeStr = settings.minPrice !== null && settings.maxPrice !== null
          ? `${currency}${settings.minPrice}-${currency}${settings.maxPrice}`
          : settings.minPrice !== null
          ? `≥ ${currency}${settings.minPrice}`
          : settings.maxPrice !== null
          ? `≤ ${currency}${settings.maxPrice}`
          : 'Any price';

        tooltip += `\n${priceStatus} Price: ${priceStr} (Range: ${rangeStr})`;
      } else {
        tooltip += `\nPrice: ${priceStr}`;
      }
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
      const price = img.dataset.price ? parseFloat(img.dataset.price) : null;
      const currency = img.dataset.currency || '$';

      chrome.runtime.sendMessage({
        action: 'addToWishlist',
        imageUrl: img.src,
        pageUrl: window.location.href,
        dominantColors: dominantColors,
        matchScore: matchScore,
        price: price,
        currency: currency
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
