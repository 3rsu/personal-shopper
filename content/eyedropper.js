/**
 * Eyedropper Tool - Manual Color Picker
 *
 * Uses the native EyeDropper API for accurate color sampling.
 * Loaded as content script but waits for activation message.
 */

(function() {
  'use strict';

  const RESULT_DISPLAY_MS = 5000;

  /**
   * Activate the eyedropper
   */
  async function activateEyedropper(selectedSeason) {
    console.log('[Eyedropper] Activating for season:', selectedSeason);

    // Check if EyeDropper API is supported
    if (!window.EyeDropper) {
      showError('Color picker not supported in this browser. Please use Chrome/Edge 95+');
      return;
    }

    try {
      const eyeDropper = new EyeDropper();
      console.log('[Eyedropper] Opening native picker...');

      const result = await eyeDropper.open();

      if (result && result.sRGBHex) {
        const hexColor = result.sRGBHex;
        console.log('[Eyedropper] Picked color:', hexColor);

        // Convert hex to RGB
        const rgb = hexToRgb(hexColor);

        if (rgb) {
          // Analyze the color
          await analyzeColor(rgb, hexColor, selectedSeason);
        } else {
          showError('Failed to process color');
        }
      } else {
        console.log('[Eyedropper] User cancelled');
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('[Eyedropper] User cancelled');
      } else {
        console.error('[Eyedropper] Error:', error);
        showError('Failed to pick color: ' + error.message);
      }
    }
  }

  /**
   * Analyze picked color against season palette
   */
  async function analyzeColor(rgb, hex, selectedSeason) {
    try {
      // ColorProcessor and SEASONAL_PALETTES are available from content scripts
      if (typeof ColorProcessor === 'undefined') {
        throw new Error('ColorProcessor not loaded');
      }

      if (typeof SEASONAL_PALETTES === 'undefined') {
        throw new Error('Season palettes not loaded');
      }

      // Get palette colors for selected season
      const palette = SEASONAL_PALETTES[selectedSeason];
      if (!palette) {
        console.error('[Eyedropper] Season not found:', selectedSeason);
        console.error('[Eyedropper] Available seasons:', Object.keys(SEASONAL_PALETTES));
        throw new Error('Season palette not found');
      }

      console.log('[Eyedropper] Using palette:', palette.name);
      console.log('[Eyedropper] Palette has', palette.colors.length, 'colors');

      // Use ColorProcessor's findClosestMatch method
      const processor = new ColorProcessor();
      const match = processor.findClosestMatch(hex, palette.colors);

      if (!match || !match.closestColor) {
        throw new Error('Failed to find closest color match');
      }

      const closestMatch = {
        color: match.closestColor,
        distance: Math.round(match.deltaE)
      };

      // Determine if it's a match (ΔE < 20)
      const isMatch = match.isMatch;

      // Save to history
      await savePickedColor({
        hex: hex,
        rgb: rgb,
        match: isMatch,
        closestMatch: closestMatch.color,
        distance: closestMatch.distance,
        season: selectedSeason,
        timestamp: Date.now()
      });

      // Show result on page
      showResult(hex, isMatch, closestMatch);

    } catch (error) {
      console.error('[Eyedropper] Analysis failed:', error);
      showError('Failed to analyze color: ' + error.message);
    }
  }

  /**
   * Show color match result on page
   */
  function showResult(hex, isMatch, closestMatch) {
    const resultContainer = document.createElement('div');
    resultContainer.id = 'season-color-result';
    resultContainer.style.cssText = `
      position: fixed;
      left: 50%;
      top: 20px;
      transform: translateX(-50%);
      z-index: 2147483646;
      animation: slideDown 0.3s ease;
    `;

    const resultShadow = resultContainer.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideDown {
        from {
          opacity: 0;
          transform: translateY(-20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .result-card {
        background: white;
        border: 3px solid ${isMatch ? '#10b981' : '#ef4444'};
        border-radius: 12px;
        padding: 20px;
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
        min-width: 280px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .result-header {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 16px;
      }

      .color-swatch {
        width: 60px;
        height: 60px;
        border-radius: 8px;
        border: 2px solid rgba(0, 0, 0, 0.1);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        flex-shrink: 0;
      }

      .color-info {
        flex: 1;
      }

      .color-hex {
        font-size: 20px;
        font-weight: 600;
        color: #1f2937;
        margin: 0 0 6px 0;
        font-family: 'Monaco', 'Courier New', monospace;
      }

      .match-status {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 15px;
        font-weight: 600;
        color: ${isMatch ? '#10b981' : '#ef4444'};
      }

      .match-icon {
        font-size: 18px;
      }

      .result-details {
        border-top: 1px solid #e5e7eb;
        padding-top: 12px;
        margin-top: 8px;
      }

      .detail-row {
        display: flex;
        justify-content: space-between;
        margin: 8px 0;
        font-size: 14px;
      }

      .detail-label {
        color: #6b7280;
      }

      .detail-value {
        color: #1f2937;
        font-weight: 600;
        font-family: 'Monaco', 'Courier New', monospace;
      }

      .closest-match {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .closest-swatch {
        width: 24px;
        height: 24px;
        border-radius: 4px;
        border: 1px solid rgba(0, 0, 0, 0.1);
      }
    `;
    resultShadow.appendChild(style);

    const card = document.createElement('div');
    card.className = 'result-card';
    card.innerHTML = `
      <div class="result-header">
        <div class="color-swatch" style="background: ${hex};"></div>
        <div class="color-info">
          <div class="color-hex">${hex}</div>
          <div class="match-status">
            <span class="match-icon">${isMatch ? '✓' : '✗'}</span>
            <span>${isMatch ? 'Matches your palette' : 'Outside your palette'}</span>
          </div>
        </div>
      </div>
      <div class="result-details">
        <div class="detail-row">
          <span class="detail-label">Distance:</span>
          <span class="detail-value">ΔE ${closestMatch.distance}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Closest match:</span>
          <div class="closest-match">
            <div class="closest-swatch" style="background: ${closestMatch.color};"></div>
            <span class="detail-value">${closestMatch.color}</span>
          </div>
        </div>
      </div>
    `;

    resultShadow.appendChild(card);
    document.body.appendChild(resultContainer);

    setTimeout(() => {
      resultContainer.style.opacity = '0';
      resultContainer.style.transition = 'opacity 0.3s ease';
      setTimeout(() => resultContainer.remove(), 300);
    }, RESULT_DISPLAY_MS);
  }

  /**
   * Show error message
   */
  function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #ef4444;
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 600;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      z-index: 2147483647;
      animation: slideDown 0.3s ease;
    `;
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);

    setTimeout(() => errorDiv.remove(), 3000);
  }

  /**
   * Save picked color to storage
   */
  async function savePickedColor(colorData) {
    try {
      await chrome.runtime.sendMessage({
        action: 'savePickedColor',
        color: colorData
      });
      console.log('[Eyedropper] Color saved to history');
    } catch (error) {
      console.error('[Eyedropper] Failed to save color:', error);
    }
  }

  /**
   * Convert hex to RGB
   */
  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)
    ] : null;
  }

  // Listen for activation message from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'activateEyedropper' && message.season) {
      activateEyedropper(message.season);
      sendResponse({ success: true });
      return true;
    }
  });

  console.log('[Eyedropper] Content script loaded and ready');

})();
