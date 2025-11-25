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
 * @param {string} pageType - 'detail' or 'listing' (optional)
 * @returns {Element|null} - Selected swatch element, or null if not found
 */
function findSelectedSwatchForImage(img, pageType) {
  // Find product container (limit scope to avoid false positives)
  const container = findProductContainer(img);
  if (!container) {
    console.log('[Swatch Priority] No product container found');
    return null;
  }

  console.log('[Swatch Priority] Container found, now searching for selected swatch...');
  console.log('[Swatch Priority] Container bounds:', container.getBoundingClientRect());

  // Tier 1: Native form controls (90% reliability)
  // Works for: Shopify, Amazon, BigCommerce, WooCommerce
  let selected = findByRadioInput(container, img);
  if (selected) {
    console.log('[Swatch Priority] ✓ Detected via radio input (Tier 1)');
    console.log('[Swatch Priority] Selected swatch:', selected, selected.getBoundingClientRect());
    return selected;
  }

  // Tier 2: Common CSS classes (80% reliability) - NOW WITH SPATIAL VALIDATION
  // Works for: WooCommerce, Magento 2, custom sites
  selected = findByCommonClasses(container, img);
  if (selected) {
    console.log('[Swatch Priority] ✓ Detected via CSS class (Tier 2)');
    console.log('[Swatch Priority] Selected swatch:', selected, selected.getBoundingClientRect());
    return selected;
  }

  // Tier 3: ARIA attributes (60-70% reliability)
  // Works for: Magento 2, accessibility-focused sites
  selected = findByAriaAttributes(container, img);
  if (selected) {
    console.log('[Swatch Priority] Detected via ARIA attributes (Tier 3)');
    return selected;
  }

  // Tier 4: Data attributes (40-50% reliability)
  // Works for: some custom implementations
  selected = findByDataAttributes(container, img);
  if (selected) {
    console.log('[Swatch Priority] Detected via data attributes (Tier 4)');
    return selected;
  }

  // Tier 5: Visual style detection (fallback)
  // Last resort for unusual implementations
  selected = findByVisualStyles(container, img);
  if (selected) {
    console.log('[Swatch Priority] Detected via visual styles (Tier 5)');
    return selected;
  }

  // Tier 6: First relative swatch (listing page fallback)
  // When no explicit selection found on listing pages, use first swatch
  if (pageType === 'listing') {
    selected = findFirstRelativeSwatch(container, img);
    if (selected) {
      console.log('[Swatch Priority] Using first relative swatch (Tier 6 - listing page fallback)');
      return selected;
    }
  }

  console.log('[Swatch Priority] No selected swatch detected');
  return null;
}

/**
 * Check if an element contains swatches
 * Looks for common swatch patterns: small elements with backgrounds, buttons, links, etc.
 * @param {Element} element - Element to check
 * @returns {boolean} - True if swatches found
 */
function checkForSwatches(element) {
  if (!element || !element.querySelectorAll) return false;

  // Try common swatch selectors
  const swatchSelectors = [
    // Common class-based patterns
    '[class*="swatch"]',
    '[class*="color-option"]',
    '[class*="variant-option"]',
    '[class*="color-selector"]',
    '[data-color]',

    // Data-testid patterns (Aritzia and modern sites)
    '[data-testid*="swatch"]',
    '[data-testid*="color"]',

    // Button/link patterns
    'button[class*="color"]',
    'a[class*="color"]',

    // Small elements with background colors (likely swatches)
    // We'll check these programmatically below
  ];

  // Check each selector
  for (const selector of swatchSelectors) {
    try {
      const found = element.querySelectorAll(selector);
      if (found.length > 0) {
        console.log('[Swatch Priority] Found', found.length, 'potential swatches with selector:', selector);
        return true;
      }
    } catch (e) {
      continue;
    }
  }

  // Check for small elements with background colors/images (generic swatch detection)
  const allElements = element.querySelectorAll('*');
  let smallColoredElements = 0;

  for (const el of allElements) {
    // Must be small (likely a swatch, not a product image)
    if (el.offsetWidth < 20 || el.offsetWidth > 100) continue;
    if (el.offsetHeight < 20 || el.offsetHeight > 100) continue;

    // Must have a background color or image
    const style = getComputedStyle(el);
    const hasBg = (style.backgroundColor && style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent') ||
                  (style.backgroundImage && style.backgroundImage !== 'none');

    if (hasBg) {
      smallColoredElements++;
      if (smallColoredElements >= 2) {
        console.log('[Swatch Priority] Found', smallColoredElements, 'small colored elements (likely swatches)');
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if element is a semantic product boundary (product tile, product card, etc.)
 * @param {Element} element - Element to check
 * @returns {boolean} - True if semantic product boundary
 */
function isSemanticProductBoundary(element) {
  if (!element) return false;

  // Check data attributes
  if (element.hasAttribute('data-testid')) {
    const testid = element.getAttribute('data-testid');
    if (testid.includes('product')) return true;
  }

  if (element.hasAttribute('data-product-id') || element.hasAttribute('data-product')) {
    return true;
  }

  // Check if it's an article element (common for product cards)
  if (element.matches('article')) {
    return true;
  }

  // Check class names for common patterns
  const className = element.className;
  if (typeof className === 'string') {
    const productPatterns = [
      /\bproduct-item\b/i,
      /\bproduct-tile\b/i,
      /\bproduct-card\b/i,
      /\bproduct-grid-item\b/i,
      /\bproductcard\b/i,
      /\bproducttile\b/i
    ];

    for (const pattern of productPatterns) {
      if (pattern.test(className)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Find the product container element that holds the image and swatches
 * TWO-PHASE: First look for semantic boundaries, then fallback to swatch detection
 * @param {HTMLImageElement} img - Product image
 * @returns {Element|null} - Product container element
 */
function findProductContainer(img) {
  console.log('[Swatch Priority] ======================================');
  console.log('[Swatch Priority] Finding product container for image:', img.src.substring(0, 80));

  let current = img.parentElement;
  let depth = 0;
  const maxDepth = 15;

  // PHASE 1: Look for semantic product boundaries FIRST
  console.log('[Swatch Priority] Phase 1: Checking for semantic product boundaries...');

  while (current && depth < maxDepth) {
    depth++;
    console.log(`[Swatch Priority] Checking level ${depth}:`, current.tagName, current.className?.substring(0, 50));

    // Check if this is a semantic product boundary
    const isSemantic = isSemanticProductBoundary(current);

    if (isSemantic) {
      console.log(`[Swatch Priority] Found semantic boundary at level ${depth}`);

      // Check if this boundary has swatches
      const hasSwatches = checkForSwatches(current);

      if (hasSwatches) {
        console.log(`[Swatch Priority] ✓ Semantic boundary HAS swatches - using as container:`, {
          tagName: current.tagName,
          className: current.className,
          width: current.offsetWidth
        });
        return current;
      } else {
        console.log(`[Swatch Priority] Semantic boundary has NO swatches - continuing search...`);
        // Continue walking up to find parent with swatches
      }
    }

    current = current.parentElement;
  }

  // PHASE 2: Fallback - find first parent with swatches (no semantic boundary found)
  console.log('[Swatch Priority] Phase 2: No semantic boundary found, searching for swatches...');
  current = img.parentElement;
  depth = 0;

  while (current && depth < maxDepth) {
    depth++;
    const hasSwatches = checkForSwatches(current);

    if (hasSwatches) {
      console.log(`[Swatch Priority] ✓ Found swatches at level ${depth} (fallback mode):`, {
        tagName: current.tagName,
        className: current.className
      });
      return current;
    }

    current = current.parentElement;
  }

  console.log('[Swatch Priority] ✗ No container found after checking', depth, 'levels');
  // Final fallback
  return img.parentElement;
}

/**
 * Tier 1: Find selected swatch via checked radio input
 * @param {Element} container - Product container
 * @param {HTMLImageElement} productImage - Product image for spatial validation
 * @returns {Element|null} - Selected swatch element
 */
function findByRadioInput(container, productImage = null) {
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
 * Validate swatch is spatially close to container
 * Prevents selecting swatches from other products on listing pages
 * @param {Element} swatch - Swatch element
 * @param {Element} container - Product container
 * @param {HTMLImageElement} productImage - Optional product image for tighter validation
 * @returns {boolean} - True if spatially valid
 */
function validateSwatchSpatialProximity(swatch, container, productImage = null) {
  const swatchRect = swatch.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();

  // Basic check: swatch must be within container bounds (with small tolerance)
  const tolerance = 50; // pixels
  const isWithinContainer =
    swatchRect.left >= containerRect.left - tolerance &&
    swatchRect.right <= containerRect.right + tolerance &&
    swatchRect.top >= containerRect.top - tolerance &&
    swatchRect.bottom <= containerRect.bottom + tolerance;

  console.log('[Swatch Priority] Spatial validation:', {
    swatchRect: { left: Math.round(swatchRect.left), top: Math.round(swatchRect.top), width: Math.round(swatchRect.width) },
    containerRect: { left: Math.round(containerRect.left), top: Math.round(containerRect.top), width: Math.round(containerRect.width) },
    isWithinContainer
  });

  if (!isWithinContainer) {
    console.log('[Swatch Priority] ✗ Swatch outside container bounds');
    return false;
  }

  // If product image provided, do tighter validation
  if (productImage) {
    const imgRect = productImage.getBoundingClientRect();
    const distance = calculateDistance(swatchRect, imgRect);

    console.log('[Swatch Priority] Distance to product image:', Math.round(distance), 'px (max: 300px)');

    // Swatch should be within 300px of product image
    if (distance > 300) {
      console.log('[Swatch Priority] ✗ Swatch too far from product image:', Math.round(distance), 'px');
      return false;
    }
  }

  console.log('[Swatch Priority] ✓ Spatial validation passed');
  return true;
}

/**
 * Tier 2: Find selected swatch via common CSS class names
 * SIMPLIFIED: Just return first selected swatch found (container already scoped correctly)
 * @param {Element} container - Product container
 * @param {HTMLImageElement} productImage - Optional product image (unused in simplified version)
 * @returns {Element|null} - Selected swatch element
 */
function findByCommonClasses(container, productImage = null) {
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
      if (elements.length > 0) {
        console.log('[Swatch Priority Tier 2] Found', elements.length, 'elements for selector:', selector);
      }

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
          console.log('[Swatch Priority Tier 2] ✓ Found valid selected swatch:', element);
          return element; // Return first valid selected swatch
        }
      }
    } catch (e) {
      // Invalid selector, continue
      continue;
    }
  }

  console.log('[Swatch Priority Tier 2] No selected swatches found');
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
    // Skip elements from the season checker extension itself
    if (
      element.classList.contains('season-color-swatch') ||
      element.classList.contains('season-badge') ||
      element.classList.contains('season-filter-container') ||
      element.closest('.season-filter-container')
    ) {
      continue;
    }

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
 * Find swatches by visual layout pattern (generic approach)
 * Detects rows of similar-sized small images - works across all e-commerce sites
 * @param {Element} container - Product container
 * @param {HTMLImageElement} productImage - The product image to find swatches for
 * @returns {Element|null} - First swatch image from a valid swatch row near the product
 */
function findSwatchesByLayout(container, productImage) {
  console.log('[Swatch Priority] Detecting swatches by visual layout...');

  // Get product image position for spatial filtering
  const productRect = productImage.getBoundingClientRect();
  console.log(`[Swatch Priority] Product image at: x=${Math.round(productRect.left)}, y=${Math.round(productRect.top)}, bottom=${Math.round(productRect.bottom)}`);

  // Find all images in container
  const allImages = Array.from(container.querySelectorAll('img'));

  // Filter to small images (potential swatches: 10-100px)
  const smallImages = allImages.filter(img => {
    const width = img.offsetWidth || img.width;
    const height = img.offsetHeight || img.height;
    return width >= 10 && width <= 100 && height >= 10 && height <= 100;
  });

  console.log(`[Swatch Priority] Found ${smallImages.length} small images (10-100px)`);

  if (smallImages.length < 3) {
    console.log('[Swatch Priority] Not enough small images for swatch detection');
    return null;
  }

  // Group images by Y-coordinate (rows)
  const rows = {};
  smallImages.forEach(img => {
    const rect = img.getBoundingClientRect();
    const y = Math.round(rect.top / 10) * 10; // Group within 10px tolerance

    if (!rows[y]) rows[y] = [];
    rows[y].push({
      element: img,
      width: img.offsetWidth || img.width,
      height: img.offsetHeight || img.height,
      x: rect.left,
      y: rect.top,
      rect: rect
    });
  });

  console.log(`[Swatch Priority] Grouped into ${Object.keys(rows).length} horizontal rows`);

  // Find valid swatch rows that are spatially near this product
  const validRows = [];

  for (const y in rows) {
    const rowImages = rows[y];

    if (rowImages.length < 3) continue;

    // Sort by X coordinate (left to right)
    rowImages.sort((a, b) => a.x - b.x);

    // Check if images are similar size
    const avgWidth = rowImages.reduce((sum, img) => sum + img.width, 0) / rowImages.length;
    const avgHeight = rowImages.reduce((sum, img) => sum + img.height, 0) / rowImages.length;

    const similarSize = rowImages.every(img => {
      const widthDiff = Math.abs(img.width - avgWidth);
      const heightDiff = Math.abs(img.height - avgHeight);
      return widthDiff <= 5 && heightDiff <= 5; // 5px tolerance
    });

    if (!similarSize) {
      console.log(`[Swatch Priority] Row at y=${y}: images not similar size (avg ${avgWidth}x${avgHeight})`);
      continue;
    }

    // Check if images are square-ish (aspect ratio 0.8 - 1.2)
    const squareIsh = rowImages.every(img => {
      const aspectRatio = img.width / img.height;
      return aspectRatio >= 0.8 && aspectRatio <= 1.2;
    });

    if (!squareIsh) {
      console.log(`[Swatch Priority] Row at y=${y}: images not square-ish`);
      continue;
    }

    // Valid swatch row found! Now check spatial proximity to product image
    const rowY = rowImages[0].y;
    const rowX = rowImages[0].x;
    const rowRight = rowImages[rowImages.length - 1].rect.right;

    // IMPROVED: Multi-directional proximity check (not just below)
    const directions = {
      below: rowY > productRect.bottom,
      above: rowY < productRect.top,
      sameLevel: Math.abs(rowY - productRect.top) < 50,
    };

    // Calculate distance in all directions
    let verticalDistance;
    let direction;

    if (directions.below) {
      verticalDistance = rowY - productRect.bottom;
      direction = 'below';
    } else if (directions.above) {
      verticalDistance = productRect.top - (rowY + avgHeight);
      direction = 'above';
    } else if (directions.sameLevel) {
      verticalDistance = Math.abs(rowX - productRect.right);
      direction = 'beside';
    } else {
      verticalDistance = Infinity;
      direction = 'unknown';
    }

    // IMPROVED: Tighter proximity thresholds (scaled to product size)
    const productHeight = productRect.height;
    const maxDistance = Math.min(150, productHeight * 0.5); // Max 150px or 50% of product height
    const isNearby = verticalDistance < maxDistance;

    // IMPROVED: Tighter horizontal overlap (±50px instead of ±100px)
    const tolerance = 50;
    const hasHorizontalOverlap =
      (rowX >= productRect.left - tolerance && rowX <= productRect.right + tolerance) ||
      (rowRight >= productRect.left - tolerance && rowRight <= productRect.right + tolerance) ||
      (rowX <= productRect.left && rowRight >= productRect.right);

    if (isNearby && hasHorizontalOverlap) {
      console.log(`[Swatch Priority] ✓ Found valid swatch row (${direction}): ${rowImages.length} images, ${Math.round(avgWidth)}x${Math.round(avgHeight)}px, distance=${Math.round(verticalDistance)}px`);
      validRows.push({
        images: rowImages,
        distance: verticalDistance,
        y: rowY,
        direction: direction
      });
    } else {
      console.log(`[Swatch Priority] Row at y=${y}: not near product (${direction}, nearby=${isNearby}, overlap=${hasHorizontalOverlap}, dist=${Math.round(verticalDistance)}px)`);
    }
  }

  // Return the closest valid swatch row
  if (validRows.length > 0) {
    validRows.sort((a, b) => a.distance - b.distance);
    const closestRow = validRows[0];
    console.log(`[Swatch Priority] Using closest swatch row at y=${Math.round(closestRow.y)}, distance=${Math.round(closestRow.distance)}px`);
    return closestRow.images[0].element;
  }

  console.log('[Swatch Priority] No valid swatch rows near this product');
  return null;
}

/**
 * Tier 6: Find first relative swatch in container (listing page fallback)
 * Used when no explicit selection is detected on product listing pages
 * @param {Element} container - Product container
 * @param {HTMLImageElement} productImage - The product image to find swatches for
 * @returns {Element|null} - First valid swatch element
 */
function findFirstRelativeSwatch(container, productImage) {
  console.log('[Swatch Priority] DEBUG: Searching for swatches in container:', container);

  // FIRST: Try visual layout detection (most generic, works everywhere)
  const layoutSwatch = findSwatchesByLayout(container, productImage);
  if (layoutSwatch) {
    console.log('[Swatch Priority] Found swatch via layout detection:', layoutSwatch);
    return layoutSwatch;
  }

  // Helper function to check if element is from the extension
  const isExtensionElement = (element) => {
    return (
      element.classList.contains('season-color-swatch') ||
      element.classList.contains('season-badge') ||
      element.classList.contains('season-filter-container') ||
      element.closest('.season-filter-container')
    );
  };

  // Common swatch selectors ordered by likelihood
  const swatchSelectors = [
    // Images within swatch containers
    '[class*="swatch"] img',
    '[class*="color-option"] img',
    '[class*="variant"] img',

    // Swatch elements themselves
    '[class*="swatch"]',
    '[class*="color-option"]',
    '[class*="color-swatch"]',
    '[class*="variant-option"]',

    // Button/link patterns
    'button[class*="swatch"]',
    'a[class*="swatch"]',
    'button[class*="color"]',
    'a[class*="color"]',
  ];

  // First pass: Try to find swatches in the container using standard selectors
  for (const selector of swatchSelectors) {
    try {
      const swatches = container.querySelectorAll(selector);
      console.log(`[Swatch Priority] DEBUG: Selector "${selector}" found ${swatches.length} elements`);

      for (const swatch of swatches) {
        // Skip extension elements
        if (isExtensionElement(swatch)) {
          console.log('[Swatch Priority] DEBUG: Skipping extension element:', swatch);
          continue;
        }

        // Skip disabled/sold-out swatches
        if (
          swatch.classList.contains('disabled') ||
          swatch.classList.contains('is-disabled-option') ||
          swatch.classList.contains('sold-out') ||
          swatch.hasAttribute('disabled')
        ) {
          console.log('[Swatch Priority] DEBUG: Skipping disabled swatch:', swatch);
          continue;
        }

        // Validate swatch
        const isValid = isValidSwatchElement(swatch);
        console.log(`[Swatch Priority] DEBUG: Element validation = ${isValid}:`, swatch, {
          offsetWidth: swatch.offsetWidth,
          offsetHeight: swatch.offsetHeight,
          offsetParent: swatch.offsetParent
        });

        if (isValid) {
          console.log('[Swatch Priority] Found first relative swatch (standard):', swatch);
          return swatch;
        }
      }
    } catch (e) {
      // Invalid selector, continue
      console.log(`[Swatch Priority] DEBUG: Error with selector "${selector}":`, e.message);
      continue;
    }
  }

  // Safety check: Look through first 2 product images and their descendants
  console.log('[Swatch Priority] Standard selectors failed, trying image descendants...');
  const productImages = container.querySelectorAll('img');
  const imagesToCheck = Array.from(productImages).slice(0, 2);

  for (const img of imagesToCheck) {
    // Check the image's parent chain (up to 3 levels) for swatch containers
    let current = img.parentElement;
    let depth = 0;

    while (current && depth < 3 && current !== container) {
      // Look for swatches within this level
      for (const selector of swatchSelectors) {
        try {
          const swatches = current.querySelectorAll(selector);

          for (const swatch of swatches) {
            // Skip extension elements
            if (isExtensionElement(swatch)) continue;

            // Skip disabled/sold-out swatches
            if (
              swatch.classList.contains('disabled') ||
              swatch.classList.contains('is-disabled-option') ||
              swatch.classList.contains('sold-out') ||
              swatch.hasAttribute('disabled')
            ) {
              continue;
            }

            // Validate swatch
            if (isValidSwatchElement(swatch)) {
              console.log('[Swatch Priority] Found first relative swatch (image descendant):', swatch);
              return swatch;
            }
          }
        } catch (e) {
          continue;
        }
      }

      current = current.parentElement;
      depth++;
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

// ==================== SPATIAL CLUSTERING HELPERS ====================
// Advanced spatial analysis for accurate product-to-swatch matching

/**
 * Calculate bounding box for an array of elements
 * @param {Array<HTMLElement>} elements - Elements to bound
 * @returns {Object} - {left, right, top, bottom, width, height}
 */
function getBoundingBox(elements) {
  if (!elements || elements.length === 0) {
    return { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 };
  }

  let minLeft = Infinity;
  let minTop = Infinity;
  let maxRight = -Infinity;
  let maxBottom = -Infinity;

  elements.forEach((el) => {
    const rect = el.getBoundingClientRect();
    minLeft = Math.min(minLeft, rect.left);
    minTop = Math.min(minTop, rect.top);
    maxRight = Math.max(maxRight, rect.right);
    maxBottom = Math.max(maxBottom, rect.bottom);
  });

  return {
    left: minLeft,
    right: maxRight,
    top: minTop,
    bottom: maxBottom,
    width: maxRight - minLeft,
    height: maxBottom - minTop,
  };
}

/**
 * Calculate distance between two bounding boxes
 * @param {Object} rect1 - First bounding box
 * @param {Object} rect2 - Second bounding box
 * @returns {number} - Distance in pixels (0 if overlapping)
 */
function calculateDistance(rect1, rect2) {
  // If rectangles overlap, distance is 0
  const horizontalOverlap =
    rect1.right >= rect2.left && rect1.left <= rect2.right;
  const verticalOverlap =
    rect1.bottom >= rect2.top && rect1.top <= rect2.bottom;

  if (horizontalOverlap && verticalOverlap) {
    return 0;
  }

  // Calculate horizontal distance
  let horizontalDist = 0;
  if (rect1.right < rect2.left) {
    horizontalDist = rect2.left - rect1.right;
  } else if (rect2.right < rect1.left) {
    horizontalDist = rect1.left - rect2.right;
  }

  // Calculate vertical distance
  let verticalDist = 0;
  if (rect1.bottom < rect2.top) {
    verticalDist = rect2.top - rect1.bottom;
  } else if (rect2.bottom < rect1.top) {
    verticalDist = rect1.top - rect2.bottom;
  }

  // Return Euclidean distance
  return Math.sqrt(horizontalDist ** 2 + verticalDist ** 2);
}

/**
 * Group nearby elements into clusters based on spatial proximity
 * @param {Array<HTMLElement>} allElements - All elements to cluster
 * @param {number} maxDistance - Maximum distance to be in same cluster (pixels)
 * @returns {Array<Object>} - Array of clusters {elements, boundingBox}
 */
function findElementClusters(allElements, maxDistance = 150) {
  const clusters = [];

  allElements.forEach((element) => {
    const rect = element.getBoundingClientRect();
    let addedToCluster = false;

    // Try to add to existing cluster
    for (const cluster of clusters) {
      const distance = calculateDistance(cluster.boundingBox, rect);

      if (distance <= maxDistance) {
        cluster.elements.push(element);

        // Expand bounding box
        cluster.boundingBox = getBoundingBox(cluster.elements);
        addedToCluster = true;
        break;
      }
    }

    // Create new cluster if not added
    if (!addedToCluster) {
      clusters.push({
        elements: [element],
        boundingBox: rect,
      });
    }
  });

  return clusters;
}

/**
 * Detect grid pattern in product layout
 * @param {Array<HTMLElement>} productImages - All product images on page
 * @returns {Object|null} - {columns, rows, spacing} or null
 */
function detectGridPattern(productImages) {
  if (productImages.length < 4) {
    return null; // Need at least 4 products to detect grid
  }

  // Get Y coordinates and group into rows
  const rows = new Map(); // y-coordinate -> [images]
  const tolerance = 20; // pixels

  productImages.forEach((img) => {
    const rect = img.getBoundingClientRect();
    const y = Math.round(rect.top / tolerance) * tolerance; // Round to tolerance

    if (!rows.has(y)) {
      rows.set(y, []);
    }
    rows.get(y).push(img);
  });

  // Find most common row size (number of columns)
  const rowSizes = Array.from(rows.values()).map((row) => row.length);
  const columnCount = Math.max(...rowSizes);

  if (columnCount < 2) {
    return null; // Not a grid layout
  }

  // Calculate average spacing
  const spacings = [];
  rows.forEach((rowImages) => {
    if (rowImages.length >= 2) {
      rowImages.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);

      for (let i = 0; i < rowImages.length - 1; i++) {
        const rect1 = rowImages[i].getBoundingClientRect();
        const rect2 = rowImages[i + 1].getBoundingClientRect();
        spacings.push(rect2.left - rect1.right);
      }
    }
  });

  const avgSpacing = spacings.length > 0
    ? spacings.reduce((a, b) => a + b, 0) / spacings.length
    : 0;

  return {
    columns: columnCount,
    rows: rows.size,
    spacing: avgSpacing,
  };
}

/**
 * Find the cluster containing a specific image
 * @param {HTMLElement} img - Target image
 * @param {Array<Object>} clusters - Array of clusters
 * @returns {Object|null} - Cluster containing image, or null
 */
function findClosestCluster(img, clusters) {
  const imgRect = img.getBoundingClientRect();

  // First, check if image is in any cluster
  for (const cluster of clusters) {
    if (cluster.elements.includes(img)) {
      return cluster;
    }
  }

  // If not in any cluster, find nearest one
  let closestCluster = null;
  let minDistance = Infinity;

  clusters.forEach((cluster) => {
    const distance = calculateDistance(imgRect, cluster.boundingBox);
    if (distance < minDistance) {
      minDistance = distance;
      closestCluster = cluster;
    }
  });

  return closestCluster;
}

/**
 * Validate that a cluster has expected product structure
 * @param {Object} cluster - Cluster to validate
 * @returns {boolean} - True if valid product cluster
 */
function validateProductCluster(cluster) {
  if (!cluster || !cluster.elements || cluster.elements.length === 0) {
    return false;
  }

  // Count product images (large images)
  const largeImages = cluster.elements.filter((el) => {
    if (el.tagName !== 'IMG') return false;
    const rect = el.getBoundingClientRect();
    return rect.width >= 100 && rect.height >= 100;
  });

  // Should have exactly 1 main product image
  if (largeImages.length !== 1) {
    return false;
  }

  // Should have some other elements (swatches, text, etc.)
  if (cluster.elements.length < 2) {
    return false;
  }

  // Cluster shouldn't be too large (spanning multiple products)
  if (cluster.boundingBox.width > window.innerWidth * 0.6) {
    return false;
  }

  return true;
}

/**
 * Find product cluster for a specific image using spatial analysis
 * @param {HTMLElement} img - Product image
 * @returns {Object|null} - {container, cluster} or null
 */
function findProductClusterForImage(img) {
  // Find all potential product elements nearby
  const searchRadius = 400; // pixels
  const imgRect = img.getBoundingClientRect();

  const allElements = Array.from(document.querySelectorAll('*')).filter((el) => {
    if (el === img) return true; // Include the image itself

    const rect = el.getBoundingClientRect();

    // Skip invisible or tiny elements
    if (rect.width < 10 || rect.height < 10) return false;
    if (!el.offsetParent) return false;

    // Check if within search radius
    const distance = calculateDistance(imgRect, rect);
    if (distance > searchRadius) return false;

    // Include potential product elements
    const classList = (el.className || '').toLowerCase();
    const isRelevant =
      el.tagName === 'IMG' ||
      classList.includes('swatch') ||
      classList.includes('color') ||
      classList.includes('price') ||
      classList.includes('title') ||
      classList.includes('name') ||
      el.tagName === 'BUTTON' ||
      el.tagName === 'A';

    return isRelevant;
  });

  // Cluster nearby elements
  const clusters = findElementClusters(allElements, 150);

  // Find cluster containing our image
  const cluster = findClosestCluster(img, clusters);

  if (!cluster || !validateProductCluster(cluster)) {
    return null;
  }

  // Find minimal container that wraps all elements in cluster
  const container = findMinimalContainer(cluster.elements);

  return {
    container: container,
    cluster: cluster,
  };
}

/**
 * Find the minimal DOM container that wraps all elements
 * @param {Array<HTMLElement>} elements - Elements to wrap
 * @returns {HTMLElement} - Minimal container
 */
function findMinimalContainer(elements) {
  if (elements.length === 0) return document.body;
  if (elements.length === 1) return elements[0].parentElement || document.body;

  // Find common ancestor
  let commonAncestor = elements[0];

  elements.forEach((el) => {
    commonAncestor = findCommonAncestor(commonAncestor, el);
  });

  // Walk down to find tightest container
  let current = commonAncestor;
  while (current && current.children.length === 1) {
    current = current.children[0];

    // Check if this child still contains all elements
    const containsAll = elements.every((el) => current.contains(el));
    if (!containsAll) {
      break;
    }
    commonAncestor = current;
  }

  return commonAncestor;
}

/**
 * Find common ancestor of two elements
 * @param {HTMLElement} el1 - First element
 * @param {HTMLElement} el2 - Second element
 * @returns {HTMLElement} - Common ancestor
 */
function findCommonAncestor(el1, el2) {
  const ancestors1 = getAncestors(el1);
  let current = el2;

  while (current) {
    if (ancestors1.includes(current)) {
      return current;
    }
    current = current.parentElement;
  }

  return document.body;
}

/**
 * Get all ancestors of an element
 * @param {HTMLElement} el - Element
 * @returns {Array<HTMLElement>} - Ancestors
 */
function getAncestors(el) {
  const ancestors = [];
  let current = el;

  while (current && current !== document.body) {
    ancestors.push(current);
    current = current.parentElement;
  }

  ancestors.push(document.body);
  return ancestors;
}

/**
 * Validate container size is appropriate for single product
 * @param {HTMLElement} container - Container to validate
 * @param {HTMLElement} img - Product image (for reference)
 * @returns {boolean} - True if size is reasonable
 */
function validateContainerSize(container, img) {
  const containerRect = container.getBoundingClientRect();
  const imgRect = img.getBoundingClientRect();

  // Container shouldn't be too wide (likely spanning multiple products)
  if (containerRect.width > window.innerWidth * 0.6) {
    return false;
  }

  // Container should be at least as large as the image
  if (containerRect.width < imgRect.width || containerRect.height < imgRect.height) {
    return false;
  }

  // Container shouldn't be massively larger than image (sanity check)
  const widthRatio = containerRect.width / imgRect.width;
  const heightRatio = containerRect.height / imgRect.height;

  if (widthRatio > 5 || heightRatio > 5) {
    return false;
  }

  // Check if container has multiple large product images (bad sign)
  const largeImages = Array.from(container.querySelectorAll('img')).filter((otherImg) => {
    if (otherImg === img) return false; // Exclude our target image
    const rect = otherImg.getBoundingClientRect();
    return rect.width >= 100 && rect.height >= 100;
  });

  if (largeImages.length > 3) {
    // More than 3 other large images suggests container spans multiple products
    return false;
  }

  return true;
}

/**
 * Find container by careful DOM traversal with strict validation
 * @param {HTMLElement} img - Product image
 * @returns {HTMLElement} - Container element
 */
function findContainerByTraversal(img) {
  let current = img.parentElement;
  let depth = 0;
  const maxDepth = 8;

  while (current && depth < maxDepth) {
    // Stop at body
    if (current === document.body) {
      break;
    }

    // Check if this level has swatches
    const hasSwatches =
      current.querySelector('[class*="swatch"]') ||
      current.querySelector('[class*="color-option"]') ||
      current.querySelector('input[type="radio"][name*="color"]');

    if (hasSwatches) {
      // Validate this container doesn't span multiple products
      const largeImages = Array.from(current.querySelectorAll('img')).filter((otherImg) => {
        if (otherImg === img) return false;
        const rect = otherImg.getBoundingClientRect();
        return rect.width >= 100 && rect.height >= 100;
      });

      // If no other large images, this is probably the right container
      if (largeImages.length === 0) {
        return current;
      }

      // If other large images exist, check if they're spatially far away
      const imgRect = img.getBoundingClientRect();
      const farAway = largeImages.every((otherImg) => {
        const otherRect = otherImg.getBoundingClientRect();
        const distance = calculateDistance(imgRect, otherRect);
        return distance > 200; // Far enough to be different products
      });

      if (farAway) {
        return current;
      }
    }

    current = current.parentElement;
    depth++;
  }

  // Fallback: return image's immediate parent
  return img.parentElement || img.closest('[class*="product"]') || document.body;
}

// ==================== EXPORTS ====================
// Export functions for use by other modules (swatch-detector.js, content.js)

if (typeof window !== 'undefined') {
  // Main API functions
  window.findSelectedSwatchForImage = findSelectedSwatchForImage;
  window.extractSwatchColor = extractSwatchColor;
  window.applySwatchPriorityWeighting = applySwatchPriorityWeighting;

  // Helper functions
  window.findProductContainer = findProductContainer;
  window.findSwatchesByLayout = findSwatchesByLayout;
  window.watchSwatchChanges = watchSwatchChanges;

  // Tier detection functions
  window.findByRadioInput = findByRadioInput;
  window.findByCommonClasses = findByCommonClasses;
  window.findByAriaAttributes = findByAriaAttributes;
  window.findByDataAttributes = findByDataAttributes;
  window.findByVisualStyles = findByVisualStyles;

  // Utility functions
  window.parseColorString = parseColorString;
  window.rgbToHex = rgbToHex;
  window.hexToRgb = hexToRgb;
  window.isNeutralColor = isNeutralColor;
  window.isValidSwatchElement = isValidSwatchElement;

  console.log('[Season Color Checker] Swatch Priority functions exported to window');
}
