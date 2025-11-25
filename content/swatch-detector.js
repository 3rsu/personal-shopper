/**
 * SWATCH DETECTOR MODULE
 *
 * Robust e-commerce swatch detection with structured JSON output.
 * Finds all potential swatches on a page and identifies which one is selected.
 *
 * Features:
 * - Multi-method swatch discovery (visual, semantic, spatial)
 * - Selected swatch identification (6-tier strategy)
 * - Comprehensive metadata extraction (color, label, image, pattern)
 * - Edge case handling (CORS, text-only, patterns, disabled states)
 * - Structured JSON output with confidence scoring
 */

(function () {
  'use strict';

  /**
   * Main API: Get all swatches as structured JSON
   * @param {HTMLElement} containerElement - Container to search (default: document.body)
   * @param {Object} options - Configuration options
   * @returns {Object} - JSON with swatches array, selectedIndex, totalCount, errors
   */
  function getSwatchesAsJSON(containerElement = document.body, options = {}) {
    const defaults = {
      includeDisabled: false, // Include sold-out/disabled swatches
      includePatterns: true, // Include pattern/texture swatches
      minConfidence: 0.3, // Minimum confidence threshold
      maxSwatches: 50, // Safety limit
      productImage: null, // Product image for visual matching
    };

    const config = { ...defaults, ...options };
    const errors = [];
    const result = {
      swatches: [],
      selectedIndex: -1,
      totalCount: 0,
      errors: [],
    };

    try {
      // Step 1: Discover all potential swatches in container
      const swatchElements = discoverAllSwatches(containerElement, config);

      if (swatchElements.length === 0) {
        errors.push({
          type: 'NO_SWATCHES_FOUND',
          message: 'No color swatches detected on this page',
          containerSize: containerElement.children.length,
        });
        result.errors = errors;
        return result;
      }

      // Step 2: Extract metadata for each swatch
      swatchElements.forEach((element, index) => {
        try {
          const metadata = extractSwatchMetadata(element, index, config);

          // Filter by confidence
          if (metadata.confidence < config.minConfidence) {
            return; // Skip low-confidence swatches
          }

          // Filter disabled swatches if requested
          if (!config.includeDisabled && metadata.isDisabled) {
            return;
          }

          // Filter patterns if requested
          if (!config.includePatterns && metadata.isPattern) {
            return;
          }

          result.swatches.push(metadata);
        } catch (metadataError) {
          errors.push({
            type: 'METADATA_EXTRACTION_FAILED',
            message: metadataError.message,
            elementIndex: index,
          });
        }
      });

      result.totalCount = result.swatches.length;

      // Step 3: Identify which swatch is selected
      if (result.swatches.length > 0) {
        const selectedIndex = identifySelectedSwatch(
          result.swatches,
          config.productImage,
          containerElement,
        );
        result.selectedIndex = selectedIndex;

        // Mark selected swatch
        if (selectedIndex >= 0 && result.swatches[selectedIndex]) {
          result.swatches[selectedIndex].selected = true;
        }
      }

      result.errors = errors;
      return result;
    } catch (error) {
      errors.push({
        type: 'CRITICAL_ERROR',
        message: error.message,
        stack: error.stack,
      });
      result.errors = errors;
      return result;
    }
  }

  /**
   * Discover all potential swatch elements in a container
   * @param {HTMLElement} container - Container to search
   * @param {Object} config - Configuration
   * @returns {Array<HTMLElement>} - Array of swatch elements
   */
  function discoverAllSwatches(container, config) {
    const swatchSet = new Set(); // Avoid duplicates

    // Method 1: Semantic detection (data attributes, ARIA, classes)
    const semanticSelectors = [
      '[class*="swatch"]',
      '[class*="color-option"]',
      '[class*="color-selector"]',
      '[class*="colour"]',
      '[class*="variant"]',
      '[data-color]',
      '[data-swatch]',
      '[data-variant-color]',
      '[aria-label*="color" i]',
      '[aria-label*="colour" i]',
      '[title*="color" i]',
      '[title*="colour" i]',
    ];

    semanticSelectors.forEach((selector) => {
      try {
        const elements = container.querySelectorAll(selector);
        elements.forEach((el) => {
          if (isValidSwatchElement(el)) {
            swatchSet.add(el);
          }
        });
      } catch (e) {
        // Invalid selector, skip
      }
    });

    // Method 2: Visual detection (small colored blocks)
    const visualCandidates = container.querySelectorAll('div, span, button, li, a, img');
    visualCandidates.forEach((el) => {
      if (swatchSet.has(el)) return; // Already found

      const style = window.getComputedStyle(el);
      const width = el.offsetWidth;
      const height = el.offsetHeight;

      // Check size range (10-150px for swatches)
      if (width >= 10 && width <= 150 && height >= 10 && height <= 150) {
        // Check if it has a background color or image
        const bgColor = style.backgroundColor;
        const bgImage = style.backgroundImage;

        if (
          (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') ||
          (bgImage && bgImage !== 'none')
        ) {
          if (isValidSwatchElement(el)) {
            swatchSet.add(el);
          }
        }
      }
    });

    // Method 3: Spatial clustering (group nearby similar-sized elements)
    const clusteredSwatches = findSwatchesBySpatialClustering(container);
    clusteredSwatches.forEach((el) => swatchSet.add(el));

    // Convert Set to Array and limit to maxSwatches
    const swatches = Array.from(swatchSet).slice(0, config.maxSwatches);

    // Sort by DOM order (top to bottom, left to right)
    swatches.sort((a, b) => {
      const rectA = a.getBoundingClientRect();
      const rectB = b.getBoundingClientRect();

      // Sort by vertical position first
      if (Math.abs(rectA.top - rectB.top) > 5) {
        return rectA.top - rectB.top;
      }

      // Then by horizontal position
      return rectA.left - rectB.left;
    });

    return swatches;
  }

  /**
   * Check if element is a valid swatch candidate
   * @param {HTMLElement} element - Element to validate
   * @returns {boolean} - True if valid swatch
   */
  function isValidSwatchElement(element) {
    // Exclude extension's own elements
    if (
      element.classList.contains('season-badge') ||
      element.classList.contains('season-color-swatch') ||
      element.classList.contains('color-palette-swatch-container') ||
      element.classList.contains('season-filter-container') ||
      element.classList.contains('season-overlay') ||
      element.classList.contains('season-color-checker-cors-badge') ||
      element.closest('.season-badge') ||
      element.closest('.color-palette-swatch-container') ||
      element.closest('.season-filter-container') ||
      element.closest('.season-overlay')
    ) {
      return false;
    }

    // Must be visible
    if (element.offsetParent === null) return false;
    if (element.style.display === 'none' || element.style.visibility === 'hidden') return false;

    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') return false;

    // Check size constraints (10-150px range)
    const width = element.offsetWidth;
    const height = element.offsetHeight;
    if (width < 10 || height < 10) return false;
    if (width > 150 || height > 150) return false;

    return true;
  }

  /**
   * Find swatches by spatial clustering (nearby similar-sized elements)
   * @param {HTMLElement} container - Container to search
   * @returns {Array<HTMLElement>} - Clustered swatch elements
   */
  function findSwatchesBySpatialClustering(container) {
    const candidates = [];
    const allElements = container.querySelectorAll('*');

    // Find small elements (10-100px) with visual characteristics
    allElements.forEach((el) => {
      const width = el.offsetWidth;
      const height = el.offsetHeight;

      if (width >= 10 && width <= 100 && height >= 10 && height <= 100) {
        const style = window.getComputedStyle(el);
        const bgColor = style.backgroundColor;
        const bgImage = style.backgroundImage;

        if (
          (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') ||
          (bgImage && bgImage !== 'none') ||
          el.tagName === 'IMG'
        ) {
          candidates.push({
            element: el,
            rect: el.getBoundingClientRect(),
            width,
            height,
          });
        }
      }
    });

    // Find clusters (3+ elements in proximity with similar size)
    const clusters = [];
    const used = new Set();

    candidates.forEach((candidate) => {
      if (used.has(candidate.element)) return;

      const cluster = [candidate];
      const tolerance = 50; // pixels

      candidates.forEach((other) => {
        if (other === candidate || used.has(other.element)) return;

        // Check if similar size
        const sizeDiff = Math.abs(other.width - candidate.width) + Math.abs(other.height - candidate.height);
        if (sizeDiff > 20) return;

        // Check if nearby (vertical or horizontal alignment)
        const verticallyAligned =
          Math.abs(other.rect.top - candidate.rect.top) < tolerance;
        const horizontallyAligned =
          Math.abs(other.rect.left - candidate.rect.left) < tolerance;

        if (verticallyAligned || horizontallyAligned) {
          cluster.push(other);
          used.add(other.element);
        }
      });

      // If cluster has 3+ elements, consider them swatches
      if (cluster.length >= 3) {
        clusters.push(cluster);
        cluster.forEach((c) => used.add(c.element));
      }
    });

    // Return all clustered elements
    return clusters.flat().map((c) => c.element);
  }

  /**
   * Extract comprehensive metadata for a single swatch
   * @param {HTMLElement} element - Swatch element
   * @param {number} index - Index in swatch list
   * @param {Object} config - Configuration
   * @returns {Object} - Swatch metadata
   */
  function extractSwatchMetadata(element, index, config) {
    const metadata = {
      id: `swatch-${index}`,
      element: element,
      color: null,
      colorRgb: null,
      label: null,
      image: null,
      selected: false,
      confidence: 0,
      source: null,
      isPattern: false,
      isDisabled: false,
      attributes: {},
    };

    // Extract color (use existing swatch-priority.js function if available)
    const colorData = extractSwatchColor(element);
    if (colorData) {
      metadata.color = colorData.hex;
      metadata.colorRgb = colorData.rgb;
      metadata.confidence = colorData.confidence;
      metadata.source = colorData.source;
    }

    // Extract label (text, aria-label, title, data attributes)
    metadata.label = extractSwatchLabel(element);

    // If no color but has label, try color dictionary lookup
    if (!metadata.color && metadata.label) {
      const colorFromName = matchColorNameToHex(metadata.label);
      if (colorFromName) {
        metadata.color = colorFromName.hex;
        metadata.colorRgb = colorFromName.rgb;
        metadata.confidence = 0.7; // Text-based confidence
        metadata.source = 'text-label-dictionary';
      }
    }

    // Extract image URL (for image-based swatches)
    metadata.image = extractSwatchImage(element);

    // Detect if pattern/texture
    metadata.isPattern = detectPattern(element);

    // Detect if disabled/sold-out
    metadata.isDisabled = isSwatchDisabled(element);

    // Store raw attributes for debugging
    metadata.attributes = {
      'data-color': element.getAttribute('data-color'),
      'data-variant': element.getAttribute('data-variant'),
      'aria-label': element.getAttribute('aria-label'),
      'title': element.getAttribute('title'),
      'class': element.className,
    };

    return metadata;
  }

  /**
   * Extract swatch color using multi-method approach
   * (Leverages existing swatch-priority.js logic if available)
   * @param {HTMLElement} element - Swatch element
   * @returns {Object|null} - {hex, rgb, source, confidence}
   */
  function extractSwatchColor(element) {
    // Method 1: Inline background color (highest confidence)
    const inlineBg = element.style.backgroundColor;
    if (inlineBg && inlineBg !== 'transparent' && inlineBg !== 'rgba(0, 0, 0, 0)') {
      const hex = parseColorString(inlineBg);
      if (hex && !isNeutralColor(hex)) {
        return {
          hex: hex,
          rgb: hexToRgb(hex),
          source: 'inline-background',
          confidence: 0.95,
        };
      }
    }

    // Method 2: Computed background color
    const computedBg = window.getComputedStyle(element).backgroundColor;
    if (computedBg && computedBg !== 'transparent' && computedBg !== 'rgba(0, 0, 0, 0)') {
      const hex = parseColorString(computedBg);
      if (hex && !isNeutralColor(hex)) {
        return {
          hex: hex,
          rgb: hexToRgb(hex),
          source: 'computed-background',
          confidence: 0.85,
        };
      }
    }

    // Method 3: Child element with color (Shopify pattern)
    const colorChild = element.querySelector('[style*="background"]');
    if (colorChild) {
      const childBg = colorChild.style.backgroundColor;
      if (childBg && childBg !== 'transparent') {
        const hex = parseColorString(childBg);
        if (hex && !isNeutralColor(hex)) {
          return {
            hex: hex,
            rgb: hexToRgb(hex),
            source: 'child-element',
            confidence: 0.8,
          };
        }
      }
    }

    // Method 4: Data attributes (hex/rgb values)
    const dataColor = element.getAttribute('data-color') || element.getAttribute('data-variant-color');
    if (dataColor) {
      let hex = null;
      if (dataColor.startsWith('#')) {
        hex = dataColor;
      } else if (dataColor.startsWith('rgb')) {
        hex = parseColorString(dataColor);
      }

      if (hex && !isNeutralColor(hex)) {
        return {
          hex: hex,
          rgb: hexToRgb(hex),
          source: 'data-attribute',
          confidence: 0.8,
        };
      }
    }

    // Method 5: Border color (some sites use border)
    const borderColor = window.getComputedStyle(element).borderColor;
    if (borderColor && borderColor !== 'transparent' && borderColor !== 'rgba(0, 0, 0, 0)') {
      const hex = parseColorString(borderColor);
      if (hex && !isNeutralColor(hex)) {
        return {
          hex: hex,
          rgb: hexToRgb(hex),
          source: 'border-color',
          confidence: 0.6,
        };
      }
    }

    // Method 6: Image swatch (use ColorThief if available and not CORS-blocked)
    if (element.tagName === 'IMG' && element.complete && element.naturalWidth > 0) {
      try {
        // Check if we can access image data (CORS-safe)
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(element, 0, 0, 1, 1);
        ctx.getImageData(0, 0, 1, 1); // Will throw if CORS-blocked

        // CORS-safe, extract color with ColorThief
        if (typeof ColorThief !== 'undefined') {
          const colorThief = new ColorThief();
          const rgb = colorThief.getColor(element);
          if (rgb) {
            const hex = rgbToHex(rgb);
            if (!isNeutralColor(hex)) {
              return {
                hex: hex,
                rgb: rgb,
                source: 'image-colorthief',
                confidence: 0.75,
              };
            }
          }
        }
      } catch (e) {
        // CORS blocked or error, skip
      }
    }

    // Method 7: Background image (extract dominant color if possible)
    const bgImage = window.getComputedStyle(element).backgroundImage;
    if (bgImage && bgImage !== 'none' && bgImage.startsWith('url(')) {
      const imageUrl = bgImage.slice(5, -2); // Extract URL from url("...")
      return {
        hex: null,
        rgb: null,
        source: 'background-image',
        confidence: 0.4,
        image: imageUrl,
      };
    }

    // No color extracted
    return null;
  }

  /**
   * Extract swatch label (text, aria-label, title)
   * @param {HTMLElement} element - Swatch element
   * @returns {string|null} - Label text
   */
  function extractSwatchLabel(element) {
    // Priority 1: aria-label
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) {
      // Extract color name from label (e.g., "Select Navy Blue" -> "Navy Blue")
      const colorMatch = ariaLabel.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/);
      if (colorMatch) {
        return colorMatch[1];
      }
      return ariaLabel.trim();
    }

    // Priority 2: title attribute
    const title = element.getAttribute('title');
    if (title) {
      return title.trim();
    }

    // Priority 3: Direct text content
    const textContent = element.textContent?.trim();
    if (textContent && textContent.length < 50) {
      // Ignore long text (not a color label)
      return textContent;
    }

    // Priority 4: alt attribute (for img elements)
    if (element.tagName === 'IMG') {
      const alt = element.getAttribute('alt');
      if (alt) {
        return alt.trim();
      }
    }

    // Priority 5: data-color-name or data-variant-name
    const dataColorName = element.getAttribute('data-color-name') || element.getAttribute('data-variant-name');
    if (dataColorName) {
      return dataColorName.trim();
    }

    return null;
  }

  /**
   * Match color name to hex using fashion color dictionary
   * @param {string} colorName - Color name from label
   * @returns {Object|null} - {hex, rgb} or null
   */
  function matchColorNameToHex(colorName) {
    if (!colorName || typeof window.getColorHex !== 'function') {
      return null;
    }

    const hex = window.getColorHex(colorName);
    if (hex) {
      return {
        hex: hex,
        rgb: hexToRgb(hex),
      };
    }

    // Try extracting color words from label
    const colorNames = window.getAllColorNames ? window.getAllColorNames() : [];
    for (const knownColor of colorNames) {
      if (colorName.toLowerCase().includes(knownColor.toLowerCase())) {
        const matchedHex = window.getColorHex(knownColor);
        if (matchedHex) {
          return {
            hex: matchedHex,
            rgb: hexToRgb(matchedHex),
          };
        }
      }
    }

    return null;
  }

  /**
   * Extract image URL from swatch element
   * @param {HTMLElement} element - Swatch element
   * @returns {string|null} - Image URL
   */
  function extractSwatchImage(element) {
    // Check if element is an image
    if (element.tagName === 'IMG') {
      return element.src;
    }

    // Check for background image
    const bgImage = window.getComputedStyle(element).backgroundImage;
    if (bgImage && bgImage !== 'none' && bgImage.startsWith('url(')) {
      // Extract URL from url("...") or url(...)
      const match = bgImage.match(/url\(['"]?([^'"]+)['"]?\)/);
      if (match) {
        return match[1];
      }
    }

    // Check for child image
    const childImg = element.querySelector('img');
    if (childImg) {
      return childImg.src;
    }

    return null;
  }

  /**
   * Detect if swatch represents a pattern/texture
   * @param {HTMLElement} element - Swatch element
   * @returns {boolean} - True if pattern detected
   */
  function detectPattern(element) {
    const bgImage = window.getComputedStyle(element).backgroundImage;

    // Pattern indicators:
    // 1. Background image (not solid color)
    if (bgImage && bgImage !== 'none') {
      // Check if it's a pattern image (contains keywords)
      const patternKeywords = ['stripe', 'polka', 'dot', 'floral', 'checkered', 'plaid', 'pattern'];
      const imageUrl = bgImage.toLowerCase();

      for (const keyword of patternKeywords) {
        if (imageUrl.includes(keyword)) {
          return true;
        }
      }

      // If image but no color extracted, likely a pattern
      return true;
    }

    // 2. Check aria-label/title for pattern keywords
    const label = extractSwatchLabel(element);
    if (label) {
      const patternKeywords = ['stripe', 'polka', 'dot', 'floral', 'checkered', 'plaid', 'pattern', 'print'];
      const lowerLabel = label.toLowerCase();

      for (const keyword of patternKeywords) {
        if (lowerLabel.includes(keyword)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if swatch is disabled/sold-out
   * @param {HTMLElement} element - Swatch element
   * @returns {boolean} - True if disabled
   */
  function isSwatchDisabled(element) {
    // Check disabled attribute
    if (element.hasAttribute('disabled')) {
      return true;
    }

    // Check aria-disabled
    if (element.getAttribute('aria-disabled') === 'true') {
      return true;
    }

    // Check common disabled classes
    const className = element.className.toLowerCase();
    if (
      className.includes('disabled') ||
      className.includes('sold-out') ||
      className.includes('unavailable') ||
      className.includes('out-of-stock')
    ) {
      return true;
    }

    // Check opacity (common pattern for disabled swatches)
    const opacity = parseFloat(window.getComputedStyle(element).opacity);
    if (opacity < 0.5) {
      return true;
    }

    // Check if parent has disabled class
    const parent = element.parentElement;
    if (parent) {
      const parentClass = parent.className.toLowerCase();
      if (
        parentClass.includes('disabled') ||
        parentClass.includes('sold-out') ||
        parentClass.includes('unavailable')
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Identify which swatch is currently selected
   * Uses existing 6-tier strategy from swatch-priority.js
   * @param {Array} swatches - Array of swatch metadata objects
   * @param {HTMLImageElement} productImage - Optional product image for visual matching
   * @param {HTMLElement} container - Container element
   * @returns {number} - Index of selected swatch, or -1 if none
   */
  function identifySelectedSwatch(swatches, productImage, container) {
    if (swatches.length === 0) return -1;

    // Tier 1: Check for radio input selection (highest confidence)
    for (let i = 0; i < swatches.length; i++) {
      const element = swatches[i].element;

      // Check if element is or contains a checked radio input
      if (element.tagName === 'INPUT' && element.type === 'radio' && element.checked) {
        return i;
      }

      const radio = element.querySelector('input[type="radio"]');
      if (radio && radio.checked) {
        return i;
      }

      // Check if associated with a radio via label
      if (element.tagName === 'LABEL') {
        const forAttr = element.getAttribute('for');
        if (forAttr) {
          const associatedRadio = document.getElementById(forAttr);
          if (associatedRadio && associatedRadio.type === 'radio' && associatedRadio.checked) {
            return i;
          }
        }
      }
    }

    // Tier 2: CSS classes (active, selected, current, checked)
    const selectedClasses = ['active', 'selected', 'current', 'checked', 'is-selected', 'is-active'];
    for (let i = 0; i < swatches.length; i++) {
      const element = swatches[i].element;
      const className = element.className.toLowerCase();

      for (const selectedClass of selectedClasses) {
        if (className.includes(selectedClass)) {
          return i;
        }
      }
    }

    // Tier 3: ARIA attributes
    for (let i = 0; i < swatches.length; i++) {
      const element = swatches[i].element;

      if (
        element.getAttribute('aria-selected') === 'true' ||
        element.getAttribute('aria-checked') === 'true' ||
        element.getAttribute('aria-current') === 'true'
      ) {
        return i;
      }
    }

    // Tier 4: Data attributes
    for (let i = 0; i < swatches.length; i++) {
      const element = swatches[i].element;

      if (
        element.getAttribute('data-selected') === 'true' ||
        element.getAttribute('data-active') === 'true' ||
        element.getAttribute('data-checked') === 'true'
      ) {
        return i;
      }
    }

    // Tier 5: Visual styling differences (border, outline, shadow, transform)
    const visuallySelectedIndex = findVisuallySelectedSwatch(swatches);
    if (visuallySelectedIndex !== -1) {
      return visuallySelectedIndex;
    }

    // Tier 6: Visual similarity to product image (if provided)
    if (productImage && typeof ColorProcessor !== 'undefined') {
      const similarityIndex = findSwatchByImageSimilarity(swatches, productImage);
      if (similarityIndex !== -1) {
        return similarityIndex;
      }
    }

    // Fallback: First swatch (common default on product pages)
    return 0;
  }

  /**
   * Find visually selected swatch based on styling
   * @param {Array} swatches - Swatch metadata array
   * @returns {number} - Index or -1
   */
  function findVisuallySelectedSwatch(swatches) {
    let maxVisualScore = 0;
    let selectedIndex = -1;

    swatches.forEach((swatch, index) => {
      const element = swatch.element;
      const style = window.getComputedStyle(element);
      let visualScore = 0;

      // Check for thicker border (common selection indicator)
      const borderWidth = parseFloat(style.borderWidth);
      if (borderWidth >= 2) {
        visualScore += 2;
      }

      // Check for outline
      if (style.outline !== 'none' && style.outlineWidth !== '0px') {
        visualScore += 2;
      }

      // Check for box shadow (common on selected items)
      if (style.boxShadow !== 'none') {
        visualScore += 1;
      }

      // Check for transform scale (some sites scale up selected swatch)
      const transform = style.transform;
      if (transform && transform !== 'none' && transform.includes('scale')) {
        visualScore += 1;
      }

      // Check for z-index (selected items often have higher z-index)
      const zIndex = parseInt(style.zIndex);
      if (!isNaN(zIndex) && zIndex > 0) {
        visualScore += 1;
      }

      if (visualScore > maxVisualScore) {
        maxVisualScore = visualScore;
        selectedIndex = index;
      }
    });

    // Only return if score is significant (3+)
    return maxVisualScore >= 3 ? selectedIndex : -1;
  }

  /**
   * Find swatch by visual similarity to product image
   * @param {Array} swatches - Swatch metadata array
   * @param {HTMLImageElement} productImage - Product image
   * @returns {number} - Index or -1
   */
  function findSwatchByImageSimilarity(swatches, productImage) {
    // This would require ColorThief to extract dominant color from product image
    // Then compare to swatch colors
    // For now, return -1 (not implemented)
    return -1;
  }

  // ==================== UTILITY FUNCTIONS ====================

  /**
   * Parse RGB/RGBA color string to hex
   * @param {string} colorString - RGB/RGBA string
   * @returns {string|null} - Hex color
   */
  function parseColorString(colorString) {
    if (!colorString) return null;

    // If already hex, return it
    if (colorString.startsWith('#')) {
      return colorString.toUpperCase();
    }

    // Parse rgb(r, g, b) or rgba(r, g, b, a)
    const match = colorString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!match) return null;

    const r = parseInt(match[1]);
    const g = parseInt(match[2]);
    const b = parseInt(match[3]);

    return rgbToHex([r, g, b]);
  }

  /**
   * Convert RGB array to hex string
   * @param {Array<number>} rgb - RGB array [r, g, b]
   * @returns {string} - Hex color
   */
  function rgbToHex(rgb) {
    const toHex = (n) => {
      const hex = Math.max(0, Math.min(255, Math.round(n))).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };

    return `#${toHex(rgb[0])}${toHex(rgb[1])}${toHex(rgb[2])}`.toUpperCase();
  }

  /**
   * Convert hex string to RGB array
   * @param {string} hex - Hex color
   * @returns {Array<number>|null} - RGB array [r, g, b]
   */
  function hexToRgb(hex) {
    if (!hex) return null;

    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
      : null;
  }

  /**
   * Check if color is neutral (white, gray, black, transparent)
   * @param {string} hex - Hex color
   * @returns {boolean} - True if neutral
   */
  function isNeutralColor(hex) {
    if (!hex) return true;

    const rgb = hexToRgb(hex);
    if (!rgb) return true;

    const [r, g, b] = rgb;

    // Check if grayscale (R ≈ G ≈ B)
    const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(b - r));
    if (maxDiff < 15) {
      // Grayscale color
      // Reject if too white (> 240) or too black (< 30)
      const avg = (r + g + b) / 3;
      if (avg > 240 || avg < 30) {
        return true;
      }
    }

    return false;
  }

  // ==================== EXPORTS ====================

  // Expose public API to window for use by content script
  if (typeof window !== 'undefined') {
    window.getSwatchesAsJSON = getSwatchesAsJSON;
    window.discoverAllSwatches = discoverAllSwatches;
    window.extractSwatchMetadata = extractSwatchMetadata;
    window.identifySelectedSwatch = identifySelectedSwatch;
    window.extractSwatchColor = extractSwatchColor;
    window.extractSwatchLabel = extractSwatchLabel;
    window.matchColorNameToHex = matchColorNameToHex;
    window.detectPattern = detectPattern;
    window.isSwatchDisabled = isSwatchDisabled;
    window.isValidSwatchElement = isValidSwatchElement;
  }

  console.log('[Season Color Checker] Swatch Detector module loaded');
})();
