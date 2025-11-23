# Manual Color Picker (Eyedropper) Feature

## Overview

The Manual Color Picker allows users to manually select any color from a webpage and check if it matches their selected seasonal color palette. This feature solves the CORS limitation of the automatic color detection by sampling pixels directly from the rendered page.

---

## Features

### ✨ Core Capabilities

- **Real-time Color Sampling**: Hover over any element to see its color
- **Magnifier Preview**: 5x zoomed view with live color preview
- **Cross-hair Cursor**: Clear visual indicator during color picking
- **CORS-Safe**: Works on ALL websites including CDN-hosted images
- **Instant Analysis**: Immediate palette match results using Delta E color difference
- **Color History**: Stores last 50 picked colors with match results
- **Shadow DOM Isolation**: UI doesn't conflict with site styles

### 🎯 Match Analysis

- Uses the same Delta E (CIEDE2000) algorithm as auto-detect
- Match threshold: ΔE < 20 (industry-standard perceptual difference)
- Shows closest palette match color
- Displays distance score for transparency

---

## How to Use

### 1. **Select Your Season**
   - Open the extension popup
   - Choose your seasonal color palette (e.g., "Bright Spring", "Deep Winter")

### 2. **Activate Eyedropper**
   - Click the **"Pick a Color"** button in the popup
   - The popup will close automatically

### 3. **Pick a Color**
   - Your cursor becomes a crosshair
   - A magnifier follows your cursor showing:
     - 5x zoomed pixels
     - Current color hex value
     - Instructions
   - **Click** to capture the color
   - **ESC key** to cancel

### 4. **View Results**
   - A result card appears showing:
     - Color swatch
     - Hex value
     - Match status (✓ or ✗)
     - Closest palette color
     - Delta E distance
   - Results auto-fade after 5 seconds

### 5. **View History**
   - Open popup to see recently picked colors
   - Last 5 colors displayed with match status
   - Full history (50 colors) stored locally

---

## File Structure

```
season-color-checker/
├── content/
│   ├── eyedropper.js        # Core eyedropper logic (NEW)
│   ├── eyedropper.css       # Global styles (NEW)
│   ├── content.js           # Auto-detect (unchanged)
│   └── overlay.js           # Stats widget (unchanged)
├── popup/
│   ├── popup.html           # Added picker UI (MODIFIED)
│   ├── popup.js             # Added picker handlers (MODIFIED)
│   └── popup.css            # Added picker styles (MODIFIED)
├── background/
│   ├── service-worker.js    # Added eyedropper messages (MODIFIED)
│   └── color-processor.js   # Color matching (unchanged)
├── manifest.json            # Added web_accessible_resources (MODIFIED)
└── EYEDROPPER-FEATURE.md    # This file (NEW)
```

---

## Technical Details

### How CORS is Bypassed

The auto-detect feature fails on CORS-protected images because it tries to:
1. Load the image via `<img>` tag
2. Draw it to a canvas
3. Read pixel data with `getImageData()`

**CORS blocks step 3** if the image is from a different origin.

### The Eyedropper Solution

Instead of reading raw image data, the eyedropper:
1. **Samples rendered pixels** from the visible DOM
2. Uses `getComputedStyle()` to read background colors
3. For images/canvas, draws a 1x1 sample (works because it's already visible)
4. **No cross-origin requests** = no CORS issues

### Color Sampling Methods

1. **Background Colors**: Uses `window.getComputedStyle().backgroundColor`
2. **Images**: Creates temporary 1x1 canvas and draws visible pixels
3. **Transparent Elements**: Falls back to parent element background
4. **CSS Gradients**: Samples the computed color at cursor position

### Shadow DOM Usage

All UI elements (magnifier, result card) use Shadow DOM to prevent:
- CSS conflicts with host site
- JavaScript interference
- Layout shifts
- Breaking site functionality

### Performance Optimizations

- **Throttled mouse tracking**: Updates limited to 60fps (16ms)
- **Small canvas size**: 1x1 pixel sampling (minimal memory)
- **Event cleanup**: All listeners removed on exit
- **Lazy history loading**: Only loads when popup opens

---

## Color Matching Algorithm

### Process

1. **Convert RGB to LAB** color space (perceptually uniform)
2. **Calculate Delta E** between picked color and each palette color
3. **Find closest match** (minimum ΔE)
4. **Apply threshold**: Match if ΔE < 20

### Why Delta E?

Delta E measures perceptual color difference:
- **ΔE < 1**: Imperceptible difference
- **ΔE 1-2**: Perceptible through close observation
- **ΔE 2-10**: Perceptible at a glance
- **ΔE 10-20**: Colors are more similar than opposite
- **ΔE > 20**: Different colors

Threshold of 20 allows for lighting/monitor variations while maintaining accuracy.

---

## Testing Guide

### ✅ Basic Functionality

1. **Activation Test**
   - [ ] Button appears in popup
   - [ ] Button disabled if no season selected
   - [ ] Popup closes when activated
   - [ ] Cursor changes to crosshair

2. **Magnifier Test**
   - [ ] Magnifier follows cursor smoothly
   - [ ] Shows zoomed pixels
   - [ ] Displays correct hex value
   - [ ] Shows instructions
   - [ ] Positioned to avoid viewport edges

3. **Color Capture Test**
   - [ ] Click captures color
   - [ ] Result card appears
   - [ ] Shows correct match/no-match
   - [ ] Displays hex value
   - [ ] Shows closest palette color
   - [ ] Auto-fades after 5 seconds

4. **Exit Test**
   - [ ] ESC key exits tool
   - [ ] Clicking captures (doesn't exit)
   - [ ] Cursor restored to normal
   - [ ] All DOM elements removed

### ✅ CORS Testing

Test on these notoriously CORS-strict sites:

1. **Amazon Product Images**
   - URL: `https://www.amazon.com/s?k=clothing`
   - Expected: Auto-detect fails, eyedropper works

2. **Etsy Product Photos**
   - URL: `https://www.etsy.com/search?q=dress`
   - Expected: Auto-detect fails, eyedropper works

3. **Pinterest Pins**
   - URL: `https://www.pinterest.com/search/pins/?q=fashion`
   - Expected: Auto-detect fails, eyedropper works

4. **Instagram Web** (if accessible)
   - URL: `https://www.instagram.com/`
   - Expected: Auto-detect fails, eyedropper works

### ✅ History Testing

1. **Save Test**
   - [ ] Picked colors appear in history
   - [ ] Shows last 5 colors
   - [ ] Newest colors appear first
   - [ ] Match status displayed correctly

2. **Persistence Test**
   - [ ] History survives browser restart
   - [ ] History survives extension reload
   - [ ] Limited to 50 colors (oldest removed)

3. **Clear Test**
   - [ ] Clear button works
   - [ ] Confirmation dialog appears
   - [ ] History section hides when empty

### ✅ Edge Cases

1. **Transparent Elements**
   - [ ] Handles transparent backgrounds gracefully
   - [ ] Falls back to parent element color

2. **Iframes**
   - [ ] Works on same-origin iframes
   - [ ] Handles cross-origin iframe restrictions

3. **SVG Elements**
   - [ ] Samples SVG fill colors
   - [ ] Works on SVG backgrounds

4. **CSS Gradients**
   - [ ] Samples gradient at cursor position
   - [ ] Shows single computed color

5. **Video Elements**
   - [ ] Samples current frame pixels
   - [ ] Works on paused and playing videos

### ✅ Browser Compatibility

Test on:
- [ ] Chrome (latest)
- [ ] Edge (latest)
- [ ] Brave (latest)
- [ ] Any Chromium-based browser

---

## Known Limitations

### 1. **Cross-Origin Iframes**
   - Cannot sample colors from cross-origin iframes
   - Browser security restriction
   - **Workaround**: User can click inside iframe to pick colors

### 2. **Very Small Elements**
   - Elements < 1px may be hard to target
   - Magnifier helps with precision

### 3. **Dynamic Color Changes**
   - Samples color at moment of click
   - Animations may show different colors on each frame

### 4. **Dark Mode Extensions**
   - May conflict with extensions that modify page colors
   - Samples the modified colors (as intended)

---

## User Tips

### 💡 Best Practices

1. **Pick from Large Areas**: More accurate for fabric/clothing colors
2. **Avoid Text**: Sample from solid backgrounds, not text edges
3. **Check Multiple Spots**: Lighting variations affect perceived color
4. **Use Zoom**: For small elements, use browser zoom before picking
5. **Compare Results**: Auto-detect (multi-color) vs manual (single color)

### 💡 When to Use

**Use Auto-Detect When:**
- Browsing product catalogs
- Filtering many items quickly
- Images are from the same domain

**Use Manual Picker When:**
- Auto-detect is blocked by CORS
- You want to check a specific color
- Analyzing specific design elements
- Product images won't load

---

## Troubleshooting

### Issue: "Please select a season first!"
**Solution**: Open popup and choose a seasonal palette before activating

### Issue: Magnifier doesn't appear
**Solution**:
- Check if cursor changed to crosshair
- Try refreshing the page
- Check browser console for errors

### Issue: Colors seem wrong
**Possible Causes**:
- Dark mode extensions
- Color-blind filters
- Monitor color profile
- Browser color management

**Solution**: Disable color-modifying extensions temporarily

### Issue: Can't pick color from specific element
**Possible Causes**:
- Element is in cross-origin iframe
- Element has pointer-events: none
- Element is behind another element

**Solution**:
- Try clicking nearby
- Inspect element to check z-index
- Use browser DevTools to identify color

### Issue: History not saving
**Solution**:
- Check Chrome storage quota (unlikely to hit)
- Check extension permissions
- Try clearing and re-picking

---

## API Reference

### Message Types

#### Popup → Service Worker

```javascript
// Activate eyedropper
{
  action: 'activateEyedropper',
  tabId: number
}

// Get color history
{
  action: 'getColorHistory'
}

// Clear color history
{
  action: 'clearColorHistory'
}
```

#### Content Script → Service Worker

```javascript
// Save picked color
{
  action: 'savePickedColor',
  color: {
    hex: string,
    rgb: [r, g, b],
    match: boolean,
    closestMatch: string,
    distance: number,
    season: string,
    timestamp: number
  }
}
```

#### Service Worker → Popup

```javascript
// Color history updated
{
  type: 'colorHistoryUpdated'
}
```

### Storage Schema

#### chrome.storage.local.colorHistory

```javascript
[
  {
    hex: '#FF5733',
    rgb: [255, 87, 51],
    match: true,
    closestMatch: '#FF6347',
    distance: 12,
    season: 'bright-spring',
    timestamp: 1637012345678
  },
  // ... up to 50 items
]
```

---

## Future Enhancements

### Potential Additions

1. **Color Palette Builder**
   - Let users create custom palettes from picked colors
   - Export palette as JSON/CSS

2. **Color Harmony Analyzer**
   - Show complementary/analogous colors
   - Suggest color combinations

3. **Screenshot Analysis**
   - Pick colors from uploaded images
   - Bulk color extraction

4. **Color Name Display**
   - Show human-readable color names
   - "Coral Red", "Sky Blue", etc.

5. **Accessibility Features**
   - Contrast ratio calculator
   - Color-blind simulation
   - WCAG compliance check

6. **Mobile Support**
   - Adapt for touch events
   - Mobile-optimized UI

---

## Credits

Built on top of Season Color Checker extension using:
- **Delta E (CIEDE2000)** algorithm for color matching
- **Shadow DOM** for UI isolation
- **Canvas API** for pixel sampling
- **Chrome Extension Manifest V3** APIs

---

## License

Same as parent project (Season Color Checker extension)

---

## Support

For issues or questions:
1. Check this documentation
2. Check browser console for errors
3. Try disabling conflicting extensions
4. Report bugs with:
   - Browser version
   - Website URL
   - Console errors
   - Steps to reproduce

---

**Last Updated**: 2024-11-23
**Version**: 1.0.0
**Compatible With**: Season Color Checker v1.0+
