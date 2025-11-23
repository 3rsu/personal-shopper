# Season Color Checker 🎨

A Chrome extension that automatically filters online clothing stores to show only items matching your seasonal color palette.

## Features

✨ **Auto-Filtering**: Automatically analyzes and filters product images on shopping websites
🎨 **4 Seasonal Palettes**: Spring, Summer, Autumn, and Winter with 15 curated colors each
🔬 **Smart Color Matching**: Uses Delta E (CIEDE2000) algorithm for accurate color comparison
💝 **Wishlist**: Save matching items for later review
📊 **Real-time Stats**: Floating widget shows how many items match your palette
⚡ **Fast & Efficient**: Lazy loading for optimal performance on large product catalogs

---

## Installation

### Load as Unpacked Extension (For Development/Testing)

1. **Download or clone this repository**
   ```bash
   git clone https://github.com/yourusername/season-color-checker.git
   ```

2. **Open Chrome Extensions page**
   - Navigate to `chrome://extensions/`
   - OR: Menu → More Tools → Extensions

3. **Enable Developer Mode**
   - Toggle the "Developer mode" switch in the top right

4. **Load the extension**
   - Click "Load unpacked"
   - Select the `season-color-checker` folder
   - The extension should now appear in your extensions list

5. **Pin the extension** (optional)
   - Click the puzzle piece icon in Chrome toolbar
   - Find "Season Color Checker"
   - Click the pin icon to keep it visible

### Create Icons (Required)

The extension comes with SVG placeholders. You need to convert them to PNG:

**Option 1 - Online Converter (Easiest):**
1. Go to https://cloudconvert.com/svg-to-png
2. Upload `icons/icon.svg`
3. Convert to PNG at sizes: 16x16, 48x48, 128x128
4. Save as `icon16.png`, `icon48.png`, `icon128.png` in the `icons/` folder

**Option 2 - Command Line (if you have ImageMagick):**
```bash
cd icons
convert -background none icon.svg -resize 16x16 icon16.png
convert -background none icon.svg -resize 48x48 icon48.png
convert -background none icon.svg -resize 128x128 icon128.png
```

---

## How to Use

### First Time Setup

1. **Click the extension icon** in your Chrome toolbar
2. **Select your seasonal palette**:
   - 🌸 **Spring**: Warm, clear, bright colors
   - 🌊 **Summer**: Cool, soft, muted colors
   - 🍂 **Autumn**: Warm, rich, earthy colors
   - ❄️ **Winter**: Cool, clear, vivid colors
3. Your selection is saved automatically

### Browsing Online Stores

1. **Visit any clothing shopping website** (Amazon, Zara, ASOS, etc.)
2. **The extension automatically filters products**:
   - ✅ Matching items get a **green border**
   - ❌ Non-matching items are **dimmed** (50% opacity)
   - Badge overlays show match status
3. **View stats** in the floating widget:
   - Shows "✓ X of Y items match your [Season] palette"
   - Drag the widget anywhere on the page
   - Minimize or close as needed

### Saving Items to Wishlist

1. **Click on any matching product image** (green border)
2. Confirm to add to wishlist
3. **View your wishlist**:
   - Click the extension icon
   - Scroll to "Wishlist" section
   - See saved items with match scores and colors
   - Click "View Product →" to revisit the item

### Toggle Filter On/Off

- Click the extension icon
- Use the "Auto-filter products" toggle at the bottom
- OR click "Turn Off" in the floating widget

---

## Technical Details

### Architecture

```
season-color-checker/
├── manifest.json              # Extension configuration (Manifest V3)
├── background/
│   ├── service-worker.js      # Background processing & storage
│   └── color-processor.js     # Delta E color matching algorithm
├── content/
│   ├── content.js             # Product image detection & filtering
│   ├── overlay.js             # Floating stats widget
│   └── content.css            # Visual filter styles
├── popup/
│   ├── popup.html             # Extension popup UI
│   ├── popup.js               # Popup controller
│   └── popup.css              # Popup styling
├── data/
│   └── seasonal-palettes.js   # 60 curated seasonal colors
├── libs/
│   └── color-thief.min.js     # Color extraction library
└── icons/                     # Extension icons
```

### Technologies Used

- **Manifest V3**: Latest Chrome extension standard
- **Color Thief**: Fast color extraction from images
- **Delta E (CIEDE2000)**: Perceptually accurate color difference calculation
- **Chrome Storage API**: Persistent user preferences and wishlist
- **Vanilla JavaScript**: No frameworks, lightweight and fast

### Color Matching Algorithm

1. **Extract dominant colors** from product images (top 5 colors)
2. **Convert to LAB color space** for perceptual accuracy
3. **Calculate Delta E** between extracted colors and palette colors
4. **Match threshold**: ΔE < 20 = match
5. **Multi-color rule**: If 2+ out of 3 dominant colors match → show item

### Site Compatibility

Works on most e-commerce websites including:
- Amazon
- Shopify stores
- Generic online retailers

The extension uses:
- Site-specific selectors for major platforms
- Generic image detection (size > 100x100px) as fallback
- DOM mutation observer for lazy-loaded content

---

## Seasonal Color Palettes

Each palette contains **15 carefully curated colors** based on professional color analysis theory:

### 🌸 Spring
Warm undertones, clear and bright
- Peach, Coral, Golden Yellow, Light Pink, Aquamarine, Pale Green, Sky Blue

### 🌊 Summer
Cool undertones, soft and muted
- Lavender, Powder Blue, Mauve, Light Steel Blue, Thistle, Pale Pink, Beige

### 🍂 Autumn
Warm undertones, rich and earthy
- Rust, Chocolate, Goldenrod, Olive, Sienna, Burlywood, Terracotta

### ❄️ Winter
Cool undertones, clear and vivid
- True Red, Royal Blue, Pure Black & White, Magenta, Indigo, Crimson

---

## Troubleshooting

### Extension not filtering products

1. **Check if you've selected a season**: Click extension icon → Select palette
2. **Verify filter is enabled**: Check the toggle in popup
3. **Refresh the page**: Some sites load content dynamically
4. **Check permissions**: Make sure extension has access to the website

### Images not being analyzed

- **CORS issues**: Some images from external domains may not load
- **Image size**: Only images > 100x100px are analyzed
- **Wait for page load**: Give the page a few seconds to fully load

### Wishlist items not saving

- Check Chrome storage permissions in `chrome://extensions/`
- Clear extension storage and try again

### Icons not showing

- Convert the SVG icon to PNG format (see Installation section)
- Reload the extension after adding icons

---

## Privacy & Permissions

### Required Permissions

- **`storage`**: Save your palette selection and wishlist locally
- **`activeTab`**: Access product images on websites you visit
- **`scripting`**: Inject content scripts to analyze images
- **`host_permissions: *://*/*`**: Work on any shopping website

### Privacy Commitment

- ✅ **All data stored locally** on your device
- ✅ **No data sent to external servers**
- ✅ **No tracking or analytics**
- ✅ **Open source - review the code yourself**

---

## Development

### Project Structure

- **Service Worker** (`background/`): Handles storage and message passing
- **Content Script** (`content/`): Runs on web pages, analyzes images
- **Popup** (`popup/`): User interface for settings and wishlist
- **Color Processor**: Delta E algorithm implementation

### Future Enhancements

🎯 **Planned Features**:
- [ ] Custom palette creation
- [ ] Export wishlist (JSON, CSV, Pinterest)
- [ ] Keyboard shortcuts (Alt+C to toggle)
- [ ] Multi-browser support (Firefox, Edge)
- [ ] AI-powered garment type detection
- [ ] Outfit combination suggestions
- [ ] Color analysis quiz to find your season

---

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

## License

MIT License - Feel free to modify and distribute

---

## Credits

- **Color Thief** by Lokesh Dhakar - Color extraction library
- **Seasonal Color Theory** - Based on professional color analysis
- **Delta E Algorithm** - CIEDE2000 color difference formula

---

## Support

For issues, questions, or feature requests:
- Open an issue on GitHub
- Check existing issues for solutions

---

**Happy shopping with colors that suit you!** 🎨✨
