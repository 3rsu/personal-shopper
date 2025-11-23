/**
 * SEASONAL COLOR PALETTES
 *
 * Based on professional seasonal color analysis theory.
 * Each season contains 15 carefully curated colors representing the palette's core characteristics.
 *
 * Color Theory:
 * - SPRING: Warm, clear, bright colors with yellow undertones
 * - SUMMER: Cool, soft, muted colors with blue undertones
 * - AUTUMN: Warm, rich, earthy colors with golden undertones
 * - WINTER: Cool, clear, vivid colors with blue undertones
 */

const SEASONAL_PALETTES = {
  spring: {
    name: 'Spring',
    description: 'Warm, clear, and bright colors',
    colors: [
      '#FFE5B4', // Peach
      '#FFB6C1', // Light Pink
      '#FFD700', // Golden Yellow
      '#FF6347', // Coral/Tomato
      '#FFA07A', // Light Salmon
      '#98FB98', // Pale Green
      '#87CEEB', // Sky Blue
      '#F0E68C', // Khaki
      '#FFDAB9', // Peach Puff
      '#FA8072', // Salmon
      '#FFE4B5', // Moccasin
      '#7FFFD4', // Aquamarine
      '#F08080', // Light Coral
      '#FFEFD5', // Papaya Whip
      '#90EE90'  // Light Green
    ]
  },

  summer: {
    name: 'Summer',
    description: 'Cool, soft, and muted colors',
    colors: [
      '#E6E6FA', // Lavender
      '#B0C4DE', // Light Steel Blue
      '#DDA0DD', // Plum
      '#F0F8FF', // Alice Blue
      '#D8BFD8', // Thistle
      '#AFEEEE', // Pale Turquoise
      '#C0C0C0', // Silver
      '#FFB6C1', // Light Pink
      '#E0B0FF', // Mauve
      '#B0E0E6', // Powder Blue
      '#D3D3D3', // Light Gray
      '#F5F5DC', // Beige
      '#FADADD', // Pink
      '#87CEEB', // Sky Blue
      '#C5B4E3'  // Periwinkle
    ]
  },

  autumn: {
    name: 'Autumn',
    description: 'Warm, rich, and earthy colors',
    colors: [
      '#8B4513', // Saddle Brown
      '#D2691E', // Chocolate
      '#CD853F', // Peru
      '#DEB887', // Burlywood
      '#DAA520', // Goldenrod
      '#B8860B', // Dark Goldenrod
      '#BC8F8F', // Rosy Brown
      '#F4A460', // Sandy Brown
      '#6B8E23', // Olive Drab
      '#8B7355', // Burlywood Dark
      '#A0522D', // Sienna
      '#C04000', // Rust
      '#704214', // Sepia
      '#CC7722', // Ochre
      '#556B2F'  // Dark Olive Green
    ]
  },

  winter: {
    name: 'Winter',
    description: 'Cool, clear, and vivid colors',
    colors: [
      '#000000', // Black
      '#FFFFFF', // Pure White
      '#FF0000', // True Red
      '#0000FF', // Royal Blue
      '#FF00FF', // Magenta
      '#4B0082', // Indigo
      '#00FFFF', // Cyan
      '#800080', // Purple
      '#DC143C', // Crimson
      '#2F4F4F', // Dark Slate Gray
      '#191970', // Midnight Blue
      '#8B008B', // Dark Magenta
      '#C0C0C0', // Silver
      '#483D8B', // Dark Slate Blue
      '#FF1493'  // Deep Pink
    ]
  }
};

// Make available globally for content scripts
if (typeof window !== 'undefined') {
  window.SEASONAL_PALETTES = SEASONAL_PALETTES;
}

// Export for module usage (service worker)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SEASONAL_PALETTES;
}
