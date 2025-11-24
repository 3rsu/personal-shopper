/**
 * TEXT COLOR EXTRACTOR
 *
 * Extracts color keywords from DOM elements near product images
 * and provides confidence scoring for color palette enhancement.
 */

(function() {
  'use strict';

  // Cache for DOM traversal results
  const domTextCache = new WeakMap();

  // Configuration
  const CONFIG = {
    maxCharactersPerElement: 200,
    maxTotalCharacters: 500,
    maxElementsToCheck: 10,
    maxTraversalDepth: 5
  };

  // Ambiguous color words that need context validation
  const AMBIGUOUS_COLORS = {
    'orange': ['juice', 'peel', 'fruit', 'county', 'brand'],
    'olive': ['oil', 'tree', 'branch', 'food'],
    'rose': ['flower', 'garden', 'bush', 'plant'],
    'coral': ['reef', 'island', 'sea'],
    'mint': ['leaves', 'tea', 'flavor', 'candy'],
    'peach': ['fruit', 'tree'],
    'cherry': ['fruit', 'tree', 'blossom'],
    'lime': ['fruit', 'juice'],
    'chocolate': ['bar', 'candy', 'cake', 'dessert'],
    'coffee': ['drink', 'cup', 'beans', 'shop'],
    'honey': ['bee', 'comb', 'jar']
  };

  // Negative context patterns to filter out
  const NEGATIVE_PATTERNS = [
    /not (available|sold|offered|made|coming) in \w+/i,
    /no longer (available|sold|offered) in \w+/i,
    /out of stock in \w+/i,
    /discontinued in \w+/i,
    /\w+ (logo|brand|company|store|site|website)/i,
    /except \w+/i,
    /excluding \w+/i
  ];

  // Skip generic color mentions
  const SKIP_PATTERNS = [
    /\d+ colors?/i,
    /many colors?/i,
    /various colors?/i,
    /multiple colors?/i,
    /all colors?/i,
    /every colors?/i,
    /several colors?/i
  ];

  // Fashion/clothing context terms (boosts confidence)
  const FASHION_CONTEXT_TERMS = [
    'dress', 'shirt', 'pants', 'jeans', 'shorts', 'skirt', 'jacket',
    'coat', 'sweater', 'hoodie', 'top', 'bottom', 'shoes', 'boots',
    'color', 'shade', 'hue', 'tone', 'available in', 'comes in',
    'choose from', 'select', 'option', 'variant', 'style'
  ];

  /**
   * Main entry point: Extract color keywords from DOM near image
   */
  function extractColorKeywordsFromDOM(img) {
    // Check cache first
    if (domTextCache.has(img)) {
      return domTextCache.get(img);
    }

    const colorMentions = [];

    // Priority 1: Image attributes (highest confidence)
    colorMentions.push(...extractFromImageAttributes(img));

    // Priority 2: Variant/swatch selectors
    colorMentions.push(...extractFromVariantSelector(img));

    // Priority 3: Product card/container
    colorMentions.push(...extractFromProductCard(img));

    // Priority 4: Structured data (JSON-LD)
    colorMentions.push(...extractFromStructuredData());

    // Filter and deduplicate
    const filtered = filterAndDeduplicateColors(colorMentions);

    // Cache result
    domTextCache.set(img, filtered);

    return filtered;
  }

  /**
   * Extract colors from image attributes
   */
  function extractFromImageAttributes(img) {
    const sources = [
      img.alt || '',
      img.title || '',
      img.getAttribute('data-color') || '',
      img.getAttribute('aria-label') || ''
    ].filter(Boolean);

    const text = sources.join(' ');
    const keywords = extractColorKeywords(text);

    return keywords.map(kw => ({
      ...kw,
      source: 'image-attribute',
      confidence: 0.9,
      position: 'image'
    }));
  }

  /**
   * Extract colors from variant/swatch selectors
   */
  function extractFromVariantSelector(img) {
    // Find closest product container
    const productContainer = img.closest('[class*="product"]') ||
                            img.closest('[data-product-id]') ||
                            img.closest('article');

    if (!productContainer) return [];

    // Look for color swatches/selectors (exclude our own swatches)
    const colorElements = productContainer.querySelectorAll(
      '[class*="color"]:not(.season-swatch):not(.color-swatch):not(.color-palette-swatch-container), ' +
      '[class*="swatch"]:not(.season-swatch):not(.color-swatch), ' +
      '[class*="variant"], ' +
      '[data-color], ' +
      'select[name*="color"] option:checked, ' +
      '[aria-label*="color"]'
    );

    const colors = [];
    colorElements.forEach(el => {
      // Get text content
      if (el.textContent) colors.push(el.textContent.trim());
      // Get data attributes
      if (el.getAttribute('data-color')) colors.push(el.getAttribute('data-color'));
      if (el.getAttribute('aria-label')) colors.push(el.getAttribute('aria-label'));
      if (el.getAttribute('title')) colors.push(el.getAttribute('title'));
    });

    const text = colors.join(' ');
    const keywords = extractColorKeywords(text);

    return keywords.map(kw => ({
      ...kw,
      source: 'variant-selector',
      confidence: 0.8,
      position: 'selector'
    }));
  }

  /**
   * Extract colors from product card text
   */
  function extractFromProductCard(img) {
    const productContainer = img.closest('[class*="product"]') ||
                            img.closest('[data-product-id]') ||
                            img.closest('article') ||
                            img.parentElement;

    if (!productContainer) return [];

    // Search within limited scope
    const textElements = [
      // Product title (highest priority in card)
      productContainer.querySelector('[class*="title"], [class*="name"], h1, h2, h3, h4'),
      // Description
      productContainer.querySelector('[class*="description"], [class*="detail"]'),
      // Badges/labels
      ...Array.from(productContainer.querySelectorAll('[class*="badge"], [class*="label"]'))
    ].filter(Boolean).slice(0, CONFIG.maxElementsToCheck);

    const texts = textElements.map(el => {
      const text = el.textContent?.trim().substring(0, CONFIG.maxCharactersPerElement);
      const isTitle = el.matches('[class*="title"], [class*="name"], h1, h2, h3, h4');
      return { text, isTitle };
    });

    const allKeywords = [];

    texts.forEach(({ text, isTitle }) => {
      const keywords = extractColorKeywords(text);
      allKeywords.push(...keywords.map(kw => ({
        ...kw,
        source: isTitle ? 'product-title' : 'product-description',
        confidence: isTitle ? 0.7 : 0.5,
        position: isTitle ? 'title' : 'description'
      })));
    });

    return allKeywords;
  }

  /**
   * Extract colors from JSON-LD structured data
   */
  function extractFromStructuredData() {
    const schemas = document.querySelectorAll('script[type="application/ld+json"]');
    const colors = [];

    for (const schema of schemas) {
      try {
        const data = JSON.parse(schema.textContent);

        // Handle Product schema
        if (data['@type'] === 'Product' && data.color) {
          const colorData = Array.isArray(data.color) ? data.color : [data.color];
          colors.push(...colorData);
        }

        // Handle array of products
        if (Array.isArray(data)) {
          const productColors = data
            .filter(item => item['@type'] === 'Product' && item.color)
            .flatMap(item => Array.isArray(item.color) ? item.color : [item.color]);
          colors.push(...productColors);
        }
      } catch (e) {
        continue;
      }
    }

    if (colors.length === 0) return [];

    const text = colors.join(' ');
    const keywords = extractColorKeywords(text);

    return keywords.map(kw => ({
      ...kw,
      source: 'structured-data',
      confidence: 0.85,
      position: 'schema'
    }));
  }

  /**
   * Extract color keywords from text using pattern matching
   */
  function extractColorKeywords(text) {
    if (!text) return [];

    const lowerText = text.toLowerCase();
    const matches = [];

    // Check if text should be skipped entirely
    if (SKIP_PATTERNS.some(pattern => pattern.test(lowerText))) {
      return [];
    }

    // Get all color names from dictionary
    const allColorNames = getAllColorNames();

    // Sort by length (longest first) to match multi-word colors first
    const sortedColorNames = allColorNames.sort((a, b) => b.length - a.length);

    // Track matched positions to avoid overlapping matches
    const matchedPositions = new Set();

    for (const colorName of sortedColorNames) {
      // Use word boundaries to avoid false matches
      const regex = new RegExp('\\b' + colorName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
      let match;

      while ((match = regex.exec(lowerText)) !== null) {
        const startPos = match.index;
        const endPos = startPos + colorName.length;

        // Check if this position overlaps with existing match
        let overlaps = false;
        for (let i = startPos; i < endPos; i++) {
          if (matchedPositions.has(i)) {
            overlaps = true;
            break;
          }
        }

        if (!overlaps) {
          // Extract context window (30 chars before and after)
          const contextStart = Math.max(0, startPos - 30);
          const contextEnd = Math.min(lowerText.length, endPos + 30);
          const context = lowerText.substring(contextStart, contextEnd);

          // Validate this is likely a product color
          if (isLikelyProductColor(colorName, context)) {
            matches.push({
              keyword: colorName,
              position: startPos,
              context: context,
              type: colorName.includes(' ') ? 'multi-word' : 'single-word'
            });

            // Mark positions as matched
            for (let i = startPos; i < endPos; i++) {
              matchedPositions.add(i);
            }
          }
        }
      }
    }

    // Group by keyword and count occurrences
    const grouped = {};
    matches.forEach(match => {
      if (!grouped[match.keyword]) {
        grouped[match.keyword] = {
          keyword: match.keyword,
          count: 0,
          type: match.type,
          firstPosition: match.position
        };
      }
      grouped[match.keyword].count++;
    });

    return Object.values(grouped);
  }

  /**
   * Check if color mention is likely describing product color
   */
  function isLikelyProductColor(colorName, surroundingText) {
    // Check for negative context
    if (NEGATIVE_PATTERNS.some(pattern => pattern.test(surroundingText))) {
      return false;
    }

    // Check if it's an ambiguous color word
    if (AMBIGUOUS_COLORS[colorName]) {
      const ambiguousContexts = AMBIGUOUS_COLORS[colorName];
      const hasAmbiguousContext = ambiguousContexts.some(context =>
        surroundingText.includes(context)
      );

      if (hasAmbiguousContext) {
        // Check if there's also fashion context
        const hasFashionContext = FASHION_CONTEXT_TERMS.some(term =>
          surroundingText.includes(term)
        );

        if (!hasFashionContext) {
          return false; // Likely not product color
        }
      }
    }

    return true;
  }

  /**
   * Filter and deduplicate color mentions
   */
  function filterAndDeduplicateColors(colorMentions) {
    if (colorMentions.length === 0) return [];

    // Sort by confidence (highest first)
    const sorted = colorMentions.sort((a, b) => b.confidence - a.confidence);

    // Deduplicate by keyword (keep highest confidence)
    const seen = new Set();
    const deduped = [];

    for (const mention of sorted) {
      const normalizedKeyword = normalizeColorName(mention.keyword);
      if (!seen.has(normalizedKeyword)) {
        seen.add(normalizedKeyword);
        deduped.push(mention);
      }
    }

    return deduped;
  }

  // Export for use in extension
  if (typeof window !== 'undefined') {
    window.extractColorKeywordsFromDOM = extractColorKeywordsFromDOM;
  }

})();
