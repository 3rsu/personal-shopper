/**
 * OVERLAY WIDGET
 *
 * Floating widget that shows filter statistics and controls.
 * Displays: "✓ 12 of 45 items match your Spring palette"
 */

(function() {
  'use strict';

  let overlayElement = null;
  let isMinimized = false;

  /**
   * Initialize the overlay widget
   */
  window.initializeOverlay = function(stats) {
    if (overlayElement) {
      overlayElement.remove();
    }

    overlayElement = createOverlay(stats);
    document.body.appendChild(overlayElement);

    // Make draggable
    makeDraggable(overlayElement);
  };

  /**
   * Create overlay HTML structure
   */
  function createOverlay(stats) {
    const overlay = document.createElement('div');
    overlay.id = 'season-color-overlay';
    overlay.className = 'season-overlay';

    overlay.innerHTML = `
      <div class="season-overlay-header">
        <span class="season-overlay-icon">🎨</span>
        <span class="season-overlay-title">Season Filter</span>
        <button class="season-overlay-minimize" title="Minimize">−</button>
        <button class="season-overlay-close" title="Close">×</button>
      </div>
      <div class="season-overlay-content">
        <div class="season-overlay-stats">
          <div class="stat-line">
            <span class="stat-icon">✓</span>
            <span class="stat-text">
              <strong class="match-count">0</strong> of
              <strong class="total-count">0</strong> items match
            </span>
          </div>
          <div class="season-name"></div>
        </div>
        <div class="season-overlay-actions">
          <button class="btn-toggle-filter">Turn Off</button>
          <button class="btn-open-popup">Settings</button>
        </div>
      </div>
    `;

    // Event listeners
    overlay.querySelector('.season-overlay-close').addEventListener('click', hideOverlay);
    overlay.querySelector('.season-overlay-minimize').addEventListener('click', toggleMinimize);
    overlay.querySelector('.btn-toggle-filter').addEventListener('click', toggleFilter);
    overlay.querySelector('.btn-open-popup').addEventListener('click', openPopup);

    return overlay;
  };

  /**
   * Update overlay with current stats
   */
  window.updateOverlay = function(stats, settings) {
    if (!overlayElement) return;

    const matchCount = overlayElement.querySelector('.match-count');
    const totalCount = overlayElement.querySelector('.total-count');
    const seasonName = overlayElement.querySelector('.season-name');

    if (matchCount) matchCount.textContent = stats.matchingImages || 0;
    if (totalCount) totalCount.textContent = stats.totalImages || 0;

    if (seasonName && settings.selectedSeason) {
      const palette = SEASONAL_PALETTES[settings.selectedSeason];
      seasonName.textContent = `${palette.name} Palette`;
    }

    // Update toggle button text
    const toggleBtn = overlayElement.querySelector('.btn-toggle-filter');
    if (toggleBtn) {
      toggleBtn.textContent = settings.filterEnabled ? 'Turn Off' : 'Turn On';
    }

    // Show overlay if hidden and filter is on
    if (settings.filterEnabled && overlayElement.style.display === 'none') {
      overlayElement.style.display = 'block';
    }
  };

  /**
   * Hide overlay
   */
  function hideOverlay() {
    if (overlayElement) {
      overlayElement.style.display = 'none';
    }
  }

  /**
   * Toggle minimize/maximize
   */
  function toggleMinimize() {
    isMinimized = !isMinimized;

    const content = overlayElement.querySelector('.season-overlay-content');
    const minimizeBtn = overlayElement.querySelector('.season-overlay-minimize');

    if (isMinimized) {
      content.style.display = 'none';
      minimizeBtn.textContent = '+';
      minimizeBtn.title = 'Maximize';
      overlayElement.classList.add('minimized');
    } else {
      content.style.display = 'block';
      minimizeBtn.textContent = '−';
      minimizeBtn.title = 'Minimize';
      overlayElement.classList.remove('minimized');
    }
  }

  /**
   * Toggle filter on/off
   */
  function toggleFilter() {
    chrome.runtime.sendMessage({ action: 'toggleFilter' }, (response) => {
      if (response) {
        const toggleBtn = overlayElement.querySelector('.btn-toggle-filter');
        toggleBtn.textContent = response.enabled ? 'Turn Off' : 'Turn On';
      }
    });
  }

  /**
   * Open extension popup
   */
  function openPopup() {
    chrome.runtime.sendMessage({ action: 'openPopup' });
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

})();
