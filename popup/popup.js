/**
 * POPUP CONTROLLER
 *
 * Manages the extension popup UI:
 * - Season selection
 * - Wishlist display and management
 * - Filter toggle
 */

(function() {
  'use strict';

  let currentSettings = {
    selectedSeason: null,
    filterEnabled: true
  };

  let wishlist = [];
  let colorHistory = [];

  /**
   * Initialize popup
   */
  async function initialize() {
    // Load current settings
    await loadSettings();

    // Load wishlist
    await loadWishlist();

    // Load color history
    await loadColorHistory();

    // Set up event listeners
    setupEventListeners();

    // Update UI
    updateUI();
  }

  /**
   * Load settings from storage
   */
  function loadSettings() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
        if (response) {
          currentSettings = response;
        }
        resolve();
      });
    });
  }

  /**
   * Load wishlist from storage
   */
  function loadWishlist() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'getWishlist' }, (response) => {
        if (response) {
          wishlist = response.wishlist || [];
        }
        resolve();
      });
    });
  }

  /**
   * Load color history from storage
   */
  function loadColorHistory() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'getColorHistory' }, (response) => {
        if (response) {
          colorHistory = response.history || [];
        }
        resolve();
      });
    });
  }

  /**
   * Set up event listeners
   */
  function setupEventListeners() {
    // Season card clicks
    document.querySelectorAll('.season-card').forEach(card => {
      card.addEventListener('click', () => {
        const season = card.dataset.season;
        selectSeason(season);
      });
    });

    // Change season button
    const changeSeasonBtn = document.getElementById('change-season');
    if (changeSeasonBtn) {
      changeSeasonBtn.addEventListener('click', showSeasonSelection);
    }

    // Filter toggle
    const filterToggle = document.getElementById('filter-toggle');
    if (filterToggle) {
      filterToggle.addEventListener('change', (e) => {
        toggleFilter(e.target.checked);
      });
    }

    // Clear wishlist
    const clearWishlistBtn = document.getElementById('clear-wishlist');
    if (clearWishlistBtn) {
      clearWishlistBtn.addEventListener('click', clearWishlist);
    }

    // Activate eyedropper
    const activatePickerBtn = document.getElementById('activate-picker');
    if (activatePickerBtn) {
      activatePickerBtn.addEventListener('click', activateEyedropper);
    }

    // Clear color history
    const clearHistoryBtn = document.getElementById('clear-history');
    if (clearHistoryBtn) {
      clearHistoryBtn.addEventListener('click', clearColorHistory);
    }
  }

  /**
   * Update UI based on current state
   */
  function updateUI() {
    // Update season selection display
    if (currentSettings.selectedSeason) {
      showCurrentSeason();
    } else {
      showSeasonSelection();
    }

    // Update filter toggle
    const filterToggle = document.getElementById('filter-toggle');
    if (filterToggle) {
      filterToggle.checked = currentSettings.filterEnabled;
    }

    // Update wishlist display
    renderWishlist();

    // Update color history display
    renderColorHistory();

    // Highlight selected season
    document.querySelectorAll('.season-card').forEach(card => {
      if (card.dataset.season === currentSettings.selectedSeason) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    });
  }

  /**
   * Select a season
   */
  function selectSeason(season) {
    chrome.runtime.sendMessage({
      action: 'setSeason',
      season: season
    }, (response) => {
      if (response && response.success) {
        currentSettings.selectedSeason = season;
        updateUI();
      }
    });
  }

  /**
   * Show season selection UI
   */
  function showSeasonSelection() {
    const seasonGrid = document.querySelector('.season-grid');
    const currentSeasonDiv = document.getElementById('current-season');

    if (seasonGrid) seasonGrid.style.display = 'grid';
    if (currentSeasonDiv) currentSeasonDiv.style.display = 'none';
  }

  /**
   * Show current season UI
   */
  function showCurrentSeason() {
    const seasonGrid = document.querySelector('.season-grid');
    const currentSeasonDiv = document.getElementById('current-season');
    const currentSeasonName = document.getElementById('current-season-name');

    if (seasonGrid) seasonGrid.style.display = 'none';
    if (currentSeasonDiv) currentSeasonDiv.style.display = 'flex';

    if (currentSeasonName && currentSettings.selectedSeason) {
      // Format season name properly (handle hyphenated names)
      const seasonName = currentSettings.selectedSeason
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      // Get emoji mapping for all 12 seasons
      const emojis = {
        'bright-spring': '🌺',
        'warm-spring': '🌸',
        'light-spring': '🌼',
        'soft-summer': '🌿',
        'cool-summer': '🌊',
        'light-summer': '☁️',
        'deep-autumn': '🍁',
        'warm-autumn': '🍂',
        'soft-autumn': '🌾',
        'bright-winter': '💎',
        'cool-winter': '❄️',
        'deep-winter': '🌑'
      };

      const emoji = emojis[currentSettings.selectedSeason] || '🎨';
      currentSeasonName.textContent = `${emoji} ${seasonName}`;
    }
  }

  /**
   * Toggle filter on/off
   */
  function toggleFilter(enabled) {
    chrome.runtime.sendMessage({
      action: 'toggleFilter'
    }, (response) => {
      if (response) {
        currentSettings.filterEnabled = response.enabled;
      }
    });
  }

  /**
   * Render wishlist items
   */
  function renderWishlist() {
    const emptyState = document.getElementById('wishlist-empty');
    const wishlistContainer = document.getElementById('wishlist-items');

    if (!wishlistContainer) return;

    if (wishlist.length === 0) {
      // Show empty state
      if (emptyState) emptyState.style.display = 'block';
      wishlistContainer.style.display = 'none';
      wishlistContainer.innerHTML = '';
    } else {
      // Show wishlist items
      if (emptyState) emptyState.style.display = 'none';
      wishlistContainer.style.display = 'grid';

      wishlistContainer.innerHTML = wishlist.map(item => `
        <div class="wishlist-item" data-id="${item.id}">
          <div class="wishlist-item-image">
            <img src="${item.imageUrl}" alt="Wishlist item" loading="lazy">
            <button class="wishlist-item-remove" data-id="${item.id}" title="Remove">
              ×
            </button>
          </div>
          <div class="wishlist-item-info">
            <div class="wishlist-item-colors">
              ${(item.dominantColors || []).slice(0, 3).map(color =>
                `<span class="color-dot" style="background: ${color}"></span>`
              ).join('')}
            </div>
            <div class="wishlist-item-score">
              ${item.matchScore}% match
            </div>
            <a href="${item.pageUrl}" class="wishlist-item-link" target="_blank" title="View product">
              View Product →
            </a>
          </div>
        </div>
      `).join('');

      // Add remove button listeners
      wishlistContainer.querySelectorAll('.wishlist-item-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const itemId = parseInt(btn.dataset.id);
          removeFromWishlist(itemId);
        });
      });
    }
  }

  /**
   * Remove item from wishlist
   */
  function removeFromWishlist(itemId) {
    chrome.runtime.sendMessage({
      action: 'removeFromWishlist',
      itemId: itemId
    }, (response) => {
      if (response && response.success) {
        wishlist = wishlist.filter(item => item.id !== itemId);
        renderWishlist();
      }
    });
  }

  /**
   * Clear entire wishlist
   */
  function clearWishlist() {
    if (!confirm('Clear all wishlist items?')) {
      return;
    }

    chrome.runtime.sendMessage({
      action: 'clearWishlist'
    }, (response) => {
      if (response && response.success) {
        wishlist = [];
        renderWishlist();
      }
    });
  }

  /**
   * Activate eyedropper tool
   */
  async function activateEyedropper() {
    // Check if season is selected
    if (!currentSettings.selectedSeason) {
      alert('Please select a season first!');
      return;
    }

    try {
      // Get active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab || !tab.id) {
        alert('No active tab found');
        return;
      }

      // Send message to activate eyedropper
      chrome.runtime.sendMessage({
        action: 'activateEyedropper',
        tabId: tab.id
      }, (response) => {
        if (response && response.success) {
          // Close popup to allow user to interact with page
          window.close();
        } else {
          alert('Failed to activate eyedropper: ' + (response?.error || 'Unknown error'));
        }
      });
    } catch (error) {
      console.error('Error activating eyedropper:', error);
      alert('Failed to activate eyedropper');
    }
  }

  /**
   * Render color history
   */
  function renderColorHistory() {
    const historyContainer = document.getElementById('color-history');
    const historySection = document.getElementById('color-history-container');

    if (!historyContainer || !historySection) return;

    if (colorHistory.length === 0) {
      historySection.style.display = 'none';
      return;
    }

    historySection.style.display = 'block';

    // Show last 5 colors
    const recentColors = colorHistory.slice(0, 5);

    historyContainer.innerHTML = recentColors.map(color => {
      const matchClass = color.match ? 'match' : 'no-match';
      const matchIcon = color.match ? '✓' : '✗';
      const matchText = color.match ? 'Matches' : 'No match';

      return `
        <div class="history-item ${matchClass}">
          <div class="history-color-info">
            <div class="history-swatch" style="background: ${color.hex};"></div>
            <div class="history-details">
              <div class="history-hex">${color.hex}</div>
              <div class="history-status ${matchClass}">
                <span>${matchIcon}</span>
                <span>${matchText}</span>
              </div>
            </div>
          </div>
          <div class="history-distance">ΔE ${color.distance}</div>
        </div>
      `;
    }).join('');
  }

  /**
   * Clear color history
   */
  function clearColorHistory() {
    if (!confirm('Clear color history?')) {
      return;
    }

    chrome.runtime.sendMessage({
      action: 'clearColorHistory'
    }, (response) => {
      if (response && response.success) {
        colorHistory = [];
        renderColorHistory();
      }
    });
  }

  /**
   * Listen for color history updates
   */
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'colorHistoryUpdated') {
      // Reload color history
      loadColorHistory().then(() => {
        renderColorHistory();
      });
    }
  });

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

})();
