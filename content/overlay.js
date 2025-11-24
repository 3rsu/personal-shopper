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
  let showAllColors = false;
  let colorHistory = [];

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
          <span class="swatch-stats" style="display: none; margin-top: 4px; font-size: 12px; color: #6b7280;">
            <strong class="swatch-match-count">0</strong>/<strong class="swatch-total-count">0</strong> colors
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

        <button class="btn-show-all" style="display: none;">Show All</button>

        <div class="color-history-expanded" style="display: none;">
          <div class="color-history-list"></div>
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
    overlay.querySelector('.btn-show-all').addEventListener('click', toggleShowAll);

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

    // Update swatch stats if available
    const swatchStats = overlayElement.querySelector('.swatch-stats');
    const swatchMatchCount = overlayElement.querySelector('.swatch-match-count');
    const swatchTotalCount = overlayElement.querySelector('.swatch-total-count');

    if (stats.totalSwatches > 0 && swatchStats && swatchMatchCount && swatchTotalCount) {
      swatchMatchCount.textContent = stats.matchingSwatches || 0;
      swatchTotalCount.textContent = stats.totalSwatches || 0;
      swatchStats.style.display = 'block';
    } else if (swatchStats) {
      swatchStats.style.display = 'none';
    }
  };

  /**
   * Load last picked color from storage
   */
  function loadLastPickedColor() {
    chrome.storage.local.get(['colorHistory'], (result) => {
      if (result.colorHistory && result.colorHistory.length > 0) {
        colorHistory = result.colorHistory;
        lastPickedColor = result.colorHistory[0];
        updateLastColorDisplay();
        if (showAllColors) {
          renderColorHistoryList();
        }
      } else {
        colorHistory = [];
        lastPickedColor = null;
      }
      // Always update button visibility based on current color history
      updateShowAllButton();
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
   * Update Show All button visibility
   */
  function updateShowAllButton() {
    if (!overlayElement) return;

    const showAllBtn = overlayElement.querySelector('.btn-show-all');
    if (!showAllBtn) return;

    if (colorHistory.length > 0) {
      showAllBtn.style.display = 'block';
      showAllBtn.textContent = showAllColors ? 'Show Less' : 'Show All';
    } else {
      showAllBtn.style.display = 'none';
    }
  }

  /**
   * Toggle show all colors
   */
  function toggleShowAll() {
    showAllColors = !showAllColors;

    if (!overlayElement) return;

    const expandedContainer = overlayElement.querySelector('.color-history-expanded');
    const lastColorDisplay = overlayElement.querySelector('.last-color-display');
    const showAllBtn = overlayElement.querySelector('.btn-show-all');

    if (showAllColors) {
      // Show expanded list, hide single display
      if (lastColorDisplay) lastColorDisplay.style.display = 'none';
      if (expandedContainer) expandedContainer.style.display = 'block';
      if (showAllBtn) showAllBtn.textContent = 'Show Less';
      renderColorHistoryList();
    } else {
      // Show single display, hide expanded list
      if (expandedContainer) expandedContainer.style.display = 'none';
      if (lastColorDisplay) lastColorDisplay.style.display = 'block';
      if (showAllBtn) showAllBtn.textContent = 'Show All';
    }
  }

  /**
   * Render color history list (multiple colors)
   */
  function renderColorHistoryList() {
    if (!overlayElement || colorHistory.length === 0) return;

    const listContainer = overlayElement.querySelector('.color-history-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    // Show up to 10 colors
    const colorsToShow = colorHistory.slice(0, 10);

    colorsToShow.forEach((color) => {
      const item = document.createElement('div');
      item.className = 'history-item';

      const matchText = color.match ? `✓ ΔE ${color.distance}` : `✗ ΔE ${color.distance}`;
      const matchClass = color.match ? 'match' : 'no-match';

      item.innerHTML = `
        <div class="history-swatch" style="background: ${color.hex};"></div>
        <div class="history-info">
          <div class="history-hex">${color.hex}</div>
          <div class="history-match ${matchClass}">${matchText}</div>
        </div>
      `;

      listContainer.appendChild(item);
    });
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
