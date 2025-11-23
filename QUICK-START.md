# Quick Start Guide 🚀

## Install in 3 Minutes

### Step 1: Load Extension
1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `season-color-checker` folder
5. ✅ Extension is now installed!

### Step 2: Choose Your Season
1. Click the 🎨 extension icon in your toolbar
2. Select your seasonal palette:
   - 🌸 **Spring** - Warm, bright colors
   - 🌊 **Summer** - Cool, soft colors
   - 🍂 **Autumn** - Warm, earthy colors
   - ❄️ **Winter** - Cool, vivid colors
3. ✅ Palette saved!

### Step 3: Start Shopping
1. Visit any clothing website (try Amazon, ASOS, or Zara)
2. Watch as the extension automatically filters products:
   - ✅ Green borders = Matches your palette
   - ❌ Dimmed items = Doesn't match
3. Click on matching items to save to your wishlist

---

## Test It Out

**Try these sites:**
- amazon.com (search "women's dress" or "men's shirt")
- zara.com
- asos.com
- Any Shopify store

**What you'll see:**
- Floating widget showing match stats
- Product images with green borders (matches) or dimmed (no match)
- Badges on each product (✓ or ✗)

---

## Troubleshooting

**Nothing happening?**
1. Refresh the page after installing
2. Check that you selected a season in the popup
3. Make sure the filter toggle is ON in the popup

**Icons not showing?**
The icons are currently SVG placeholders. To fix:
1. Go to https://cloudconvert.com/svg-to-png
2. Upload `icons/icon.svg`
3. Convert to 16x16, 48x48, and 128x128 PNG
4. Save as `icon16.png`, `icon48.png`, `icon128.png` in the `icons/` folder
5. Reload the extension

---

## Features at a Glance

✨ **Auto-filter** - Automatically highlights matching products
💝 **Wishlist** - Save items you love
📊 **Stats widget** - See match count in real-time
🎨 **4 palettes** - 60 curated seasonal colors
⚡ **Fast** - Efficient color matching algorithm

---

---

## 🆕 Manual Color Picker (Eyedropper)

### What It Does
Pick any color from any website and instantly check if it matches your palette. **Works even when auto-detect fails due to CORS!**

### How to Use

1. **Click "Pick a Color"** button in popup
2. **Hover** over any element on the page
3. **Click** to capture the color
4. **See instant results**:
   - ✓ Green = Matches your palette
   - ✗ Red = Doesn't match
   - ΔE score = Color distance

### When to Use It

- **Auto-detect blocked** - CORS-protected images (Amazon, Etsy, Pinterest)
- **Specific colors** - Check exact colors on buttons, text, backgrounds
- **Manual verification** - Double-check auto-detect results
- **Color exploration** - Sample colors for inspiration

### Quick Example

```
1. Open Amazon product page
2. Auto-detect might fail (CORS error)
3. Click "Pick a Color" in popup
4. Hover over product image
5. Click to sample
6. ✅ Result shows if it matches!
```

### Features

- 🔍 **5x Magnifier** - See zoomed pixels while hovering
- 🎯 **Crosshair cursor** - Precision targeting
- 📊 **ΔE scoring** - Scientific color matching
- 📝 **History** - Last 50 colors saved
- 🚀 **Works everywhere** - No CORS issues!

### Keyboard Shortcuts

- **ESC** - Cancel and exit picker
- **Click** - Capture color

---

## Documentation

- **Quick Start** - You're reading it!
- **[EYEDROPPER-FEATURE.md](EYEDROPPER-FEATURE.md)** - Full technical documentation
- **[INSTALLATION-CHECKLIST.md](INSTALLATION-CHECKLIST.md)** - Setup guide
- **[README.md](README.md)** - Complete feature list

---

## Need Help?

See [README.md](README.md) for full documentation or [EYEDROPPER-FEATURE.md](EYEDROPPER-FEATURE.md) for eyedropper details.

Enjoy shopping in your perfect colors! 🎨✨
