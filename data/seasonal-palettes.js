/**
 * SEASONAL COLOR PALETTES
 *
 * Based on 12-season professional color analysis theory.
 * Each palette contains 15-18 carefully curated colors.
 *
 * Color Theory:
 * - BRIGHT/CLEAR: High contrast, vivid, pure colors
 * - SOFT/MUTED: Low contrast, grayed, gentle colors
 * - WARM: Yellow/golden undertones
 * - COOL: Blue/pink undertones
 * - DEEP/DARK: Rich, intense, darker colors
 * - LIGHT: Pale, delicate, pastel colors
 */

const SEASONAL_PALETTES = {
  // SPRING VARIATIONS
  'bright-spring': {
    name: 'Bright Spring',
    description: 'Warm, clear, vivid colors',
    emoji: '🌺',
    colors: [
      '#FF6347', // Bright Coral
      '#FFD700', // Golden Yellow
      '#FF69B4', // Hot Pink
      '#00CED1', // Turquoise
      '#FF8C00', // Dark Orange
      '#32CD32', // Lime Green
      '#FF1493', // Deep Pink
      '#00BFFF', // Deep Sky Blue
      '#FFB6C1', // Light Pink
      '#FFA500', // Orange
      '#98FB98', // Pale Green
      '#87CEEB', // Sky Blue
      '#FF4500', // Orange Red
      '#7FFF00', // Chartreuse
      '#FF69B4'  // Hot Pink
    ]
  },

  'warm-spring': {
    name: 'Warm Spring',
    description: 'Warm, golden, peachy colors',
    emoji: '🌸',
    colors: [
      '#FFE5B4', // Peach
      '#FFDAB9', // Peach Puff
      '#FFD700', // Golden Yellow
      '#FFA07A', // Light Salmon
      '#F0E68C', // Khaki
      '#FA8072', // Salmon
      '#FFE4B5', // Moccasin
      '#FF6347', // Tomato
      '#F08080', // Light Coral
      '#FFEFD5', // Papaya Whip
      '#98FB98', // Pale Green
      '#7FFFD4', // Aquamarine
      '#FFB6C1', // Light Pink
      '#90EE90', // Light Green
      '#FFDB58'  // Mustard
    ]
  },

  'light-spring': {
    name: 'Light Spring',
    description: 'Warm, light, delicate pastels',
    emoji: '🌼',
    colors: [
      '#FFF8DC', // Cornsilk
      '#FFE4E1', // Misty Rose
      '#FFFACD', // Lemon Chiffon
      '#FFE4B5', // Moccasin
      '#FAFAD2', // Light Goldenrod
      '#F0E68C', // Khaki
      '#EEE8AA', // Pale Goldenrod
      '#FFB6C1', // Light Pink
      '#FFDAB9', // Peach Puff
      '#E0FFFF', // Light Cyan
      '#F5FFFA', // Mint Cream
      '#FFF0F5', // Lavender Blush
      '#FFFAF0', // Floral White
      '#F0FFF0', // Honeydew
      '#FFE4E1'  // Misty Rose
    ]
  },

  // SUMMER VARIATIONS
  'soft-summer': {
    name: 'Soft Summer',
    description: 'Cool, muted, gentle colors',
    emoji: '🌿',
    colors: [
      '#E6E6FA', // Lavender
      '#D8BFD8', // Thistle
      '#DDA0DD', // Plum
      '#C5B4E3', // Periwinkle
      '#B0C4DE', // Light Steel Blue
      '#B0E0E6', // Powder Blue
      '#AFEEEE', // Pale Turquoise
      '#D3D3D3', // Light Gray
      '#C0C0C0', // Silver
      '#F5F5DC', // Beige
      '#E0B0FF', // Mauve
      '#FADADD', // Pink
      '#C9C0BB', // Mushroom
      '#B8B4A1', // Sage
      '#CBBEB5'  // Dusty Rose
    ]
  },

  'cool-summer': {
    name: 'Cool Summer',
    description: 'Cool, soft, blue-based colors',
    emoji: '🌊',
    colors: [
      '#B0E0E6', // Powder Blue
      '#87CEEB', // Sky Blue
      '#ADD8E6', // Light Blue
      '#B0C4DE', // Light Steel Blue
      '#AFEEEE', // Pale Turquoise
      '#E0FFFF', // Light Cyan
      '#F0F8FF', // Alice Blue
      '#E6E6FA', // Lavender
      '#D8BFD8', // Thistle
      '#DDA0DD', // Plum
      '#FFB6C1', // Light Pink
      '#FFE4E1', // Misty Rose
      '#F0E68C', // Khaki
      '#C0C0C0', // Silver
      '#B0E0E6'  // Powder Blue
    ]
  },

  'light-summer': {
    name: 'Light Summer',
    description: 'Cool, light, airy pastels',
    emoji: '☁️',
    colors: [
      '#F0F8FF', // Alice Blue
      '#F5FFFA', // Mint Cream
      '#F0FFF0', // Honeydew
      '#FFFAF0', // Floral White
      '#FFF0F5', // Lavender Blush
      '#E6E6FA', // Lavender
      '#F0FFFF', // Azure
      '#E0FFFF', // Light Cyan
      '#FFE4E1', // Misty Rose
      '#FFDAB9', // Peach Puff
      '#EEE8AA', // Pale Goldenrod
      '#F5F5DC', // Beige
      '#FAF0E6', // Linen
      '#FFF5EE', // Seashell
      '#F8F8FF'  // Ghost White
    ]
  },

  // AUTUMN VARIATIONS
  'deep-autumn': {
    name: 'Deep Autumn',
    description: 'Warm, rich, intense colors',
    emoji: '🍁',
    colors: [
      '#8B4513', // Saddle Brown
      '#A0522D', // Sienna
      '#D2691E', // Chocolate
      '#B8860B', // Dark Goldenrod
      '#8B0000', // Dark Red
      '#800000', // Maroon
      '#556B2F', // Dark Olive Green
      '#6B8E23', // Olive Drab
      '#8B4789', // Dark Orchid (warm)
      '#704214', // Sepia
      '#654321', // Dark Brown
      '#8B7355', // Burlywood Dark
      '#C04000', // Mahogany
      '#5C4033', // Coffee
      '#3B2F2F'  // Dark Charcoal
    ]
  },

  'warm-autumn': {
    name: 'Warm Autumn',
    description: 'Warm, golden, earthy colors',
    emoji: '🍂',
    colors: [
      '#D2691E', // Chocolate
      '#CD853F', // Peru
      '#DEB887', // Burlywood
      '#DAA520', // Goldenrod
      '#B8860B', // Dark Goldenrod
      '#F4A460', // Sandy Brown
      '#BC8F8F', // Rosy Brown
      '#CC7722', // Ochre
      '#FF8C00', // Dark Orange
      '#FFA500', // Orange
      '#C19A6B', // Camel
      '#826644', // Raw Umber
      '#E97451', // Burnt Sienna
      '#6B8E23', // Olive
      '#8B7355'  // Burlywood Dark
    ]
  },

  'soft-autumn': {
    name: 'Soft Autumn',
    description: 'Warm, muted, gentle earth tones',
    emoji: '🌾',
    colors: [
      '#DEB887', // Burlywood
      '#D2B48C', // Tan
      '#BC8F8F', // Rosy Brown
      '#F5DEB3', // Wheat
      '#FFE4C4', // Bisque
      '#FFDEAD', // Navajo White
      '#BDB76B', // Dark Khaki
      '#DAA520', // Goldenrod
      '#C19A6B', // Camel
      '#B8860B', // Dark Goldenrod
      '#CD853F', // Peru
      '#A0522D', // Sienna
      '#9C8D7B', // Warm Gray
      '#8B7D6B', // Taupe
      '#C4A582'  // Desert Sand
    ]
  },

  // WINTER VARIATIONS
  'bright-winter': {
    name: 'Bright Winter',
    description: 'Cool, clear, highly saturated',
    emoji: '💎',
    colors: [
      '#FF0000', // True Red
      '#0000FF', // Royal Blue
      '#FF00FF', // Magenta
      '#00FFFF', // Cyan
      '#FF1493', // Deep Pink
      '#00FF00', // Lime
      '#FFD700', // Gold
      '#8B00FF', // Electric Violet
      '#FF4500', // Orange Red
      '#1E90FF', // Dodger Blue
      '#FF69B4', // Hot Pink
      '#00CED1', // Dark Turquoise
      '#FF6347', // Tomato
      '#4169E1', // Royal Blue
      '#FF1493'  // Deep Pink
    ]
  },

  'cool-winter': {
    name: 'Cool Winter',
    description: 'Cool, icy, blue-based colors',
    emoji: '❄️',
    colors: [
      '#000000', // Black
      '#FFFFFF', // Pure White
      '#0000FF', // Royal Blue
      '#4B0082', // Indigo
      '#191970', // Midnight Blue
      '#483D8B', // Dark Slate Blue
      '#6A5ACD', // Slate Blue
      '#C71585', // Medium Violet Red
      '#8B008B', // Dark Magenta
      '#4682B4', // Steel Blue
      '#2F4F4F', // Dark Slate Gray
      '#708090', // Slate Gray
      '#B0C4DE', // Light Steel Blue
      '#E6E6FA', // Lavender
      '#C0C0C0'  // Silver
    ]
  },

  'deep-winter': {
    name: 'Deep Winter',
    description: 'Cool, dark, intense colors',
    emoji: '🌑',
    colors: [
      '#000000', // Black
      '#8B008B', // Dark Magenta
      '#800080', // Purple
      '#4B0082', // Indigo
      '#191970', // Midnight Blue
      '#000080', // Navy
      '#800000', // Maroon
      '#8B0000', // Dark Red
      '#2F4F4F', // Dark Slate Gray
      '#0B1F3E', // Oxford Blue
      '#1C1C1C', // Eerie Black
      '#483D8B', // Dark Slate Blue
      '#DC143C', // Crimson
      '#8B4513', // Dark Brown
      '#2C1E3F'  // Dark Purple
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
