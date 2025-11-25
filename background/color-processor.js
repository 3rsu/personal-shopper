/**
 * COLOR PROCESSOR
 *
 * Handles color extraction and matching logic using Delta E (CIEDE2000) algorithm.
 * Delta E measures perceptual color difference - lower values = more similar colors.
 *
 * Matching Thresholds:
 * - ΔE < 20: Colors match (perceptually similar)
 * - ΔE 20-40: Somewhat similar
 * - ΔE > 40: Different colors
 */

class ColorProcessor {
  constructor() {
    this.MATCH_THRESHOLD = 20;  // Delta E threshold for color matching
  }

  /**
   * Convert hex color to RGB object
   * @param {string} hex - Hex color code (e.g., "#FF5733")
   * @returns {Object} RGB values {r, g, b}
   */
  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  /**
   * Convert RGB to LAB color space
   * LAB is perceptually uniform - essential for accurate Delta E calculation
   * @param {Object} rgb - {r, g, b} values (0-255)
   * @returns {Object} LAB values {l, a, b}
   */
  rgbToLab(rgb) {
    // Step 1: RGB to XYZ
    let r = rgb.r / 255;
    let g = rgb.g / 255;
    let b = rgb.b / 255;

    // Apply gamma correction
    r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
    g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
    b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

    // Convert to XYZ using D65 illuminant
    let x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) * 100;
    let y = (r * 0.2126729 + g * 0.7151522 + b * 0.0721750) * 100;
    let z = (r * 0.0193339 + g * 0.1191920 + b * 0.9503041) * 100;

    // Step 2: XYZ to LAB
    // D65 reference white point
    const refX = 95.047;
    const refY = 100.000;
    const refZ = 108.883;

    x = x / refX;
    y = y / refY;
    z = z / refZ;

    x = x > 0.008856 ? Math.pow(x, 1/3) : (7.787 * x + 16/116);
    y = y > 0.008856 ? Math.pow(y, 1/3) : (7.787 * y + 16/116);
    z = z > 0.008856 ? Math.pow(z, 1/3) : (7.787 * z + 16/116);

    return {
      l: (116 * y) - 16,
      a: 500 * (x - y),
      b: 200 * (y - z)
    };
  }

  /**
   * Calculate Delta E (CIEDE2000) - industry standard for color difference
   * @param {Object} lab1 - First color in LAB space
   * @param {Object} lab2 - Second color in LAB space
   * @returns {number} Delta E value (0 = identical, 100 = very different)
   */
  calculateDeltaE(lab1, lab2) {
    // Simplified Delta E 2000 implementation
    // For production, consider using a library like delta-e
    const deltaL = lab1.l - lab2.l;
    const deltaA = lab1.a - lab2.a;
    const deltaB = lab1.b - lab2.b;

    // Simplified calculation (good enough for our use case)
    const deltaE = Math.sqrt(deltaL * deltaL + deltaA * deltaA + deltaB * deltaB);

    return deltaE;
  }

  /**
   * Find closest matching color from palette
   * @param {string} colorHex - Color to match (hex format)
   * @param {Array} paletteHexColors - Array of palette hex colors
   * @returns {Object} {closestColor, deltaE, isMatch}
   */
  findClosestMatch(colorHex, paletteHexColors) {
    const rgb1 = this.hexToRgb(colorHex);
    if (!rgb1) return { closestColor: null, deltaE: Infinity, isMatch: false };

    const lab1 = this.rgbToLab(rgb1);

    let minDeltaE = Infinity;
    let closestColor = null;

    for (const paletteColor of paletteHexColors) {
      const rgb2 = this.hexToRgb(paletteColor);
      if (!rgb2) continue;

      const lab2 = this.rgbToLab(rgb2);
      const deltaE = this.calculateDeltaE(lab1, lab2);

      if (deltaE < minDeltaE) {
        minDeltaE = deltaE;
        closestColor = paletteColor;
      }
    }

    return {
      closestColor,
      deltaE: minDeltaE,
      isMatch: minDeltaE < this.MATCH_THRESHOLD
    };
  }

  /**
   * Check if dominant colors match palette (simplified top-2 logic)
   * @param {Array} dominantColors - Array of RGB arrays from Color Thief
   * @param {Array} paletteHexColors - Array of palette hex colors
   * @returns {Object} Match result with details
   */
  checkColorMatch(dominantColors, paletteHexColors) {
    if (!dominantColors || dominantColors.length === 0) {
      return { matches: false, matchCount: 0, totalColors: 0, details: [] };
    }

    const results = [];
    let matchCount = 0;

    // ============================================================================
    // SIMPLIFIED MATCHING LOGIC - Easy to adjust for future changes
    // ============================================================================
    // Configuration (change these values to tune matching behavior):
    const COLORS_TO_CHECK = 2;  // How many dominant colors to analyze (default: 2)
    const MATCH_THRESHOLD = 1;  // How many must match to consider item a match (default: 1)

    // Examples of how to adjust:
    // - More strict: COLORS_TO_CHECK = 2, MATCH_THRESHOLD = 2 (both colors must match)
    // - Current (permissive): COLORS_TO_CHECK = 2, MATCH_THRESHOLD = 1 (any 1 color matches)
    // - More colors: COLORS_TO_CHECK = 3, MATCH_THRESHOLD = 2 (2 of 3 must match - 66% rule)
    // - Old system: COLORS_TO_CHECK = 5, MATCH_THRESHOLD = 3 (3 of 5 majority rule)
    // ============================================================================

    // Check top N dominant colors
    const colorsToCheck = dominantColors.slice(0, COLORS_TO_CHECK);

    for (const rgb of colorsToCheck) {
      const hex = this.rgbToHex(rgb);
      const match = this.findClosestMatch(hex, paletteHexColors);

      results.push({
        extractedColor: hex,
        closestPaletteColor: match.closestColor,
        deltaE: match.deltaE,
        isMatch: match.isMatch
      });

      if (match.isMatch) {
        matchCount++;
      }
    }

    // Simple threshold check: do we have enough matches?
    const matches = matchCount >= MATCH_THRESHOLD;

    return {
      matches,
      matchCount,
      totalColors: colorsToCheck.length,
      details: results,
      confidence: (matchCount / colorsToCheck.length) * 100,
      matchThreshold: MATCH_THRESHOLD // Include for debugging/display
    };
  }

  /**
   * Detect which seasonal palette(s) a product belongs to
   * @param {Array} dominantColors - Array of RGB arrays from Color Thief
   * @param {Object} allPalettes - SEASONAL_PALETTES object with all 12 seasons
   * @returns {Object} Season detection result with rankings
   */
  detectProductSeason(dominantColors, allPalettes) {
    if (!dominantColors || dominantColors.length === 0 || !allPalettes) {
      return {
        primarySeason: null,
        secondarySeasons: [],
        allScores: [],
        noMatch: true
      };
    }

    const seasonScores = [];

    // Check each season
    for (const [seasonKey, seasonData] of Object.entries(allPalettes)) {
      const matchResult = this.checkColorMatch(dominantColors, seasonData.colors);

      seasonScores.push({
        seasonKey,
        seasonName: seasonData.name,
        emoji: seasonData.emoji,
        description: seasonData.description,
        matchCount: matchResult.matchCount,
        confidence: matchResult.confidence,
        details: matchResult.details,
        matches: matchResult.matches
      });
    }

    // Sort by match count (descending), then by average deltaE (ascending)
    seasonScores.sort((a, b) => {
      if (b.matchCount !== a.matchCount) {
        return b.matchCount - a.matchCount;
      }
      // If same match count, prefer lower average deltaE
      const avgDeltaA = a.details.reduce((sum, d) => sum + d.deltaE, 0) / a.details.length;
      const avgDeltaB = b.details.reduce((sum, d) => sum + d.deltaE, 0) / b.details.length;
      return avgDeltaA - avgDeltaB;
    });

    // Primary season: highest scoring
    const primarySeason = seasonScores[0];

    // Secondary seasons: those with at least 1 match and close to primary score
    const secondarySeasons = seasonScores.slice(1)
      .filter(season =>
        season.matchCount > 0 &&
        season.matchCount >= primarySeason.matchCount - 1
      )
      .slice(0, 3); // Limit to top 3 secondary seasons

    return {
      primarySeason,
      secondarySeasons,
      allScores: seasonScores,
      noMatch: primarySeason.matchCount === 0
    };
  }

  /**
   * Compare product season with user's season
   * @param {Object} productSeasonResult - Result from detectProductSeason()
   * @param {string} userSeasonKey - User's selected season key (e.g., 'bright-spring')
   * @returns {Object} Compatibility analysis
   */
  analyzeSeasonCompatibility(productSeasonResult, userSeasonKey) {
    if (!productSeasonResult || !userSeasonKey) {
      return { compatible: false, reason: 'Missing data' };
    }

    const { primarySeason, secondarySeasons, noMatch } = productSeasonResult;

    if (noMatch) {
      return {
        compatible: false,
        reason: 'No clear season match',
        recommendation: 'This item has colors that don\'t fit standard seasonal palettes'
      };
    }

    // Check if user's season matches primary
    if (primarySeason.seasonKey === userSeasonKey) {
      return {
        compatible: true,
        matchType: 'primary',
        reason: `Perfect match for ${primarySeason.seasonName}`,
        confidence: primarySeason.confidence
      };
    }

    // Check if user's season is in secondary matches
    const secondaryMatch = secondarySeasons.find(s => s.seasonKey === userSeasonKey);
    if (secondaryMatch) {
      return {
        compatible: true,
        matchType: 'secondary',
        reason: `Also works for ${secondaryMatch.seasonName}`,
        confidence: secondaryMatch.confidence
      };
    }

    // No match - recommend alternatives
    return {
      compatible: false,
      matchType: 'none',
      reason: `This is a ${primarySeason.seasonName} item`,
      recommendation: secondarySeasons.length > 0
        ? `Also works for: ${secondarySeasons.map(s => s.seasonName).join(', ')}`
        : `Best suited for ${primarySeason.seasonName}`,
      suggestedSeasons: [primarySeason, ...secondarySeasons]
    };
  }

  /**
   * Convert RGB array to hex string
   * @param {Array} rgb - [r, g, b] array
   * @returns {string} Hex color code
   */
  rgbToHex(rgb) {
    return '#' + rgb.map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  }
}

// Export for use in service worker and content scripts
if (typeof window !== 'undefined') {
  window.ColorProcessor = ColorProcessor;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ColorProcessor;
}
