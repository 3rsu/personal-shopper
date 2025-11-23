# Customization Guide

This guide explains how to customize the Season Color Checker extension to fit your needs.

## Adjusting Color Match Sensitivity

The extension uses a Delta E threshold of **20** by default. Lower values = stricter matching.

**To adjust:**

1. Open `background/color-processor.js`
2. Find line 14:
   ```javascript
   this.MATCH_THRESHOLD = 20;  // Delta E threshold for color matching
   ```
3. Adjust the value:
   - **< 15**: Very strict (fewer matches, only very similar colors)
   - **20**: Balanced (default, recommended)
   - **> 25**: Lenient (more matches, broader color range)

## Adding Your Own Custom Colors

Want to add your own seasonal colors or create a new palette?

**To modify a palette:**

1. Open `data/seasonal-palettes.js`
2. Find your season (e.g., `spring:`)
3. Add or modify hex color codes in the `colors` array:
   ```javascript
   colors: [
     '#FFE5B4', // Peach
     '#YOUR_NEW_COLOR', // Your color name
     // ... more colors
   ]
   ```

**To create a new palette:**

1. Add a new entry in `SEASONAL_PALETTES`:
   ```javascript
   neutral: {
     name: 'Neutral',
     description: 'Versatile neutral tones',
     colors: [
       '#FFFFFF', // White
       '#F5F5F5', // Off-white
       '#E0E0E0', // Light gray
       // ... add 15 colors
     ]
   }
   ```

2. Update `popup/popup.html` to add the new season card:
   ```html
   <button class="season-card" data-season="neutral">
     <div class="season-card-header">
       <span class="season-emoji">⚪</span>
       <h3>Neutral</h3>
     </div>
     <p class="season-desc">Versatile neutral tones</p>
     <!-- Add color dots -->
   </button>
   ```

## Changing Match Logic (2-of-3 Rule)

The extension shows an item if **2 out of 3** dominant colors match. To change this:

1. Open `background/color-processor.js`
2. Find the `checkColorMatch` function (around line 122)
3. Modify this line:
   ```javascript
   const matches = matchCount >= 2;  // Change to 1 (any match) or 3 (all must match)
   ```

## Customizing Visual Appearance

### Change Filter Opacity

1. Open `content/content.css`
2. Find `.season-dimmed` (around line 12):
   ```css
   .season-filter-container.season-dimmed {
     opacity: 0.35;  /* Change to 0.1-0.9 */
   }
   ```

### Change Match Border Color

1. Open `content/content.css`
2. Find `img.season-match` (around line 20):
   ```css
   img.season-match {
     border: 3px solid #10b981 !important;  /* Change color */
   }
   ```

### Change Widget Position

1. Open `content/content.css`
2. Find `.season-overlay` (around line 60):
   ```css
   .season-overlay {
     top: 20px;    /* Distance from top */
     right: 20px;  /* Distance from right */
   }
   ```

## Advanced: Adding Site-Specific Selectors

To improve detection on specific shopping sites:

1. Open `content/content.js`
2. Find the `siteSelectors` object (around line 95):
   ```javascript
   const siteSelectors = {
     'amazon.com': '.s-image, .a-dynamic-image',
     'shopify': '.product-card__image',
     // Add your site:
     'yoursite.com': '.your-product-image-class'
   };
   ```

## Keyboard Shortcuts (Advanced)

To add keyboard shortcuts:

1. Add to `manifest.json`:
   ```json
   "commands": {
     "toggle-filter": {
       "suggested_key": {
         "default": "Alt+C"
       },
       "description": "Toggle color filter"
     }
   }
   ```

2. Add handler in `background/service-worker.js`:
   ```javascript
   chrome.commands.onCommand.addListener((command) => {
     if (command === 'toggle-filter') {
       // Toggle filter logic
     }
   });
   ```

## Export Format Customization

Want to export wishlist in a specific format?

1. Open `popup/popup.js`
2. Add an export function:
   ```javascript
   function exportWishlist() {
     const csv = wishlist.map(item =>
       `${item.pageUrl},${item.matchScore}%`
     ).join('\n');

     // Download CSV
     const blob = new Blob([csv], { type: 'text/csv' });
     const url = URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url;
     a.download = 'wishlist.csv';
     a.click();
   }
   ```

## Performance Tuning

### Reduce Image Processing Load

1. Open `content/content.js`
2. Find `findProductImages` function
3. Increase minimum image size:
   ```javascript
   if (img.naturalWidth < 150 || img.naturalHeight < 150) {
     return;  // Skip smaller images
   }
   ```

### Adjust Color Extraction Quality

1. Open `content/content.js`
2. Find the `processImage` function (around line 146)
3. Adjust palette size:
   ```javascript
   dominantColors = colorThief.getPalette(img, 3);  // Change from 5 to 3
   ```

---

## Tips

- **Always reload the extension** after making changes (`chrome://extensions/` → Reload button)
- **Test on multiple sites** to ensure your changes work broadly
- **Keep backups** of your customizations before major changes
- **Check browser console** (F12) for error messages

---

## Sharing Your Customizations

Found a great customization? Share it:
1. Document your changes
2. Create a GitHub issue or pull request
3. Help others improve their experience!

Happy customizing! 🎨
