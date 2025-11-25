/**
 * TEXT COLOR WEIGHTING
 *
 * Applies weighting to extracted color palette based on text color mentions.
 * Uses visual confirmation (deltaE) to ensure text colors match extracted colors.
 */

(function() {
  'use strict';

  // Source confidence weights
  const SOURCE_WEIGHTS = {
    'image-attribute': 0.9,
    'variant-selector': 0.8,
    'structured-data': 0.85,
    'product-title': 0.7,
    'product-description': 0.5,
    'nearby-text': 0.4
  };

  // DeltaE threshold for color similarity (visual confirmation)
  // Higher than season palette matching (20) to be more lenient with text-mentioned colors
  // Real-world products often have color variation (e.g., "burgundy" can range from #800020 to #A03E5C)
  const DELTA_E_THRESHOLD = 28;

  // DeltaE threshold for considering colors "different enough" to add
  // Ensures text colors are visually distinct before adding to palette
  const DELTA_E_DIFFERENT_THRESHOLD = 32;

  /**
   * Ensure fashion color dictionary is loaded
   */
  function ensureDictionaryLoaded() {
    if (!window.normalizeColorName || !window.getColorHex || !window.getColorRgb) {
      console.error('[Text Color Weighting] Fashion color dictionary not loaded!');
      return false;
    }
    return true;
  }

  /**
   * Get color from dictionary with proper normalization and error handling
   * @param {string} colorName - Color name to lookup
   * @param {string} format - 'rgb' or 'hex'
   * @returns {Array<number>|string|null} - RGB array, hex string, or null if not found
   */
  function getColorFromDictionary(colorName, format = 'rgb') {
    if (!ensureDictionaryLoaded()) return null;

    // Normalize the color name (handles grey/gray, multi-word colors, etc.)
    const normalized = window.normalizeColorName(colorName);

    // Get requested format
    if (format === 'rgb') {
      return window.getColorRgb(normalized);
    } else if (format === 'hex') {
      return window.getColorHex(normalized);
    }

    return null;
  }

  /**
   * Apply text-based weighting to color palette
   * Boosts colors that match text mentions
   */
  function applyTextColorWeighting(dominantColors, textColorMentions, colorProcessor) {
    if (!textColorMentions || textColorMentions.length === 0) {
      // No text colors found, return original palette with default weights
      return dominantColors.map((rgb, index) => ({
        rgb,
        hex: colorProcessor.rgbToHex(rgb),
        weight: 1.0,
        originalIndex: index,
        textMatch: null
      }));
    }

    const weightedPalette = dominantColors.map((rgb, index) => {
      let weight = 1.0; // Default weight
      const hex = colorProcessor.rgbToHex(rgb);
      let bestTextMatch = null;

      // Check if this extracted color matches any text-mentioned colors
      for (const mention of textColorMentions) {
        // Get RGB directly from dictionary (with normalization)
        const mentionRgb = getColorFromDictionary(mention.keyword, 'rgb');
        if (!mentionRgb) continue;

        // Calculate color similarity using deltaE
        const deltaE = calculateDeltaE(rgb, mentionRgb, colorProcessor);

        // If colors are similar (visual confirmation), boost weight
        if (deltaE < DELTA_E_THRESHOLD) {
          // Calculate boost based on mention confidence
          const colorWeight = calculateColorWeight(mention);

          // Apply multiplicative boost (1.5x - 3.0x)
          const boost = 1.0 + colorWeight;
          weight *= boost;

          // Track best match for debugging
          if (!bestTextMatch || deltaE < bestTextMatch.deltaE) {
            bestTextMatch = {
              keyword: mention.keyword,
              deltaE: deltaE,
              boost: boost,
              source: mention.source
            };
          }

          console.log(`[Season Color Checker] Text color boost: ${hex} matches "${mention.keyword}" (ΔE ${deltaE.toFixed(1)}, boost ${boost.toFixed(2)}x)`);
        }
      }

      return {
        rgb,
        hex,
        weight,
        originalIndex: index,
        textMatch: bestTextMatch
      };
    });

    // Re-sort by weight (highest first)
    weightedPalette.sort((a, b) => b.weight - a.weight);

    return weightedPalette;
  }

  /**
   * Calculate weight/boost for a color mention
   */
  function calculateColorWeight(colorMatch) {
    let boost = 0;

    // Factor 1: Source confidence (where we found the color)
    boost += SOURCE_WEIGHTS[colorMatch.source] || 0.3;

    // Factor 2: Frequency (how many times mentioned)
    // Cap at 2.0x for repeated mentions
    const frequencyBoost = Math.min((colorMatch.count || 1) * 0.3, 2.0);
    boost += frequencyBoost;

    // Factor 3: Position in text (earlier = more important)
    if (colorMatch.position === 'first-mention' || colorMatch.firstPosition === 0) {
      boost += 0.2;
    }

    // Factor 4: Exact match vs fuzzy match
    if (colorMatch.type === 'multi-word') {
      boost += 0.1; // Multi-word colors are more specific
    }

    return boost;
  }

  /**
   * Augment palette with high-confidence text colors not in visual palette
   * Only adds colors from reliable sources (alt text, structured data)
   */
  function augmentPaletteWithTextColors(dominantColors, textColorMentions, colorProcessor, maxAdd = 2) {
    if (!textColorMentions || textColorMentions.length === 0) {
      return dominantColors;
    }

    const augmentedPalette = [...dominantColors];
    let addedCount = 0;

    // Sort text mentions by confidence (highest first)
    const sortedMentions = [...textColorMentions].sort((a, b) => b.confidence - a.confidence);

    for (const mention of sortedMentions) {
      if (addedCount >= maxAdd) break;

      // Only add if:
      // 1. High confidence source (image attributes, structured data)
      // 2. Not already similar to existing colors
      if (mention.confidence < 0.7) continue;

      // Get RGB directly from dictionary (with normalization)
      const mentionRgb = getColorFromDictionary(mention.keyword, 'rgb');
      if (!mentionRgb) continue;

      // Check if already represented in palette
      const alreadyExists = dominantColors.some(rgb => {
        const deltaE = calculateDeltaE(rgb, mentionRgb, colorProcessor);
        return deltaE < DELTA_E_DIFFERENT_THRESHOLD; // Similar enough
      });

      if (!alreadyExists) {
        console.log(`[Season Color Checker] Adding text color to palette: "${mention.keyword}" (${mentionHex}) from ${mention.source}`);
        augmentedPalette.push(mentionRgb);
        addedCount++;
      }
    }

    return augmentedPalette;
  }

  /**
   * Calculate deltaE between two RGB colors
   * Uses ColorProcessor if available, otherwise falls back to simple distance
   */
  function calculateDeltaE(rgb1, rgb2, colorProcessor) {
    if (colorProcessor && typeof colorProcessor.calculateDeltaE === 'function') {
      // Use ColorProcessor's deltaE (CIEDE2000)
      try {
        const lab1 = colorProcessor.rgbToLab({ r: rgb1[0], g: rgb1[1], b: rgb1[2] });
        const lab2 = colorProcessor.rgbToLab({ r: rgb2[0], g: rgb2[1], b: rgb2[2] });
        return colorProcessor.calculateDeltaE(lab1, lab2);
      } catch (e) {
        // Fall back to Euclidean distance
      }
    }

    // Fallback: Simple Euclidean distance in RGB space (not ideal but workable)
    const rDiff = rgb1[0] - rgb2[0];
    const gDiff = rgb1[1] - rgb2[1];
    const bDiff = rgb1[2] - rgb2[2];
    return Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff) / 255 * 100;
  }

  /**
   * Reconcile conflicting color information
   * Trusts text colors that are visually confirmed by the palette
   */
  function reconcileConflictingColors(colorMentions, extractedPalette, colorProcessor) {
    // If multiple text mentions from different sources conflict,
    // trust the one that's visually similar to extracted palette
    const visuallyConfirmedColors = colorMentions.filter(mention => {
      // Get RGB directly from dictionary (with normalization)
      const mentionRgb = getColorFromDictionary(mention.keyword, 'rgb');
      if (!mentionRgb) return false;

      return extractedPalette.some(rgb => {
        const deltaE = calculateDeltaE(rgb, mentionRgb, colorProcessor);
        return deltaE < 30; // Generous threshold for confirmation
      });
    });

    // Return visually confirmed colors, or all mentions if none confirmed
    return visuallyConfirmedColors.length > 0 ? visuallyConfirmedColors : colorMentions;
  }

  /**
   * Select final palette ensuring text-matched colors are preserved
   * Guarantees slots for text-mentioned colors even if they rank lower after weighting
   *
   * @param {Array} weightedPalette - Array of {rgb, hex, weight, textMatch} objects
   * @param {number} maxColors - Maximum colors to include (default 5)
   * @param {number} minTextColors - Minimum slots to reserve for text-matched colors (default 2)
   * @returns {Array<Array<number>>} - Final RGB palette
   */
  function selectFinalPalette(weightedPalette, maxColors = 5, minTextColors = 2) {
    if (!weightedPalette || weightedPalette.length === 0) {
      return [];
    }

    // Separate text-matched colors from others
    const textMatchedColors = weightedPalette.filter(item => item.textMatch);
    const nonTextColors = weightedPalette.filter(item => !item.textMatch);

    // Guarantee first N slots for text-matched colors (if available)
    const guaranteedTextColors = textMatchedColors.slice(0, minTextColors);

    // Fill remaining slots with highest-weighted non-text colors
    const remainingSlots = maxColors - guaranteedTextColors.length;
    const remainingColors = nonTextColors.slice(0, Math.max(0, remainingSlots));

    // Combine and extract RGB arrays
    const finalPalette = [...guaranteedTextColors, ...remainingColors];

    console.log(`[Season Color Checker] Final palette selection: ${guaranteedTextColors.length} text-matched + ${remainingColors.length} visual = ${finalPalette.length} total colors`);

    return finalPalette.map(item => item.rgb);
  }

  // Export for use in extension
  if (typeof window !== 'undefined') {
    window.applyTextColorWeighting = applyTextColorWeighting;
    window.augmentPaletteWithTextColors = augmentPaletteWithTextColors;
    window.calculateColorWeight = calculateColorWeight;
    window.reconcileConflictingColors = reconcileConflictingColors;
    window.selectFinalPalette = selectFinalPalette;
  }

})();
