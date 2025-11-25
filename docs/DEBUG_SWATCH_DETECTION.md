# Debugging Swatch Detection Issues

## Current Issue

All products in a grid layout are getting the same swatch color, indicating the container detection or spatial validation is not working correctly.

## Enhanced Debug Logging Added

I've added comprehensive console logging to help diagnose the issue:

### 1. Container Detection Logging
- Image dimensions and position
- Which selectors are being tried
- Container validation results (size, ratio to viewport)
- Whether Phase 1 (semantic), Phase 2 (spatial clustering), or Phase 3 (traversal) is used

### 2. Tier Detection Logging
- Which tier successfully finds a selected swatch
- Selected swatch element and its position
- Summary of how many swatches were found at each stage

### 3. Spatial Validation Logging
- Swatch position vs container position
- Distance calculations to product image
- Whether proximity validation passes or fails

## How to Debug

1. **Reload the extension**:
   ```bash
   # In Chrome, go to chrome://extensions
   # Click the reload button on "Shop Your Color: Seasonal Color Filter"
   ```

2. **Navigate to the problematic page** (the grid with jackets)

3. **Open Chrome DevTools** (F12 or Cmd+Option+I)

4. **Check the Console tab** for logs starting with `[Swatch Priority]`

5. **Look for these key indicators**:

   a. **Container Detection**:
   ```
   [Swatch Priority] ======================================
   [Swatch Priority] Finding product container for image: ...
   [Swatch Priority] Found container candidate with selector: article
   [Swatch Priority] ✓ Found container via selector: article
   ```

   **Questions to ask**:
   - Is the SAME container being found for all 4 products?
   - Is the container too large (spanning multiple products)?
   - What are the container dimensions vs image dimensions?

   b. **Swatch Detection**:
   ```
   [Swatch Priority Tier 2] Found 4 elements for selector: .swatch.selected
   [Swatch Priority Tier 2] Summary: { totalFound: 4, totalValid: 4, totalProximityPass: 1, candidates: 1 }
   ```

   **Questions to ask**:
   - How many swatches are found in the container?
   - Are all 4 products' swatches in the same container?
   - How many pass spatial proximity validation?

   c. **Spatial Validation**:
   ```
   [Swatch Priority] Distance to product image: 150 px (max: 300px)
   [Swatch Priority] ✓ Spatial validation passed
   ```

   **Questions to ask**:
   - What's the distance between each image and its selected swatch?
   - Are swatches from Product 2-4 failing distance checks?

## Expected Behavior

For a 4-product grid layout, you should see:

1. **4 separate container detections** (one per product image)
2. **Each container should be ~25% of viewport width** (not 100%)
3. **Each product should have 1 selected swatch** within 300px
4. **Distance from Product 1's image to Product 2's swatch should be > 300px** (fail validation)

## Likely Root Causes

Based on the screenshot showing all products with the same color:

### Cause 1: Container Too Large
The `findProductContainer` function is finding a parent container that wraps ALL 4 products instead of individual product containers.

**Fix**: Adjust `validateContainerSize` to be stricter, or add better selectors for this specific site.

### Cause 2: No Spatial Validation Being Applied
The product image is not being passed to the tier detection functions, so spatial distance validation is skipped.

**Fix**: Verify `img` parameter is being passed correctly to `findByCommonClasses(container, img)`.

### Cause 3: All Swatches Have Same Class
If all products share a common swatch selection (e.g., "brown" is selected on all products), and the container spans all products, it will return the first brown swatch for all images.

**Fix**: Spatial clustering needs to create individual containers per product.

## Next Steps

1. **Share the console logs** with me so I can see what's happening
2. Based on the logs, I'll identify the exact issue
3. I'll update the code with the appropriate fix
4. We'll test again to verify the fix works

## Additional Debug Commands

You can also run these in the console to inspect the DOM:

```javascript
// Find all product images on the page
const images = document.querySelectorAll('img[src*="product"], img[src*="jacket"]');
console.log('Total product images:', images.length);

// For each image, check what container would be found
images.forEach((img, i) => {
  const article = img.closest('article');
  console.log(`Image ${i}:`, {
    src: img.src.substring(0, 50),
    container: article?.tagName,
    containerWidth: article?.offsetWidth,
    containerClasses: article?.className
  });
});

// Find all selected swatches
const swatches = document.querySelectorAll('[class*="swatch"][class*="selected"], [class*="swatch"][class*="active"]');
console.log('Total selected swatches:', swatches.length);
swatches.forEach((s, i) => {
  console.log(`Swatch ${i}:`, s.getBoundingClientRect(), getComputedStyle(s).backgroundColor);
});
```
