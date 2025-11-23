/**
 * OVERLAY WIDGET
 *
 * Simplified floating widget with essential controls:
 * - Stats display
 * - Eyedropper color picker
 * - Highlight toggle
 */

(function () {
  'use strict';

  let overlayElement = null;
  let highlightEnabled = true;
  let lastPickedColor = null;
  let currentSettings = null;

  /**
   * Initialize the overlay widget
   */
  window.initializeOverlay = function (stats, settings) {
    currentSettings = settings;

    if (overlayElement) {
      overlayElement.remove();
    }

    overlayElement = createOverlay(stats, settings);
    document.body.appendChild(overlayElement);

    // Make draggable
    makeDraggable(overlayElement);

    // Load last picked color from storage
    loadLastPickedColor();
  };

  /**
   * Create overlay HTML structure
   */
  function createOverlay(stats, settings) {
    const overlay = document.createElement('div');
    overlay.id = 'season-color-overlay';
    overlay.className = 'season-overlay';

    overlay.innerHTML = `
      <div class="season-overlay-header">
        <img src="${chrome.runtime.getURL(
          'icons/blob.png',
        )}" class="season-overlay-icon" alt="Season icon">
        <div class="stat-line">
          <span class="stat-text">
            <strong class="match-count">0</strong> of
            <strong class="total-count">0</strong> match
          </span>
        </div>
        <button class="season-overlay-close" title="Close">×</button>
      </div>
      <div class="season-overlay-content">
        <button class="btn-eyedropper">
          <img src="${chrome.runtime.getURL('icons/eyedropper.png')}" alt="" class="btn-icon" />
          Pick a Color
        </button>

        <div class="last-color-display" style="display: none;">
          <div class="color-swatch-container">
            <div class="color-swatch"></div>
            <div class="color-info">
              <div class="color-hex"></div>
              <div class="color-match"></div>
            </div>
          </div>
        </div>

        <div class="highlight-toggle-container">
          <label class="toggle-label">
            <input type="checkbox" class="highlight-toggle" checked>
            <span class="toggle-switch"></span>
            <span class="toggle-text">Highlight products</span>
          </label>
        </div>
      </div>
    `;

    // Event listeners
    overlay.querySelector('.season-overlay-close').addEventListener('click', hideOverlay);
    overlay.querySelector('.btn-eyedropper').addEventListener('click', activateEyedropper);
    overlay.querySelector('.highlight-toggle').addEventListener('change', toggleHighlights);

    return overlay;
  }

  /**
   * Update overlay with current stats
   */
  window.updateOverlay = function (stats, settings) {
    if (!overlayElement) return;

    currentSettings = settings;

    const matchCount = overlayElement.querySelector('.match-count');
    const totalCount = overlayElement.querySelector('.total-count');

    if (matchCount) matchCount.textContent = stats.matchingImages || 0;
    if (totalCount) totalCount.textContent = stats.totalImages || 0;
  };

  /**
   * Load last picked color from storage
   */
  function loadLastPickedColor() {
    chrome.storage.local.get(['colorHistory'], (result) => {
      if (result.colorHistory && result.colorHistory.length > 0) {
        lastPickedColor = result.colorHistory[0];
        updateLastColorDisplay();
      }
    });
  }

  /**
   * Update last picked color display
   */
  function updateLastColorDisplay() {
    if (!overlayElement || !lastPickedColor) return;

    const display = overlayElement.querySelector('.last-color-display');
    const swatch = overlayElement.querySelector('.color-swatch');
    const hex = overlayElement.querySelector('.color-hex');
    const match = overlayElement.querySelector('.color-match');

    if (display && swatch && hex && match) {
      swatch.style.background = lastPickedColor.hex;
      hex.textContent = lastPickedColor.hex;

      const matchText = lastPickedColor.match ? `✓ ΔE ${lastPickedColor.distance}` : `✗ ΔE ${lastPickedColor.distance}`;
      match.textContent = matchText;
      match.className = 'color-match ' + (lastPickedColor.match ? 'match' : 'no-match');

      display.style.display = 'block';
    }
  }

  /**
   * Hide overlay
   */
  function hideOverlay() {
    if (overlayElement) {
      overlayElement.style.display = 'none';
    }
  }

  /**
   * Activate eyedropper tool
   */
  function activateEyedropper() {
    if (!currentSettings || !currentSettings.selectedSeason) {
      alert('Please select a season palette first');
      return;
    }

    // Dispatch event to trigger eyedropper in eyedropper.js content script
    const event = new CustomEvent('activateEyedropper', {
      detail: { season: currentSettings.selectedSeason }
    });
    document.dispatchEvent(event);

    // The eyedropper.js content script will handle the actual activation
    // and we'll update the display when color history changes
    setTimeout(loadLastPickedColor, 1000);
  }

  /**
   * Toggle highlights on/off
   */
  function toggleHighlights(e) {
    highlightEnabled = e.target.checked;

    // Send message to content script to toggle highlights
    chrome.runtime.sendMessage({
      action: 'toggleHighlights',
      enabled: highlightEnabled
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Failed to toggle highlights:', chrome.runtime.lastError);
      }
    });

    // Also dispatch custom event for content.js to listen to
    document.dispatchEvent(new CustomEvent('seasonFilterToggleHighlights', {
      detail: { enabled: highlightEnabled }
    }));
  }

  /**
   * Make overlay draggable
   */
  function makeDraggable(element) {
    const header = element.querySelector('.season-overlay-header');
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;

    header.style.cursor = 'move';

    header.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);

    function dragStart(e) {
      if (e.target.tagName === 'BUTTON') return; // Don't drag when clicking buttons

      initialX = e.clientX - (parseInt(element.style.left) || element.offsetLeft);
      initialY = e.clientY - (parseInt(element.style.top) || element.offsetTop);

      isDragging = true;
    }

    function drag(e) {
      if (!isDragging) return;

      e.preventDefault();

      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;

      element.style.left = currentX + 'px';
      element.style.top = currentY + 'px';
      element.style.right = 'auto';
      element.style.bottom = 'auto';
    }

    function dragEnd() {
      isDragging = false;
    }
  }

  // Listen for color history updates
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.colorHistory) {
      loadLastPickedColor();
    }
  });
})();
