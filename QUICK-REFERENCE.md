# Quick Reference Card 📋

## Installation (30 seconds)
1. `chrome://extensions/` → Developer mode ON
2. "Load unpacked" → Select `season-color-checker` folder
3. Click extension icon → Select season
4. Done! Visit any shopping site

---

## First Time Troubleshooting

### Nothing happening?
1. **Reload extension:** `chrome://extensions/` → Reload button
2. **Select season:** Click extension icon → Choose Spring/Summer/Autumn/Winter
3. **Refresh page:** Press F5 on shopping site
4. **Check console:** Press F12 → Look for `[Season Color Checker]` messages

---

## Testing

### Quick Test
Open `TEST-PAGE.html` → Should see green borders and dimming

### Real World Test
1. Go to amazon.com
2. Search "women dress" or "men shirt"
3. Wait 3-5 seconds
4. Look for green borders (matches) and dimmed items (no match)

---

## What You Should See

| Feature | What to Look For |
|---------|------------------|
| **Matching items** | Green border (3px solid) + ✓ badge |
| **Non-matching** | Dimmed (50% opacity) + ✗ badge |
| **Widget** | Top right corner, shows "✓ X of Y items match" |
| **Console** | `[Season Color Checker]` messages (press F12) |

---

## Common Issues → Quick Fixes

| Problem | Quick Fix |
|---------|-----------|
| Nothing happening | Reload extension + refresh page |
| "No season selected" | Click extension → pick a season |
| No console messages | Check all files present, reload extension |
| Works on test page only | Try amazon.com, may be site-specific |
| ColorThief error | Re-download libs/color-thief.min.js |
| Widget not showing | Check overlay.js loaded in manifest |

---

## Console Quick Check

Press **F12**, run this:
```javascript
// Should show all true:
console.log({
  ColorThief: typeof ColorThief !== 'undefined',
  ColorProcessor: typeof ColorProcessor !== 'undefined',
  Palettes: typeof SEASONAL_PALETTES !== 'undefined'
});
```

---

## Files Checklist

Must have these files (22 total):
```
✓ manifest.json
✓ background/service-worker.js
✓ background/color-processor.js
✓ content/content.js
✓ content/overlay.js
✓ content/content.css
✓ popup/popup.html, popup.js, popup.css
✓ data/seasonal-palettes.js
✓ libs/color-thief.min.js (6.4 KB)
✓ icons/ (icon.svg + placeholders)
```

---

## Seasonal Palettes

| Season | Colors | Use For |
|--------|--------|---------|
| 🌸 Spring | Warm, bright pastels | Peach, coral, light pink, golden yellow |
| 🌊 Summer | Cool, soft tones | Lavender, powder blue, soft pink |
| 🍂 Autumn | Warm, earthy | Brown, rust, olive, goldenrod |
| ❄️ Winter | Cool, vivid | Black, white, true red, royal blue |

---

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Open DevTools | F12 |
| Refresh page | F5 |
| Extension popup | Click icon |

---

## Best Sites to Test

✅ **Works well:**
- amazon.com
- etsy.com
- zara.com
- Any Shopify store

❓ **May need tweaking:**
- Sites with lazy loading
- Sites with external image CDNs
- Custom e-commerce platforms

---

## Performance Tips

**Too slow?**
- Increase min image size (100 → 200px)
- Reduce palette size (5 → 3 colors)
- See CUSTOMIZATION.md

**Not enough matches?**
- Lower threshold (20 → 25)
- Change 2-of-3 rule to 1-of-3
- See CUSTOMIZATION.md

---

## Documentation Map

| File | Purpose |
|------|---------|
| README.md | Complete documentation |
| QUICK-START.md | 3-minute installation |
| DEBUGGING-GUIDE.md | Detailed troubleshooting |
| CUSTOMIZATION.md | Advanced customization |
| FIXES-APPLIED.md | Recent bug fixes |
| TEST-PAGE.html | Quick test page |
| **This file** | Quick reference |

---

## Support Checklist

Before asking for help, verify:
- [ ] Extension loaded and enabled
- [ ] Season selected in popup
- [ ] Page refreshed after setup
- [ ] F12 console checked
- [ ] Tried TEST-PAGE.html
- [ ] Tried amazon.com
- [ ] All 22 files present

---

## Success Metrics

Extension is working if:
1. ✅ Console shows `[Season Color Checker] Initializing...`
2. ✅ Floating widget appears
3. ✅ Some images have green borders
4. ✅ Some images are dimmed
5. ✅ Can save to wishlist

---

**That's it! Keep this card handy for quick reference.** 🎨✨

For detailed help, see: **DEBUGGING-GUIDE.md**
