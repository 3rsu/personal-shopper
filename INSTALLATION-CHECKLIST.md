# Installation Checklist ✅

Follow this checklist to ensure your Season Color Checker extension is properly set up.

## Pre-Installation

- [ ] **Chrome browser installed** (version 88 or higher)
- [ ] **Project folder downloaded** to your computer
- [ ] **All files present** (see FILE-STRUCTURE.txt)

## Icon Setup (Optional but Recommended)

Choose ONE option:

### Option A: Quick Test (Use SVG Placeholders)
- [ ] No action needed - extension will work with SVG placeholders
- [ ] Note: Icons may not display perfectly

### Option B: Convert to PNG (Recommended)
- [ ] Visit https://cloudconvert.com/svg-to-png
- [ ] Upload `icons/icon.svg`
- [ ] Convert to 16x16 PNG → save as `icon16.png`
- [ ] Convert to 48x48 PNG → save as `icon48.png`
- [ ] Convert to 128x128 PNG → save as `icon128.png`
- [ ] Replace placeholder files in `icons/` folder

### Option C: Use ImageMagick (Advanced)
- [ ] Install ImageMagick
- [ ] Run conversion commands (see icons/convert-svg.txt)

## Load Extension in Chrome

1. **Open Extensions Page**
   - [ ] Navigate to `chrome://extensions/`
   - [ ] OR: Chrome Menu → More Tools → Extensions

2. **Enable Developer Mode**
   - [ ] Toggle "Developer mode" switch (top right corner)
   - [ ] Confirm it's ON (blue/enabled)

3. **Load the Extension**
   - [ ] Click "Load unpacked" button
   - [ ] Navigate to the `season-color-checker` folder
   - [ ] Click "Select Folder"
   - [ ] Extension appears in list

4. **Verify Installation**
   - [ ] Extension card shows "Season Color Checker"
   - [ ] Version shows "1.0.0"
   - [ ] No error messages displayed
   - [ ] Toggle is set to "Enabled" (ON)

## First-Time Setup

1. **Pin the Extension** (Optional)
   - [ ] Click puzzle piece icon in Chrome toolbar
   - [ ] Find "Season Color Checker"
   - [ ] Click pin icon

2. **Select Your Season**
   - [ ] Click the 🎨 extension icon
   - [ ] Popup opens
   - [ ] Select your seasonal palette (Spring/Summer/Autumn/Winter)
   - [ ] Selection is saved automatically

3. **Verify Filter Toggle**
   - [ ] In popup, check "Auto-filter products" toggle is ON
   - [ ] Close popup

## Test the Extension

1. **Visit a Test Site**
   - [ ] Go to amazon.com
   - [ ] Search for "women dress" or "men shirt"
   - [ ] Wait for page to load

2. **Check Filtering Works**
   - [ ] Floating widget appears (top right)
   - [ ] Some product images have green borders (matches)
   - [ ] Some product images are dimmed (non-matches)
   - [ ] Badges (✓ or ✗) visible on images
   - [ ] Widget shows stats like "X of Y items match"

3. **Test Wishlist**
   - [ ] Click on a product with green border
   - [ ] Confirm to add to wishlist
   - [ ] Open extension popup
   - [ ] Wishlist section shows saved item

## Troubleshooting

### Extension not loading
- [ ] Check all files are present (22 files total)
- [ ] Verify manifest.json has no syntax errors
- [ ] Check Chrome version (need 88+)

### No filtering happening
- [ ] Refresh the page after installing
- [ ] Verify you selected a season
- [ ] Check filter toggle is ON
- [ ] Open browser console (F12) → check for errors

### Icons not showing
- [ ] Convert SVG to PNG (see Icon Setup above)
- [ ] Reload extension after adding icons
- [ ] Clear browser cache

### Images not being analyzed
- [ ] Wait a few seconds for page to fully load
- [ ] Check browser console for CORS errors
- [ ] Try a different website

## Advanced Checks

- [ ] Open browser console (F12) → no error messages
- [ ] Check extension service worker: `chrome://extensions/` → Service worker "active"
- [ ] Verify storage: `chrome://extensions/` → Details → Storage → has data

## Customization (Optional)

- [ ] Adjust color match sensitivity (see CUSTOMIZATION.md)
- [ ] Modify seasonal palettes (see CUSTOMIZATION.md)
- [ ] Change visual appearance (see CUSTOMIZATION.md)

## Final Verification

- [x] Extension loads without errors
- [x] Season selected and saved
- [x] Filtering works on shopping sites
- [x] Floating widget displays
- [x] Wishlist saves items
- [x] Can toggle filter on/off

## Ready to Use! 🎉

Your Season Color Checker extension is now fully installed and ready to help you shop in your perfect colors!

**Next Steps:**
1. Visit your favorite online clothing stores
2. Let the extension filter products for you
3. Save matching items to your wishlist
4. Enjoy shopping with confidence!

---

**Need Help?**
- See [README.md](README.md) for full documentation
- See [QUICK-START.md](QUICK-START.md) for quick reference
- See [CUSTOMIZATION.md](CUSTOMIZATION.md) for advanced features

**Report Issues:**
- Open browser console (F12) and check for errors
- Check existing GitHub issues
- Create a new issue with details
