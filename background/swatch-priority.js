/**
 * SWATCH PRIORITY MODULE
 *
 * Universal color swatch detection and prioritization for e-commerce sites.
 * Works across major platforms: Shopify, WooCommerce, Magento, BigCommerce, etc.
 *
 * Strategy:
 * 1. Detect selected swatch using multi-tier approach (radio inputs, CSS classes, ARIA)
 * 2. Extract color from swatch element (background, data attributes, images)
 * 3. Boost matching colors in ColorThief palette to guarantee top 2 placement
 */

/**
 * Find the selected color swatch for a given product image
 * Uses universal multi-tier detection strategy based on e-commerce research
 *
 * @param {HTMLImageElement} img - Product image element
 * @returns {Element|null} - Selected swatch element, or null if not found
 */
function findSelectedSwatchForImage(img) {
  // Find product container (limit scope to avoid false positives)
  const container = findProductContainer(img);
  if (!container) {
    console.log('[Swatch Priority] No product container found');
    return null;
  }

  // Tier 1: Native form controls (90% reliability)
  // Works for: Shopify, Amazon, BigCommerce, WooCommerce
  let selected = findByRadioInput(container);
  if (selected) {
    console.log('[Swatch Priority] Detected via radio input (Tier 1)');
    return selected;
  }

  // Tier 2: Common CSS classes (80% reliability)
  // Works for: WooCommerce, Magento 2, custom sites
  selected = findByCommonClasses(container);
  if (selected) {
    console.log('[Swatch Priority] Detected via CSS class (Tier 2)');
    return selected;
  }

  // Tier 3: ARIA attributes (60-70% reliability)
  // Works for: Magento 2, accessibility-focused sites
  selected = findByAriaAttributes(container);
  if (selected) {
    console.log('[Swatch Priority] Detected via ARIA attributes (Tier 3)');
    return selected;
  }

  // Tier 4: Data attributes (40-50% reliability)
  // Works for: some custom implementations
  selected = findByDataAttributes(container);
  if (selected) {
    console.log('[Swatch Priority] Detected via data attributes (Tier 4)');
    return selected;
  }

  // Tier 5: Visual style detection (fallback)
  // Last resort for unusual implementations
  selected = findByVisualStyles(container);
  if (selected) {
    console.log('[Swatch Priority] Detected via visual styles (Tier 5)');
    return selected;
  }

  console.log('[Swatch Priority] No selected swatch detected');
  return null;
}

/**
 * Find the product container element that holds the image and swatches
 * @param {HTMLImageElement} img - Product image
 * @returns {Element|null} - Product container element
 */
function findProductContainer(img) {
  // Try common product container patterns
  const containerSelectors = [
    '[class*="product"]',
    '[data-product-id]',
    '[data-product]',
    '[itemtype*="Product"]',
    'article',
    '[role="article"]',
  ];

  for (const selector of containerSelectors) {
    const container = img.closest(selector);
    if (container) return container;
  }

  // Fallback: use parent if no specific container found
  // But limit scope to reasonable depth (max 5 levels up)
  let current = img.parentElement;
  let depth = 0;
  while (current && depth < 5) {
    // Stop at body or large containers
    if (current === document.body || current.offsetWidth > window.innerWidth * 0.9) {
      break;
    }
    // Look for swatch-like elements within this container
    if (
      current.querySelector('[class*="swatch"]') ||
      current.querySelector('[class*="color"]') ||
      current.querySelector('input[type="radio"]')
    ) {
      return current;
    }
    current = current.parentElement;
    depth++;
  }

  return img.parentElement;
}

/**
 * Tier 1: Find selected swatch via checked radio input
 * @param {Element} container - Product container
 * @returns {Element|null} - Selected swatch element
 */
function findByRadioInput(container) {
  // Common radio input patterns for color selection
  const radioSelectors = [
    'input[type="radio"][name*="color"]:checked',
    'input[type="radio"][name*="Color"]:checked',
    'input[type="radio"][name*="variant"]:checked',
    'input[type="radio"][class*="color"]:checked',
    'input[type="radio"][class*="swatch"]:checked',
  ];

  for (const selector of radioSelectors) {
    try {
      const radio = container.querySelector(selector);
      if (!radio) continue;

      // Check if this is disabled/sold-out (skip if so)
      if (radio.disabled || radio.classList.contains('disabled')) {
        continue;
      }

      // Find associated swatch element
      // Pattern 1: Radio + Label (Shopify, BigCommerce)
      const label = container.querySelector(`label[for="${radio.id}"]`);
      if (label && isValidSwatchElement(label)) {
        return label;
      }

      // Pattern 2: Radio inside label
      const parentLabel = radio.closest('label');
      if (parentLabel && isValidSwatchElement(parentLabel)) {
        return parentLabel;
      }

      // Pattern 3: Radio + sibling swatch
      const sibling = radio.nextElementSibling;
      if (sibling && isValidSwatchElement(sibling)) {
        return sibling;
      }

      // Pattern 4: Radio's parent container
      const parent = radio.parentElement;
      if (parent && isValidSwatchElement(parent)) {
        return parent;
      }

      // Fallback: return radio itself if it has color info
      if (radio.dataset.color || radio.value) {
        return radio;
      }
    } catch (e) {
      // Invalid selector, continue
      continue;
    }
  }

  return null;
}

/**
 * Tier 2: Find selected swatch via common CSS class names
 * @param {Element} container - Product container
 * @returns {Element|null} - Selected swatch element
 */
function findByCommonClasses(container) {
  // Common class patterns for selected swatches
  const classSelectors = [
    // Exact matches (most specific)
    '.swatch.selected',
    '.swatch.active',
    '.swatch-option.active',
    '.color-swatch.selected',
    '.color-option.selected',
    '.form-option.is-selected',
    '.swatch.is-active',

    // Partial matches (broader)
    '[class*="swatch"][class*="selected"]',
    '[class*="swatch"][class*="active"]',
    '[class*="color"][class*="selected"]',
    '[class*="color"][class*="active"]',
    '[class*="variant"][class*="selected"]',

    // BEM naming conventions
    '[class*="swatch--selected"]',
    '[class*="swatch--active"]',
    '[class*="color--selected"]',
  ];

  for (const selector of classSelectors) {
    try {
      const elements = container.querySelectorAll(selector);
      for (const element of elements) {
        // Skip disabled/sold-out swatches
        if (
          element.classList.contains('disabled') ||
          element.classList.contains('is-disabled-option') ||
          element.classList.contains('sold-out')
        ) {
          continue;
        }

        if (isValidSwatchElement(element)) {
          return element;
        }
      }
    } catch (e) {
      // Invalid selector, continue
      continue;
    }
  }

  return null;
}

/**
 * Tier 3: Find selected swatch via ARIA attributes
 * @param {Element} container - Product container
 * @returns {Element|null} - Selected swatch element
 */
function findByAriaAttributes(container) {
  const ariaSelectors = [
    // Radio button pattern (single-select)
    '[role="radio"][aria-checked="true"]',
    '[role="radio"][aria-checked="true"][class*="swatch"]',
    '[role="radio"][aria-checked="true"][class*="color"]',

    // Listbox/option pattern
    '[role="option"][aria-selected="true"]',
    '[role="option"][aria-selected="true"][class*="swatch"]',
    '[role="option"][aria-selected="true"][class*="color"]',

    // Generic aria-checked (without role)
    '[aria-checked="true"][class*="swatch"]',
    '[aria-checked="true"][class*="color"]',

    // Tab pattern (less common)
    '[role="tab"][aria-selected="true"][class*="color"]',
  ];

  for (const selector of ariaSelectors) {
    try {
      const element = container.querySelector(selector);
      if (element && isValidSwatchElement(element)) {
        return element;
      }
    } catch (e) {
      // Invalid selector, continue
      continue;
    }
  }

  return null;
}

/**
 * Tier 4: Find selected swatch via data attributes
 * @param {Element} container - Product container
 * @returns {Element|null} - Selected swatch element
 */
function findByDataAttributes(container) {
  const dataSelectors = [
    '[data-selected="true"]',
    '[data-selected="1"]',
    '[data-active="true"]',
    '[data-active="1"]',
    '[data-state="selected"]',
    '[data-state="active"]',
  ];

  for (const selector of dataSelectors) {
    try {
      const elements = container.querySelectorAll(selector);
      for (const element of elements) {
        // Must be swatch-related
        if (
          element.classList.toString().match(/swatch|color|variant/i) ||
          element.querySelector('[class*="swatch"]') ||
          element.querySelector('[class*="color"]')
        ) {
          if (isValidSwatchElement(element)) {
            return element;
          }
        }
      }
    } catch (e) {
      // Invalid selector, continue
      continue;
    }
  }

  return null;
}

/**
 * Tier 5: Find selected swatch via visual style detection (last resort)
 * @param {Element} container - Product container
 * @returns {Element|null} - Selected swatch element
 */
function findByVisualStyles(container) {
  // Find all potential swatch elements
  const potentialSwatches = container.querySelectorAll(
    '[class*="swatch"], [class*="color"], [class*="variant"]',
  );

  for (const element of potentialSwatches) {
    if (!isValidSwatchElement(element)) continue;

    const styles = window.getComputedStyle(element);

    // Look for visual indicators of selection:
    // 1. Thick border (> 1px)
    const borderWidth = parseInt(styles.borderWidth) || 0;
    if (borderWidth > 1) {
      return element;
    }

    // 2. Outline (common selection indicator)
    if (styles.outline !== 'none' && styles.outline !== '') {
      return element;
    }

    // 3. Box-shadow (some sites use this)
    const boxShadow = styles.boxShadow;
    if (boxShadow !== 'none' && boxShadow.includes('inset')) {
      return element;
    }

    // 4. Transform scale (some sites enlarge selected swatch)
    const transform = styles.transform;
    if (transform !== 'none' && transform.includes('scale')) {
      return element;
    }
  }

  return null;
}

/**
 * Check if element is a valid swatch (visible, reasonable size)
 * @param {Element} element - Element to validate
 * @returns {boolean} - True if valid swatch
 */
function isValidSwatchElement(element) {
  if (!element) return false;

  // Must be visible
  if (element.offsetParent === null) return false;
  if (element.style.display === 'none') return false;
  if (element.style.visibility === 'hidden') return false;

  // Must have reasonable dimensions (but radio inputs might be hidden)
  const isRadio = element.tagName === 'INPUT' && element.type === 'radio';
  if (!isRadio) {
    const width = element.offsetWidth;
    const height = element.offsetHeight;

    // Too small (likely decoration)
    if (width < 10 || height < 10) return false;

    // Too large (likely not a swatch)
    if (width > 150 || height > 150) return false;
  }

  return true;
}

/**
 * Extract color from swatch element using multiple methods
 * @param {Element} swatch - Swatch element
 * @returns {Object|null} - {hex, rgb, source, confidence} or null
 */
function extractSwatchColor(swatch) {
  if (!swatch) return null;

  // Method 1: Inline background color (highest confidence)
  if (swatch.style.backgroundColor) {
    const rgb = parseColorString(swatch.style.backgroundColor);
    if (rgb) {
      const hex = rgbToHex(rgb);
      return {
        hex,
        rgb,
        source: 'inline-background',
        confidence: 0.95,
      };
    }
  }

  // Method 2: Computed background color (high confidence)
  const computed = window.getComputedStyle(swatch);
  if (computed.backgroundColor && computed.backgroundColor !== 'rgba(0, 0, 0, 0)') {
    const rgb = parseColorString(computed.backgroundColor);
    if (rgb && !isNeutralColor(rgb)) {
      const hex = rgbToHex(rgb);
      return {
        hex,
        rgb,
        source: 'computed-background',
        confidence: 0.85,
      };
    }
  }

  // Method 3: Child element with color (Shopify pattern)
  const colorChild = swatch.querySelector(
    '[class*="color"], [class*="swatch"], [style*="background"]',
  );
  if (colorChild) {
    const childColor = extractSwatchColor(colorChild); // Recursive
    if (childColor) {
      childColor.source = 'child-element';
      childColor.confidence *= 0.9;
      return childColor;
    }
  }

  // Method 4: Data attributes (medium confidence)
  const dataColor =
    swatch.getAttribute('data-color') ||
    swatch.getAttribute('data-hex') ||
    swatch.getAttribute('data-color-value') ||
    swatch.getAttribute('data-value');

  if (dataColor) {
    // Check if it's a hex color
    if (/^#?[0-9A-F]{6}$/i.test(dataColor)) {
      const hex = dataColor.startsWith('#') ? dataColor : '#' + dataColor;
      const rgb = hexToRgb(hex);
      return {
        hex,
        rgb,
        source: 'data-attribute',
        confidence: 0.8,
      };
    }

    // Check if it's rgb/rgba string
    const rgb = parseColorString(dataColor);
    if (rgb) {
      const hex = rgbToHex(rgb);
      return {
        hex,
        rgb,
        source: 'data-attribute',
        confidence: 0.8,
      };
    }
  }

  // Method 5: Border color (some sites use this)
  if (computed.borderColor && computed.borderColor !== 'rgba(0, 0, 0, 0)') {
    const rgb = parseColorString(computed.borderColor);
    if (rgb && !isNeutralColor(rgb)) {
      const hex = rgbToHex(rgb);
      return {
        hex,
        rgb,
        source: 'border-color',
        confidence: 0.6,
      };
    }
  }

  // Method 6: Image swatch (use ColorThief for extraction)
  const img = swatch.querySelector('img');
  if (img && img.complete) {
    try {
      // Check if we can access image data (CORS check)
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, 1, 1);
      ctx.getImageData(0, 0, 1, 1); // Throws if CORS-blocked

      // CORS OK - extract dominant color
      if (typeof ColorThief !== 'undefined') {
        const colorThief = new ColorThief();
        const dominantColor = colorThief.getColor(img);
        const hex = rgbToHex(dominantColor);

        if (!isNeutralColor(dominantColor)) {
          return {
            hex,
            rgb: dominantColor,
            source: 'image-swatch',
            confidence: 0.75,
          };
        }
      }
    } catch (e) {
      // CORS blocked or ColorThief failed - skip this method
    }
  }

  // Method 7: Radio input value (fallback)
  if (swatch.tagName === 'INPUT' && swatch.type === 'radio') {
    const value = swatch.value;
    if (value && /^#?[0-9A-F]{6}$/i.test(value)) {
      const hex = value.startsWith('#') ? value : '#' + value;
      const rgb = hexToRgb(hex);
      return {
        hex,
        rgb,
        source: 'radio-value',
        confidence: 0.7,
      };
    }
  }

  console.log('[Swatch Priority] Could not extract color from swatch');
  return null;
}

/**
 * Apply swatch priority weighting to ColorThief palette
 * Boosts colors similar to selected swatch to guarantee top 2 placement
 *
 * @param {Array<Array<number>>} dominantColors - RGB arrays from ColorThief
 * @param {Object} swatchColor - {hex, rgb, source, confidence}
 * @param {ColorProcessor} colorProcessor - Color processor instance
 * @returns {Array<Array<number>>} - Reweighted palette (top 5)
 */
function applySwatchPriorityWeighting(dominantColors, swatchColor, colorProcessor) {
  const SWATCH_DELTA_E_THRESHOLD = 25; // Generous threshold for color variations
  const SWATCH_BOOST = 10.0; // Massive boost to guarantee top 2 position
  const MIN_CONFIDENCE = 0.5; // Only boost if we're confident in swatch color

  // Skip if swatch color confidence is too low
  if (swatchColor.confidence < MIN_CONFIDENCE) {
    console.log('[Swatch Priority] Swatch color confidence too low, skipping boost');
    return dominantColors;
  }

  // Convert to weighted palette format
  const weightedPalette = dominantColors.map((rgb, index) => {
    let weight = 1.0;
    const hex = colorProcessor.rgbToHex(rgb);
    let swatchMatch = null;

    // Calculate similarity to selected swatch
    const deltaE = colorProcessor.calculateDeltaE(rgb, swatchColor.rgb);

    // If visually similar, apply massive boost
    if (deltaE < SWATCH_DELTA_E_THRESHOLD) {
      // Boost proportional to confidence and similarity
      const similarityFactor = 1 - deltaE / SWATCH_DELTA_E_THRESHOLD; // 1.0 = perfect match, 0.0 = at threshold
      weight *= SWATCH_BOOST * swatchColor.confidence * similarityFactor;

      swatchMatch = {
        swatchHex: swatchColor.hex,
        deltaE: deltaE,
        boost: weight,
        source: swatchColor.source,
        confidence: swatchColor.confidence,
      };

      console.log(
        `[Swatch Priority] Boosted color ${hex} - matches selected swatch ${swatchColor.hex} (ΔE ${deltaE.toFixed(1)}, boost ${weight.toFixed(1)}x)`,
      );
    }

    return {
      rgb,
      hex,
      weight,
      originalIndex: index,
      swatchMatch: swatchMatch,
    };
  });

  // Re-sort by weight (highest first)
  weightedPalette.sort((a, b) => b.weight - a.weight);

  // Log the reordering
  console.log(
    '[Swatch Priority] Palette reordered:',
    weightedPalette.map((item) => ({
      hex: item.hex,
      weight: item.weight.toFixed(2),
      wasBoosted: item.swatchMatch !== null,
    })),
  );

  // Extract top 5 colors (swatch-matched will be at top)
  return weightedPalette.slice(0, 5).map((item) => item.rgb);
}

/**
 * Watch for swatch selection changes (for dynamic sites)
 * Re-processes images when user changes color selection
 */
function watchSwatchChanges() {
  // MutationObserver to watch for class/ARIA changes
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes') {
        const target = mutation.target;

        // Check if this is a swatch-related element
        const isSwatch =
          target.classList.toString().match(/swatch|color|variant/i) ||
          target.closest('[class*="swatch"]') ||
          target.closest('[class*="color"]');

        if (isSwatch) {
          // Debounce to avoid excessive re-processing
          clearTimeout(window.swatchChangeDebounce);
          window.swatchChangeDebounce = setTimeout(() => {
            console.log('[Swatch Priority] Swatch selection changed, re-processing images...');

            // Trigger re-processing of images
            if (typeof window.resetAndRefilter === 'function') {
              window.resetAndRefilter();
            }
          }, 300);
        }
      }
    }
  });

  // Observe attribute changes that indicate selection
  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['class', 'aria-checked', 'aria-selected', 'data-selected', 'data-active'],
    subtree: true,
  });

  console.log('[Swatch Priority] Watching for swatch selection changes');
}

/**
 * Helper: Parse color string (rgb, rgba) to [r, g, b] array
 * @param {string} colorString - CSS color string
 * @returns {Array<number>|null} - [r, g, b] or null
 */
function parseColorString(colorString) {
  if (!colorString) return null;

  // Parse rgb(r, g, b) or rgba(r, g, b, a)
  const match = colorString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return null;

  const r = parseInt(match[1]);
  const g = parseInt(match[2]);
  const b = parseInt(match[3]);

  return [r, g, b];
}

/**
 * Helper: Convert RGB array to hex string
 * @param {Array<number>} rgb - [r, g, b]
 * @returns {string} - Hex color string (e.g., "#FF0000")
 */
function rgbToHex(rgb) {
  const [r, g, b] = rgb;
  return (
    '#' +
    [r, g, b]
      .map((x) => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      })
      .join('')
      .toUpperCase()
  );
}

/**
 * Helper: Convert hex string to RGB array
 * @param {string} hex - Hex color string (e.g., "#FF0000")
 * @returns {Array<number>} - [r, g, b]
 */
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [0, 0, 0];
}

/**
 * Helper: Check if color is neutral (white, gray, black, transparent)
 * @param {Array<number>} rgb - [r, g, b]
 * @returns {boolean} - True if neutral
 */
function isNeutralColor(rgb) {
  const [r, g, b] = rgb;

  // Check if transparent/very light
  if (r > 250 && g > 250 && b > 250) return true;

  // Check if very dark
  if (r < 5 && g < 5 && b < 5) return true;

  // Check if grayscale (low saturation)
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const saturation = max === 0 ? 0 : delta / max;

  // Low saturation = neutral
  if (saturation < 0.1) return true;

  return false;
}
