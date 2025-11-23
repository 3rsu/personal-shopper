# Debugging Guide 🔧

## Extension Not Working? Follow These Steps

### Step 1: Check Browser Console

1. **Open Developer Tools**
   - Press `F12` or right-click → "Inspect"
   - Go to the **Console** tab

2. **Look for Errors**
   - Red error messages indicate problems
   - Common errors and solutions below

---

### Common Issues & Solutions

#### ❌ **Nothing happens on websites**

**Check:**
1. Have you selected a season?
   - Click extension icon → Select Spring/Summer/Autumn/Winter

2. Is the filter enabled?
   - Extension popup → Check "Auto-filter products" toggle is ON

3. Did you refresh the page?
   - Refresh (F5) after installing or changing settings

**Console check:**
```
Look for: "ColorProcessor not loaded"
Solution: Reload extension at chrome://extensions/
```

---

#### ❌ **"ColorProcessor not loaded" error**

**Problem:** Script loading order issue

**Solution:**
1. Go to `chrome://extensions/`
2. Find "Season Color Checker"
3. Click "Reload" button (circular arrow)
4. Refresh your shopping page

---

#### ❌ **"ColorThief is not defined" error**

**Problem:** Color Thief library not loading

**Check:**
1. File exists: `libs/color-thief.min.js` (should be 6.4 KB)
2. Manifest.json lists it first in content_scripts

**Solution:**
- Redownload Color Thief:
```bash
cd season-color-checker/libs
curl -L -o color-thief.min.js https://cdnjs.cloudflare.com/ajax/libs/color-thief/2.3.0/color-thief.umd.js
```

---

#### ❌ **No floating widget appears**

**Check Console for:**
```
Look for: "SEASONAL_PALETTES is not defined"
```

**Solution:**
1. Verify `data/seasonal-palettes.js` exists
2. Check manifest.json includes it before content.js
3. Reload extension

---

#### ❌ **Images detected but not filtered**

**Console Debug:**
Open console and type:
```javascript
// Check if extension is running
console.log('Season:', localStorage.getItem('selectedSeason'));

// Check ColorThief
console.log(typeof ColorThief);

// Check palettes
console.log(SEASONAL_PALETTES);
```

**If undefined:**
- Scripts not loading properly
- Reload extension

---

### Step 2: Check Extension Status

1. Go to `chrome://extensions/`
2. Find "Season Color Checker"
3. Check:
   - ✅ Enabled toggle is ON
   - ✅ No error messages in red
   - ✅ "Service worker" shows "active"

---

### Step 3: Test on Known Working Sites

Try these sites to verify:
- amazon.com (search "dress")
- etsy.com (any category)
- zara.com

If it works on one but not another, it's a site-specific issue.

---

### Step 4: Enable Detailed Logging

Add debug logging to see what's happening:

1. Open `content/content.js`
2. Add at the top of `initialize()`:
```javascript
console.log('[Season Checker] Initializing...');
console.log('[Season Checker] ColorProcessor:', typeof ColorProcessor);
console.log('[Season Checker] ColorThief:', typeof ColorThief);
console.log('[Season Checker] Palettes:', typeof SEASONAL_PALETTES);
```

3. Reload extension
4. Refresh page
5. Check console for these logs

---

### Step 5: Verify Permissions

**Check manifest.json has:**
```json
"permissions": ["storage", "activeTab", "scripting"],
"host_permissions": ["*://*/*"]
```

**If missing:**
- Extension won't work on websites
- Re-download or fix manifest.json

---

### Step 6: Check for CORS Issues

**Symptom:** Some images work, others don't

**Console shows:**
```
Access to image at '...' from origin '...' has been blocked by CORS policy
```

**This is normal:**
- Some external images can't be analyzed
- Extension skips them automatically
- Not a critical error

---

### Detailed Troubleshooting Checklist

#### Installation Issues
- [ ] Chrome version 88+ installed
- [ ] Developer mode enabled
- [ ] Extension loaded from correct folder
- [ ] All 22 files present in folder
- [ ] No syntax errors in manifest.json

#### Runtime Issues
- [ ] Season selected in popup
- [ ] Filter toggle is ON
- [ ] Page refreshed after setup
- [ ] Console shows no red errors
- [ ] Service worker is "active"

#### Content Script Issues
- [ ] `libs/color-thief.min.js` exists (6.4 KB)
- [ ] `data/seasonal-palettes.js` exists
- [ ] `background/color-processor.js` exists
- [ ] Scripts load in correct order (check manifest)

#### Visual Issues
- [ ] `content/content.css` loaded
- [ ] Green border class applied to matches
- [ ] Dimmed class applied to non-matches
- [ ] Widget overlay visible

---

### Advanced Debugging

#### Enable Verbose Logging

Edit `content/content.js` and add logging throughout:

```javascript
console.log('[Season] Finding images...');
console.log('[Season] Found:', images.length, 'images');
console.log('[Season] Processing:', img.src);
console.log('[Season] Dominant colors:', dominantColors);
console.log('[Season] Match result:', matchResult);
```

#### Check Storage

Open console and run:
```javascript
chrome.storage.sync.get(null, (data) => console.log('Sync storage:', data));
chrome.storage.local.get(null, (data) => console.log('Local storage:', data));
```

Should show:
```
Sync storage: { selectedSeason: 'spring', filterEnabled: true }
Local storage: { wishlist: [...] }
```

#### Monitor Service Worker

1. Go to `chrome://extensions/`
2. Find "Season Color Checker"
3. Click "service worker" link
4. Opens DevTools for background script
5. Check for errors

---

### Still Not Working?

#### Nuclear Option: Clean Reinstall

1. **Remove extension**
   - chrome://extensions/
   - Click "Remove"

2. **Clear storage**
   - Open DevTools (F12)
   - Application tab → Storage → Clear site data

3. **Reload extension**
   - Load unpacked again
   - Select season
   - Test

4. **Verify files**
   ```bash
   cd season-color-checker
   ls -la background/
   ls -la content/
   ls -la libs/
   ```

---

### Common Error Messages Decoded

| Error | Meaning | Solution |
|-------|---------|----------|
| "ColorProcessor not loaded" | Script order issue | Reload extension |
| "ColorThief is not defined" | Library missing | Check libs/ folder |
| "SEASONAL_PALETTES is not defined" | Data file missing | Check data/ folder |
| "Cannot read property of undefined" | Settings not loaded | Select season in popup |
| "Failed to fetch" | CORS issue | Normal, skip those images |

---

### Performance Issues

**Extension slowing down pages?**

1. Reduce image processing:
   - Edit `content/content.js`
   - Increase minimum image size from 100 to 200:
   ```javascript
   if (img.naturalWidth < 200 || img.naturalHeight < 200) {
     return; // Skip
   }
   ```

2. Reduce palette size:
   - Change from 5 colors to 3:
   ```javascript
   dominantColors = colorThief.getPalette(img, 3);
   ```

---

### Test Commands

Run these in browser console to test:

```javascript
// 1. Check if scripts loaded
console.log({
  ColorThief: typeof ColorThief,
  ColorProcessor: typeof ColorProcessor,
  Palettes: typeof SEASONAL_PALETTES
});

// 2. Test color processor manually
const processor = new ColorProcessor();
const result = processor.findClosestMatch('#FFB6C1', SEASONAL_PALETTES.spring.colors);
console.log('Match test:', result);

// 3. Check extension settings
chrome.runtime.sendMessage({ action: 'getSettings' }, console.log);

// 4. Count images on page
console.log('Total images:', document.querySelectorAll('img').length);
console.log('Large images:', Array.from(document.querySelectorAll('img')).filter(
  img => img.naturalWidth > 100
).length);
```

---

### Getting Help

If none of this works:

1. **Document the issue:**
   - Browser version
   - Website URL
   - Console errors (screenshot)
   - Steps you tried

2. **Check GitHub issues:**
   - Someone may have same problem
   - Solutions often posted

3. **Create new issue:**
   - Include all debugging info
   - Attach console output
   - Describe expected vs actual behavior

---

### Quick Fix Checklist

Before asking for help, try:
- [ ] Reload extension
- [ ] Refresh web page
- [ ] Re-select season
- [ ] Clear browser cache
- [ ] Try different website
- [ ] Check browser console
- [ ] Verify all files present
- [ ] Test in incognito mode

---

Good luck! Most issues are fixed by reloading the extension and refreshing the page. 🔧✨
