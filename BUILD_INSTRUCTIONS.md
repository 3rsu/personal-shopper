# Build Instructions

## Building the Extension

The extension now uses **@imgly/background-removal** for professional-grade AI background removal.

### Prerequisites
- Node.js and npm installed

### Build Steps

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build the bundled background removal library:**
   ```bash
   npm run build
   ```

   This creates `dist/background-removal-bundle.js` and related WASM/JS files.

3. **Load the extension in Chrome:**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked"
   - Select this directory

### Testing

After loading the extension:

1. Navigate to any e-commerce site with product images
2. Select your seasonal color palette from the extension popup
3. The extension will:
   - Remove backgrounds from product images using AI
   - Crop the upper 1/6.5 portion (to remove model faces/headers)
   - Extract dominant colors from the cleaned image
   - Highlight products that match your season

### Expected Behavior

**Before (old background remover):**
- Beige background was detected as dominant color #1
- Navy dress was color #2
- Background removal was failing

**After (@imgly/background-removal):**
- Beige background should be completely removed
- Navy dress should be dominant color #1
- Background removal works like remove.bg

### Notes

- First run will download AI models (~40MB for isnet_quint8)
- Models are cached by browser for subsequent runs
- Background removal runs client-side (no server costs)
- Processing may take 1-3 seconds per image on first run
