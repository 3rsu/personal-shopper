# Eyedropper Feature Testing Guide

## Quick Test Instructions

### Step 1: Load the Extension
1. Open Chrome/Edge browser
2. Go to `chrome://extensions/`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked"
5. Select the `season-color-checker` folder
6. Verify extension appears with icon

### Step 2: Open Test Page
1. Open a new tab
2. Navigate to any website (e.g., `https://example.com`)
3. **Important**: Refresh the page (F5) to ensure content scripts load

### Step 3: Select a Season
1. Click the extension icon in toolbar
2. Select any season (e.g., "Bright Spring")
3. Verify "Manual Color Picker" section appears in popup

### Step 4: Activate Eyedropper
1. Click "Pick a Color" button
2. Popup should close automatically
3. Browser's native color picker cursor should appear

### Step 5: Pick a Color
1. Move cursor over any element on the page
2. Click to select a color
3. Wait for result card to appear (2-5 seconds)
4. Result should show:
   - Color hex code (e.g., `#FF5733`)
   - Match status (✓ or ✗)
   - Distance value (ΔE)
   - Closest palette color

### Step 6: Check History
1. Open extension popup again
2. Scroll to "Recently Picked" section
3. Verify picked color appears in history
4. Check color swatch, hex, match status, and distance

### Step 7: Test Clear History
1. In popup, click "Clear" button in history section
2. Verify history is empty
3. Pick another color
4. Verify it appears in history

---

## Detailed Testing Scenarios

### Scenario 1: Basic Color Matching

**Test Case**: Pick a color from a solid background

1. Go to `https://example.com`
2. Refresh page (F5)
3. Activate eyedropper
4. Click on white background
5. **Expected**: Should pick `#FFFFFF` or close to it
6. Result card should show "Matches your palette" or "Outside your palette"
7. Open popup → verify color in history

### Scenario 2: Image Color Sampling

**Test Case**: Pick color from an image

1. Go to any site with images (e.g., Wikipedia)
2. Refresh page (F5)
3. Activate eyedropper
4. Click on colored part of image
5. **Expected**: Should capture color from image
6. Result card appears with color info
7. History updated

### Scenario 3: Multiple Picks

**Test Case**: Pick multiple colors in sequence

1. Activate eyedropper
2. Pick color #1 → wait for result
3. Activate eyedropper again
4. Pick color #2 → wait for result
5. Activate eyedropper again
6. Pick color #3 → wait for result
7. Open popup → verify all 3 colors in history (newest first)

### Scenario 4: Season Change

**Test Case**: Pick colors with different seasons

1. Select "Bright Spring" season
2. Pick a red color
3. Note match status (e.g., "No match")
4. Change season to "Deep Autumn"
5. Pick the same red color
6. **Expected**: Match status might be different
7. History shows colors for both seasons

### Scenario 5: Cancel Operation

**Test Case**: Activate and cancel without picking

1. Activate eyedropper
2. Press ESC key or click browser back button
3. **Expected**: Eyedropper closes, no color picked
4. No new entry in history

### Scenario 6: Error Handling

**Test Case**: No season selected

1. Install fresh extension (or clear storage)
2. Open popup (no season selected)
3. Try to click "Pick a Color"
4. **Expected**: Button should be disabled OR alert "Please select a season first!"

### Scenario 7: CORS-Protected Sites

**Test Case**: Test on sites that previously failed auto-detect

1. Go to Amazon product page (e.g., `https://www.amazon.com/dp/B08N5WRWNW`)
2. Refresh page
3. Activate eyedropper
4. Pick color from product image
5. **Expected**: Should work without CORS errors
6. Result appears with match status

**More CORS test sites**:
- Etsy: `https://www.etsy.com/`
- Pinterest: `https://www.pinterest.com/`
- eBay: `https://www.ebay.com/`

### Scenario 8: History Persistence

**Test Case**: History survives extension reload

1. Pick 3-5 colors
2. Verify they appear in history
3. Go to `chrome://extensions/`
4. Click reload icon (🔄) on Season Color Checker
5. Go back to test page and refresh (F5)
6. Open popup
7. **Expected**: History still shows picked colors

### Scenario 9: History Limit

**Test Case**: Test 50-item limit

1. Pick 50+ colors (can do this quickly by repeatedly activating)
2. Open popup history
3. **Expected**: Only 50 most recent colors shown
4. Oldest colors automatically removed

### Scenario 10: Cross-Tab Functionality

**Test Case**: Pick colors from different tabs

1. Open tab A (e.g., example.com)
2. Pick color → verify result
3. Open tab B (e.g., wikipedia.org)
4. Pick color → verify result
5. Open popup
6. **Expected**: History shows colors from both tabs

---

## Browser Console Verification

### Check for Expected Logs

Open DevTools (F12) → Console tab and look for:

**On page load**:
```
[Eyedropper] Content script loaded and ready
```

**When activating eyedropper**:
```
[Eyedropper] Activating for season: bright-spring
[Eyedropper] Opening native picker...
```

**When color is picked**:
```
[Eyedropper] Picked color: #FF5733
[Eyedropper] Color saved to history
```

**If user cancels**:
```
[Eyedropper] User cancelled
```

### Check for Errors

**Should NOT see**:
- ❌ `ColorProcessor not loaded`
- ❌ `Season palettes not loaded`
- ❌ `Failed to analyze color`
- ❌ `Extension context invalidated`
- ❌ `Could not establish connection`
- ❌ `Failed to send message`

**If you see these**, try:
1. Refresh the page
2. Reload the extension
3. Check manifest.json includes eyedropper.js in content_scripts

---

## Performance Testing

### CPU Usage
1. Open Task Manager (Chrome: Shift+Esc)
2. Find "Season Color Checker" processes
3. Activate eyedropper
4. Move cursor around page
5. **Expected**: CPU usage should be low (<5%)

### Memory Usage
1. In Task Manager, note memory before activation
2. Activate and use eyedropper 10 times
3. Note memory after
4. **Expected**: Memory increase should be minimal (<5MB)
5. Should not leak memory with repeated use

### Responsiveness
1. Activate eyedropper
2. Move cursor quickly across page
3. **Expected**: Browser should remain responsive
4. No lag or stuttering

---

## Edge Cases

### Edge Case 1: Transparent Elements

**Test**: Pick from element with transparency

1. Find element with `opacity < 1` or transparent background
2. Pick color from it
3. **Expected**: Should sample visible color (as rendered)

### Edge Case 2: Iframes

**Test**: Pick from iframe content

1. Find page with iframe (e.g., embedded video)
2. Try to pick color from iframe
3. **Expected**:
   - Same-origin iframe: Should work
   - Cross-origin iframe: Browser may block (security)

### Edge Case 3: Very Small Elements

**Test**: Pick from 1px element

1. Find very small element (border, thin line)
2. Try to pick color
3. **Expected**: Should work but may be hard to target

### Edge Case 4: Animated Elements

**Test**: Pick from CSS animation

1. Find element with color animation
2. Pick color during animation
3. **Expected**: Captures color at moment of click

### Edge Case 5: SVG Elements

**Test**: Pick from SVG graphic

1. Find page with SVG (e.g., logo, icon)
2. Pick color from SVG path
3. **Expected**: Should capture SVG fill/stroke color

---

## Regression Testing

After any code changes, verify:

- [ ] Extension loads without errors
- [ ] Popup opens and shows UI
- [ ] Season selection works
- [ ] Eyedropper activates
- [ ] Color picking works
- [ ] Result card displays correctly
- [ ] History saves and displays
- [ ] Clear history works
- [ ] Works on multiple sites
- [ ] No console errors
- [ ] No memory leaks

---

## Known Limitations

### Expected Behaviors (Not Bugs):

1. **Browser Support**: Only works in Chrome/Edge 95+
   - Firefox/Safari: Native EyeDropper API not available

2. **Cross-Origin Iframes**: Cannot sample from cross-origin iframes
   - Browser security restriction
   - No workaround available

3. **Page Refresh Required**: After extension reload, page must be refreshed
   - Content scripts only inject on page load/navigation

4. **Single Pixel Sampling**: Samples exact pixel color, not average
   - Different from auto-detect which analyzes multiple pixels
   - Both approaches valid for different use cases

5. **Result Display Duration**: Result card shows for 5 seconds
   - Configurable via `RESULT_DISPLAY_MS` constant
   - Can be changed if needed

---

## Debugging Tips

### If Eyedropper Doesn't Activate:

1. **Check content script loaded**:
   ```javascript
   // In browser console:
   console.log(typeof activateEyedropper);
   // Should output: "function" (not "undefined")
   ```

2. **Check message listener**:
   ```javascript
   // Send test message:
   chrome.tabs.query({active: true}, (tabs) => {
     chrome.tabs.sendMessage(tabs[0].id, {
       action: 'activateEyedropper',
       season: 'bright-spring'
     }, (response) => console.log(response));
   });
   // Should see: {success: true}
   ```

3. **Check EyeDropper API support**:
   ```javascript
   // In page console:
   console.log('EyeDropper' in window);
   // Should output: true
   ```

### If Color Analysis Fails:

1. **Check ColorProcessor**:
   ```javascript
   // In page console:
   console.log(typeof ColorProcessor);
   // Should output: "function"
   ```

2. **Check palettes**:
   ```javascript
   // In page console:
   console.log(Object.keys(SEASONAL_PALETTES));
   // Should show: ["bright-spring", "deep-winter", ...]
   ```

### If History Doesn't Save:

1. **Check storage**:
   ```javascript
   // In extension console:
   chrome.storage.local.get(['colorHistory'], (data) => {
     console.log('History:', data.colorHistory);
   });
   ```

2. **Check permissions**:
   - Go to `chrome://extensions/`
   - Click "Details" on Season Color Checker
   - Verify "Storage" permission is granted

---

## Test Report Template

```
## Eyedropper Test Report

**Date**: YYYY-MM-DD
**Tester**: [Your Name]
**Browser**: Chrome/Edge [Version]
**OS**: macOS/Windows/Linux [Version]

### Basic Functionality
- [ ] Extension loads
- [ ] Eyedropper activates
- [ ] Color picking works
- [ ] Result displays
- [ ] History saves

### Sites Tested
- [ ] example.com
- [ ] wikipedia.org
- [ ] amazon.com
- [ ] etsy.com
- [ ] [Other]

### Issues Found
1. [Issue description]
   - Severity: Critical/High/Medium/Low
   - Steps to reproduce: ...
   - Expected: ...
   - Actual: ...

### Performance
- CPU usage: [Normal/High]
- Memory usage: [Normal/High]
- Responsiveness: [Good/Poor]

### Overall Status
- [ ] Pass - Ready for production
- [ ] Pass with minor issues
- [ ] Fail - Blocking issues found

### Notes
[Any additional observations]
```

---

**Last Updated**: 2024-11-23
**Version**: 1.0.0
**Feature**: Native EyeDropper API Implementation
