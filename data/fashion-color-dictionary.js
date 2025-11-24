/**
 * FASHION COLOR DICTIONARY
 *
 * Comprehensive mapping of color names to hex values.
 * Includes:
 * - 140 CSS named colors
 * - 100+ fashion industry color extensions
 * - Common aliases and variations
 * - Multi-word descriptive colors
 */

// CSS Named Colors (140 standard colors)
const CSS_COLORS = {
  // Reds
  'red': '#FF0000',
  'darkred': '#8B0000',
  'indianred': '#CD5C5C',
  'lightcoral': '#F08080',
  'salmon': '#FA8072',
  'darksalmon': '#E9967A',
  'lightsalmon': '#FFA07A',
  'crimson': '#DC143C',
  'firebrick': '#B22222',

  // Pinks
  'pink': '#FFC0CB',
  'lightpink': '#FFB6C1',
  'hotpink': '#FF69B4',
  'deeppink': '#FF1493',
  'mediumvioletred': '#C71585',
  'palevioletred': '#DB7093',

  // Oranges
  'orange': '#FFA500',
  'darkorange': '#FF8C00',
  'coral': '#FF7F50',
  'tomato': '#FF6347',
  'orangered': '#FF4500',

  // Yellows
  'yellow': '#FFFF00',
  'gold': '#FFD700',
  'lightyellow': '#FFFFE0',
  'lemonchiffon': '#FFFACD',
  'lightgoldenrodyellow': '#FAFAD2',
  'papayawhip': '#FFEFD5',
  'moccasin': '#FFE4B5',
  'peachpuff': '#FFDAB9',
  'palegoldenrod': '#EEE8AA',
  'khaki': '#F0E68C',
  'darkkhaki': '#BDB76B',

  // Purples
  'purple': '#800080',
  'lavender': '#E6E6FA',
  'thistle': '#D8BFD8',
  'plum': '#DDA0DD',
  'violet': '#EE82EE',
  'orchid': '#DA70D6',
  'fuchsia': '#FF00FF',
  'magenta': '#FF00FF',
  'mediumorchid': '#BA55D3',
  'mediumpurple': '#9370DB',
  'rebeccapurple': '#663399',
  'blueviolet': '#8A2BE2',
  'darkviolet': '#9400D3',
  'darkorchid': '#9932CC',
  'darkmagenta': '#8B008B',
  'indigo': '#4B0082',
  'slateblue': '#6A5ACD',
  'darkslateblue': '#483D8B',
  'mediumslateblue': '#7B68EE',

  // Greens
  'green': '#008000',
  'darkgreen': '#006400',
  'lime': '#00FF00',
  'limegreen': '#32CD32',
  'lightgreen': '#90EE90',
  'palegreen': '#98FB98',
  'darkseagreen': '#8FBC8F',
  'mediumspringgreen': '#00FA9A',
  'springgreen': '#00FF7F',
  'seagreen': '#2E8B57',
  'mediumseagreen': '#3CB371',
  'forestgreen': '#228B22',
  'olive': '#808000',
  'darkolivegreen': '#556B2F',
  'olivedrab': '#6B8E23',
  'yellowgreen': '#9ACD32',
  'lawngreen': '#7CFC00',
  'chartreuse': '#7FFF00',
  'greenyellow': '#ADFF2F',

  // Cyans/Teals
  'aqua': '#00FFFF',
  'cyan': '#00FFFF',
  'lightcyan': '#E0FFFF',
  'paleturquoise': '#AFEEEE',
  'aquamarine': '#7FFFD4',
  'turquoise': '#40E0D0',
  'mediumturquoise': '#48D1CC',
  'darkturquoise': '#00CED1',
  'lightseagreen': '#20B2AA',
  'cadetblue': '#5F9EA0',
  'darkcyan': '#008B8B',
  'teal': '#008080',

  // Blues
  'blue': '#0000FF',
  'lightblue': '#ADD8E6',
  'powderblue': '#B0E0E6',
  'lightskyblue': '#87CEFA',
  'skyblue': '#87CEEB',
  'deepskyblue': '#00BFFF',
  'dodgerblue': '#1E90FF',
  'cornflowerblue': '#6495ED',
  'steelblue': '#4682B4',
  'royalblue': '#4169E1',
  'mediumblue': '#0000CD',
  'darkblue': '#00008B',
  'navy': '#000080',
  'midnightblue': '#191970',

  // Browns
  'brown': '#A52A2A',
  'maroon': '#800000',
  'rosybrown': '#BC8F8F',
  'saddlebrown': '#8B4513',
  'sienna': '#A0522D',
  'chocolate': '#D2691E',
  'peru': '#CD853F',
  'sandybrown': '#F4A460',
  'burlywood': '#DEB887',
  'tan': '#D2B48C',
  'wheat': '#F5DEB3',

  // Whites
  'white': '#FFFFFF',
  'snow': '#FFFAFA',
  'honeydew': '#F0FFF0',
  'mintcream': '#F5FFFA',
  'azure': '#F0FFFF',
  'aliceblue': '#F0F8FF',
  'ghostwhite': '#F8F8FF',
  'whitesmoke': '#F5F5F5',
  'seashell': '#FFF5EE',
  'beige': '#F5F5DC',
  'oldlace': '#FDF5E6',
  'floralwhite': '#FFFAF0',
  'ivory': '#FFFFF0',
  'antiquewhite': '#FAEBD7',
  'linen': '#FAF0E6',
  'lavenderblush': '#FFF0F5',
  'mistyrose': '#FFE4E1',

  // Grays
  'black': '#000000',
  'darkslategray': '#2F4F4F',
  'dimgray': '#696969',
  'slategray': '#708090',
  'gray': '#808080',
  'lightslategray': '#778899',
  'darkgray': '#A9A9A9',
  'silver': '#C0C0C0',
  'lightgray': '#D3D3D3',
  'gainsboro': '#DCDCDC'
};

// Fashion Industry Color Extensions
const FASHION_COLORS = {
  // Reds - Fashion
  'burgundy': '#800020',
  'wine': '#722F37',
  'brick': '#CB4154',
  'rust': '#B7410E',
  'cherry': '#DE3163',
  'scarlet': '#FF2400',
  'ruby': '#E0115F',
  'garnet': '#733635',

  // Blues - Fashion
  'cobalt': '#0047AB',
  'cerulean': '#007BA7',
  'sapphire': '#0F52BA',
  'denim': '#1560BD',
  'periwinkle': '#CCCCFF',
  'electric blue': '#7DF9FF',

  // Greens - Fashion
  'emerald': '#50C878',
  'jade': '#00A86B',
  'sage': '#9DC183',
  'mint': '#98FF98',
  'pistachio': '#93C572',
  'moss': '#8A9A5B',
  'hunter green': '#355E3B',

  // Neutrals - Fashion
  'cream': '#FFFDD0',
  'ecru': '#C2B280',
  'taupe': '#483C32',
  'charcoal': '#36454F',
  'slate': '#708090',
  'stone': '#928E85',
  'ash': '#B2BEB5',
  'pewter': '#96A8A1',
  'graphite': '#383428',

  // Pinks/Purples - Fashion
  'blush': '#DE5D83',
  'rose': '#FF007F',
  'mauve': '#E0B0FF',
  'lilac': '#C8A2C8',
  'amethyst': '#9966CC',
  'eggplant': '#614051',

  // Oranges/Yellows - Fashion
  'peach': '#FFE5B4',
  'apricot': '#FBCEB1',
  'tangerine': '#F28500',
  'mustard': '#FFDB58',
  'amber': '#FFBF00',
  'honey': '#FFB30F',
  'caramel': '#C68E17',
  'butterscotch': '#E2A76F',

  // Browns - Fashion
  'camel': '#C19A6B',
  'mocha': '#967969',
  'coffee': '#6F4E37',
  'espresso': '#4E312D',
  'cinnamon': '#D2691E',
  'chestnut': '#954535',
  'mahogany': '#C04000',
  'umber': '#635147',

  // Metallics
  'platinum': '#E5E4E2',
  'bronze': '#CD7F32',
  'copper': '#B87333',
  'brass': '#B5A642',
  'rose gold': '#B76E79',
  'champagne': '#F7E7CE'
};

// Multi-word Color Patterns
const MULTI_WORD_COLORS = {
  'forest green': '#228B22',
  'sky blue': '#87CEEB',
  'hot pink': '#FF69B4',
  'lime green': '#32CD32',
  'burnt orange': '#CC5500',
  'dusty rose': '#DCAE96',
  'powder blue': '#B0E0E6',
  'olive green': '#808000',
  'navy blue': '#000080',
  'royal blue': '#4169E1',
  'light blue': '#ADD8E6',
  'dark blue': '#00008B',
  'light green': '#90EE90',
  'dark green': '#006400',
  'light pink': '#FFB6C1',
  'dark pink': '#E75480',
  'light purple': '#B19CD9',
  'dark purple': '#301934',
  'light gray': '#D3D3D3',
  'dark gray': '#A9A9A9',
  'light brown': '#B5651D',
  'dark brown': '#654321',
  'bright red': '#FF0000',
  'bright blue': '#0096FF',
  'bright green': '#66FF00',
  'bright yellow': '#FFFD01',
  'bright orange': '#FFB600',
  'bright pink': '#FF007F',
  'pale blue': '#AFEEEE',
  'pale green': '#98FB98',
  'pale pink': '#FADADD',
  'pale yellow': '#FFFF99',
  'deep red': '#8B0000',
  'deep blue': '#00008B',
  'deep green': '#013220',
  'deep purple': '#301934',
  'soft pink': '#FFB6C1',
  'soft blue': '#A8C7DD',
  'soft green': '#8FBC8F',
  'pastel pink': '#FFD1DC',
  'pastel blue': '#AEC6CF',
  'pastel green': '#77DD77',
  'pastel yellow': '#FDFD96',
  'pastel purple': '#B39EB5',
  'warm gray': '#8D8D86',
  'cool gray': '#8C92AC'
};

// Combined dictionary
const FASHION_COLOR_DICTIONARY = {
  ...CSS_COLORS,
  ...FASHION_COLORS,
  ...MULTI_WORD_COLORS
};

// Color name aliases
const COLOR_ALIASES = {
  'grey': 'gray',
  'lightgrey': 'lightgray',
  'darkgrey': 'darkgray',
  'dimgrey': 'dimgray',
  'slategrey': 'slategray',
  'lightslategrey': 'lightslategray',
  'darkslategrey': 'darkslategray',
  'aqua': 'cyan'
};

/**
 * Normalize color name for lookup
 */
function normalizeColorName(colorName) {
  if (!colorName) return '';

  let normalized = colorName.toLowerCase().trim();

  // Remove common modifiers that don't change base color significantly
  normalized = normalized
    .replace(/\s+(colored?|shade|tone|hue)$/i, '')
    .replace(/^(solid|pure|true)\s+/i, '');

  // Apply aliases
  if (COLOR_ALIASES[normalized]) {
    normalized = COLOR_ALIASES[normalized];
  }

  return normalized;
}

/**
 * Get hex color from color name
 */
function getColorHex(colorName) {
  const normalized = normalizeColorName(colorName);
  return FASHION_COLOR_DICTIONARY[normalized] || null;
}

/**
 * Get RGB array from color name
 */
function getColorRgb(colorName) {
  const hex = getColorHex(colorName);
  if (!hex) return null;

  // Convert hex to RGB
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ] : null;
}

/**
 * Check if color name exists in dictionary
 */
function isValidColorName(colorName) {
  const normalized = normalizeColorName(colorName);
  return FASHION_COLOR_DICTIONARY.hasOwnProperty(normalized);
}

/**
 * Get all color names (for pattern matching)
 */
function getAllColorNames() {
  return Object.keys(FASHION_COLOR_DICTIONARY);
}

// Export for use in extension
if (typeof window !== 'undefined') {
  window.FASHION_COLOR_DICTIONARY = FASHION_COLOR_DICTIONARY;
  window.normalizeColorName = normalizeColorName;
  window.getColorHex = getColorHex;
  window.getColorRgb = getColorRgb;
  window.isValidColorName = isValidColorName;
  window.getAllColorNames = getAllColorNames;
}
