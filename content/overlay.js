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

    // Set initial visibility based on showOverlay setting
    if (settings.showOverlay === false) {
      overlayElement.style.display = 'none';
    }
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
        <button class="season-overlay-close" title="Hide">×</button>
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
      </div>
    `;

    // Event listeners
    overlay.querySelector('.season-overlay-close').addEventListener('click', hideOverlay);
    overlay.querySelector('.btn-eyedropper').addEventListener('click', activateEyedropper);

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
      } else {
        lastPickedColor = null;
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

    // Update storage - all listeners will sync automatically
    chrome.storage.sync.set({ showOverlay: false });
  }

  /**
   * Show overlay
   */
  function showOverlay() {
    if (overlayElement) {
      overlayElement.style.display = 'block';
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

  // Listen for storage changes
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.colorHistory) {
      loadLastPickedColor();
    }

    // Listen for overlay visibility changes
    if (areaName === 'sync' && changes.showOverlay) {
      const showOverlay = changes.showOverlay.newValue;

      // Update overlay visibility
      if (overlayElement) {
        overlayElement.style.display = showOverlay ? 'block' : 'none';
      }
    }

    // Listen for filter enabled state changes
    if (areaName === 'sync' && changes.filterEnabled) {
      const enabled = changes.filterEnabled.newValue;

      // Dispatch custom event for content.js to handle highlighting
      document.dispatchEvent(new CustomEvent('seasonFilterToggleHighlights', {
        detail: { enabled: enabled }
      }));
    }
  });

  /**
   * ===================================
   * SWATCH SUMMARY NOTIFICATION
   * ===================================
   */

  let summaryNotification = null;
  let summaryTimeout = null;

  /**
   * Show swatch summary notification
   */
  window.showSwatchSummary = function (stats, settings) {
    // Remove existing notification if any
    if (summaryNotification) {
      summaryNotification.remove();
      clearTimeout(summaryTimeout);
    }

    // Don't show if no swatches found
    if (stats.totalSwatches === 0) return;

    // Create notification
    summaryNotification = createSummaryNotification(stats, settings);
    document.body.appendChild(summaryNotification);

    // Auto-dismiss after 5 seconds
    summaryTimeout = setTimeout(() => {
      dismissSummary();
    }, 5000);
  };

  /**
   * Create summary notification HTML
   */
  function createSummaryNotification(stats, settings) {
    const notification = document.createElement('div');
    notification.className = 'season-swatch-summary';

    const matchCount = stats.matchingSwatches;
    const totalCount = stats.totalSwatches;

    // Determine icon and message based on results
    let icon = '✓';
    let message = '';
    let className = 'has-matches';

    if (matchCount === 0) {
      icon = '✗';
      message = `None of the ${totalCount} colors match your ${formatSeasonName(settings.selectedSeason)} palette`;
      className = 'no-matches';
    } else if (matchCount === totalCount) {
      icon = '✓';
      message = `All ${totalCount} colors match your ${formatSeasonName(settings.selectedSeason)} palette`;
      className = 'all-matches';
    } else {
      icon = '✓';
      message = `${matchCount} of ${totalCount} colors match your ${formatSeasonName(settings.selectedSeason)} palette`;
      className = 'has-matches';
    }

    notification.innerHTML = `
      <div class="summary-content ${className}">
        <span class="summary-icon">${icon}</span>
        <span class="summary-message">${message}</span>
        <button class="summary-close" title="Close">×</button>
      </div>
    `;

    // Close button handler
    notification.querySelector('.summary-close').addEventListener('click', dismissSummary);

    return notification;
  }

  /**
   * Format season name for display
   */
  function formatSeasonName(season) {
    if (!season) return '';
    // Convert 'bright-spring' to 'Bright Spring'
    return season
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Dismiss summary notification
   */
  function dismissSummary() {
    if (summaryNotification) {
      summaryNotification.classList.add('fade-out');
      setTimeout(() => {
        if (summaryNotification) {
          summaryNotification.remove();
          summaryNotification = null;
        }
      }, 300);
    }
    if (summaryTimeout) {
      clearTimeout(summaryTimeout);
      summaryTimeout = null;
    }
  }

})();
