# Troubleshooting Guide

## Common Issues & Solutions

### Issue: "Extension context invalidated" Error

**Error Message:**
```
Uncaught Error: Extension context invalidated.
```

**Cause**: The extension was reloaded or updated while a page was still using it.

**Solution**:
1. Refresh the webpage (F5 or Cmd+R)
2. Try the eyedropper again

**Prevention**: After reloading the extension, always refresh open tabs before using features.

---

### Issue: "Cannot read properties of undefined (reading 'selectedSeason')"

**Error Message:**
```
[Eyedropper] Failed to get settings: TypeError: Cannot read properties of undefined (reading 'selectedSeason')
```

**Cause**: The service worker response is `undefined` or incorrectly formatted.

**Solution**:
1. **Check if season is selected**:
   - Open popup
   - Select a season (e.g., "Bright Spring")
   - Try eyedropper again

2. **Reload the extension**:
   - Go to `chrome://extensions/`
   - Find "Season Color Checker"
   - Click the reload icon (🔄)
   - Refresh your webpage
   - Try again

3. **Check browser console**:
   - Press F12 to open DevTools
   - Look for additional error messages
   - Take note of the full error stack

**Fixed in Latest Version**: This should be resolved - the eyedropper now checks for `response` before accessing properties.

---

### Issue: Eyedropper button is grayed out

**Symptom**: "Pick a Color" button is disabled/unclickable

**Cause**: No season selected

**Solution**:
1. Open the extension popup
2. Choose your seasonal palette (click any season card)
3. Button should become clickable
4. Try activating the eyedropper

---

### Issue: Magnifier doesn't appear

**Symptom**: Cursor changes to crosshair, but no magnifier shows up

**Possible Causes**:
1. Page CSS conflicts
2. Z-index issues
3. Script injection failed

**Solutions**:

**Try 1: Refresh and retry**
```
1. Press ESC to exit eyedropper
2. Refresh page (F5)
3. Activate eyedropper again
```

**Try 2: Check console**
```
1. Open DevTools (F12)
2. Look for errors like:
   - "Shadow DOM not supported"
   - "Failed to execute 'attachShadow'"
3. Report these errors
```

**Try 3: Test on different site**
```
1. Try on a simple site (e.g., example.com)
2. If it works there, the original site has conflicts
3. Report the problematic site
```

---

### Issue: Colors seem wrong

**Symptom**: Picked colors don't match what you see visually

**Possible Causes**:
1. Dark mode extension is active
2. Browser color filter enabled
3. Monitor color profile
4. OS night light/flux

**Solutions**:

**Check browser extensions**:
```
1. Disable dark mode extensions temporarily
2. Disable color-blind filters
3. Try eyedropper again
```

**Check OS settings**:
- **macOS**: System Preferences → Displays → Color
- **Windows**: Settings → Display → Night light
- **Linux**: Varies by desktop environment

**Test with neutral colors**:
```
1. Pick pure white (#FFFFFF)
2. Pick pure black (#000000)
3. If these are correct, issue is site-specific
```

---

### Issue: Can't click certain elements

**Symptom**: Some areas of the page don't respond to clicks

**Possible Causes**:
1. Element is in cross-origin iframe
2. Element has `pointer-events: none`
3. Element is behind another element

**Solutions**:

**Try nearby elements**:
```
1. Click slightly to the left/right
2. Try parent/sibling elements
```

**Use browser DevTools as backup**:
```
1. Right-click element → Inspect
2. Look at Computed styles
3. Find background-color or color value
4. Manually check against palette
```

**Known limitation**: Cross-origin iframes cannot be sampled due to browser security.

---

### Issue: History not saving

**Symptom**: Picked colors don't appear in history

**Possible Causes**:
1. Storage quota exceeded (unlikely)
2. Extension permissions issue
3. Service worker error

**Solutions**:

**Check storage**:
```javascript
// In browser console (F12):
chrome.storage.local.get(['colorHistory'], (data) => {
  console.log('History:', data.colorHistory);
});
```

**Clear and retry**:
```
1. Open popup
2. Click "Clear" in history section
3. Pick a new color
4. Check if it appears
```

**Check permissions**:
```
1. Go to chrome://extensions/
2. Find Season Color Checker
3. Click "Details"
4. Ensure "Storage" permission is granted
```

---

### Issue: Popup won't close after clicking "Pick a Color"

**Symptom**: Popup stays open instead of closing

**Cause**: JavaScript error preventing `window.close()`

**Solutions**:

**Manually close**:
```
1. Click outside the popup
2. Or press ESC
3. Try picking color anyway (cursor should be crosshair)
```

**Check console**:
```
1. Right-click popup → Inspect
2. Look for JavaScript errors
3. Report the error message
```

---

### Issue: Result card doesn't appear

**Symptom**: Click to pick color, but no result shows

**Possible Causes**:
1. Color analysis failed
2. Season palette not loaded
3. DOM insertion blocked

**Solutions**:

**Check console messages**:
```
Look for:
- "[Eyedropper] Picked color: ..."
- "[Eyedropper] Analysis failed: ..."
- "ColorProcessor not loaded"
```

**Verify palette is loaded**:
```javascript
// In console:
console.log(SEASONAL_PALETTES);
// Should show all 12 seasons
```

**Try different element**:
```
1. Pick from a solid background
2. Avoid transparent elements
3. Try text elements
```

---

### Issue: Extension crashes browser

**Symptom**: Browser becomes unresponsive when using eyedropper

**Cause**: Infinite loop or memory leak (should not happen)

**Immediate action**:
```
1. Press ESC to exit eyedropper
2. If unresponsive, close tab
3. Report this immediately with:
   - Browser version
   - Website URL
   - Steps that caused it
```

**Prevention**:
```
1. Don't rapidly click while picking
2. Wait for magnifier to appear before moving mouse
3. Use on one tab at a time
```

---

## Browser-Specific Issues

### Chrome

**Issue**: "Manifest version 2 is deprecated"
- **Solution**: Ignore this warning - extension uses Manifest V3

**Issue**: Extension doesn't load
- **Solution**: Enable "Developer mode" in chrome://extensions/

### Edge

**Issue**: Extension not found in store
- **Solution**: Load unpacked in Developer mode (same as Chrome)

### Brave

**Issue**: Shield blocks extension
- **Solution**: Disable Shields for extension popup page

---

## Performance Issues

### Issue: Magnifier is laggy

**Cause**: Mouse tracking throttled to 60fps by design

**Not an issue**: This is intentional for performance

**If truly laggy**:
```
1. Close other tabs
2. Disable other extensions temporarily
3. Check CPU usage in Task Manager
```

### Issue: High memory usage

**Expected usage**: ~5-10MB for extension

**Check actual usage**:
```
1. chrome://extensions/
2. Click "Details" on Season Color Checker
3. Look at "Inspect views: service worker"
4. Check memory in Task Manager
```

**If abnormally high (>50MB)**:
```
1. Reload extension
2. Clear color history
3. Restart browser
```

---

## Debugging Tips

### Enable verbose logging

```javascript
// In eyedropper.js, change:
const DEBUG = true; // (add this at top)

// Then all console.log will be visible
```

### Check message passing

```javascript
// In browser console:
chrome.runtime.onMessage.addListener((msg) => {
  console.log('Message received:', msg);
});
```

### Inspect Shadow DOM

```
1. Open DevTools (F12)
2. Go to Elements tab
3. Find #season-color-eyedropper
4. Expand #shadow-root (open)
5. Inspect styles
```

### Monitor storage

```javascript
// Watch storage changes:
chrome.storage.onChanged.addListener((changes, area) => {
  console.log('Storage changed:', changes, 'in', area);
});
```

---

## Reporting Bugs

When reporting issues, please include:

1. **Browser & Version**: Chrome 120, Edge 119, etc.
2. **OS**: macOS 14, Windows 11, etc.
3. **Website URL**: Where the issue occurred
4. **Steps to reproduce**: What you did
5. **Console errors**: F12 → Console → screenshot
6. **Expected vs Actual**: What should vs. what did happen

**Example Report**:
```
Browser: Chrome 120.0.6099.129
OS: macOS 14.1.1
URL: https://www.amazon.com/dp/B08N5WRWNW
Steps:
  1. Selected "Bright Spring" season
  2. Clicked "Pick a Color"
  3. Hovered over product image
  4. Magnifier didn't appear

Console errors:
  [Eyedropper] Failed to get settings: undefined

Expected: Magnifier should appear
Actual: Only crosshair cursor, no magnifier
```

---

## Emergency Fixes

### Nuclear option: Complete reset

```
1. Go to chrome://extensions/
2. Remove Season Color Checker
3. Clear browsing data:
   - chrome://settings/clearBrowserData
   - Select "Cached images and files"
   - Time range: "All time"
4. Restart browser
5. Reinstall extension
6. Load unpacked from folder
```

### Force reload service worker

```
1. chrome://extensions/
2. Find Season Color Checker
3. Click "Inspect views: service worker"
4. In DevTools: Application → Service Workers
5. Click "Unregister"
6. Reload extension
```

---

## Still Having Issues?

1. **Check documentation**:
   - [EYEDROPPER-FEATURE.md](EYEDROPPER-FEATURE.md)
   - [QUICK-START.md](QUICK-START.md)
   - [README.md](README.md)

2. **Try minimal test**:
   ```
   1. Open https://example.com
   2. Select a season
   3. Activate eyedropper
   4. Pick color from white background
   5. Does this work?
   ```

3. **Collect debug info**:
   - Browser console logs
   - Network tab (any failed requests?)
   - Extension console (service worker)
   - Screenshot of issue

4. **Search for similar issues**: Check if others reported it

5. **Report with full details**: See "Reporting Bugs" above

---

**Last Updated**: 2024-11-23
**Version**: 1.0.0
