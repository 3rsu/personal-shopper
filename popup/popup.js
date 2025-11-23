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
    filterEnabled: true,
    minPrice: null,
    maxPrice: null,
    priceFilterEnabled: false
  };

  let wishlist = [];

  /**
   * Initialize popup
   */
  async function initialize() {
    // Load current settings
    await loadSettings();

    // Load wishlist
    await loadWishlist();

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

    // Price filter - Quick range buttons
    document.querySelectorAll('.price-range-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const minPrice = btn.dataset.min === 'null' ? null : parseFloat(btn.dataset.min);
        const maxPrice = btn.dataset.max === 'null' ? null : parseFloat(btn.dataset.max);

        // Update active state
        document.querySelectorAll('.price-range-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Update input fields
        document.getElementById('min-price').value = minPrice !== null ? minPrice : '';
        document.getElementById('max-price').value = maxPrice !== null ? maxPrice : '';

        // Apply filter
        applyPriceFilter(minPrice, maxPrice);
      });
    });

    // Price filter - Apply button
    const applyPriceBtn = document.getElementById('apply-price-filter');
    if (applyPriceBtn) {
      applyPriceBtn.addEventListener('click', () => {
        const minPrice = document.getElementById('min-price').value;
        const maxPrice = document.getElementById('max-price').value;

        const min = minPrice ? parseFloat(minPrice) : null;
        const max = maxPrice ? parseFloat(maxPrice) : null;

        // Deselect quick range buttons
        document.querySelectorAll('.price-range-btn').forEach(b => b.classList.remove('active'));

        applyPriceFilter(min, max);
      });
    }

    // Price filter - Clear button
    const clearPriceBtn = document.getElementById('clear-price-filter');
    if (clearPriceBtn) {
      clearPriceBtn.addEventListener('click', () => {
        document.getElementById('min-price').value = '';
        document.getElementById('max-price').value = '';

        // Activate "Any Price" button
        document.querySelectorAll('.price-range-btn').forEach(btn => {
          if (btn.dataset.min === 'null' && btn.dataset.max === 'null') {
            btn.classList.add('active');
          } else {
            btn.classList.remove('active');
          }
        });

        applyPriceFilter(null, null);
      });
    }

    // Price input listeners - apply on Enter
    ['min-price', 'max-price'].forEach(id => {
      const input = document.getElementById(id);
      if (input) {
        input.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            applyPriceBtn.click();
          }
        });
      }
    });
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

    // Update price filter UI
    const minPriceInput = document.getElementById('min-price');
    const maxPriceInput = document.getElementById('max-price');
    const clearPriceBtn = document.getElementById('clear-price-filter');

    if (minPriceInput) {
      minPriceInput.value = currentSettings.minPrice !== null ? currentSettings.minPrice : '';
    }
    if (maxPriceInput) {
      maxPriceInput.value = currentSettings.maxPrice !== null ? currentSettings.maxPrice : '';
    }

    // Show/hide clear button
    if (clearPriceBtn) {
      if (currentSettings.priceFilterEnabled) {
        clearPriceBtn.style.display = 'block';
      } else {
        clearPriceBtn.style.display = 'none';
      }
    }

    // Update quick range button states
    updatePriceRangeButtons();

    // Update wishlist display
    renderWishlist();

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
   * Update price range button active states
   */
  function updatePriceRangeButtons() {
    const { minPrice, maxPrice, priceFilterEnabled } = currentSettings;

    document.querySelectorAll('.price-range-btn').forEach(btn => {
      const btnMin = btn.dataset.min === 'null' ? null : parseFloat(btn.dataset.min);
      const btnMax = btn.dataset.max === 'null' ? null : parseFloat(btn.dataset.max);

      // Check if this button matches current settings
      if (btnMin === minPrice && btnMax === maxPrice) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  /**
   * Apply price filter
   */
  function applyPriceFilter(minPrice, maxPrice) {
    const enabled = minPrice !== null || maxPrice !== null;

    chrome.runtime.sendMessage({
      action: 'setPriceFilter',
      minPrice: minPrice,
      maxPrice: maxPrice,
      enabled: enabled
    }, (response) => {
      if (response && response.success) {
        currentSettings.minPrice = minPrice;
        currentSettings.maxPrice = maxPrice;
        currentSettings.priceFilterEnabled = enabled;
        updateUI();
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

      wishlistContainer.innerHTML = wishlist.map(item => {
        const priceDisplay = item.price !== null && item.price !== undefined
          ? `<div class="wishlist-item-price">${item.currency || '$'}${item.price.toFixed(2)}</div>`
          : '';

        return `
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
              ${priceDisplay}
              <a href="${item.pageUrl}" class="wishlist-item-link" target="_blank" title="View product">
                View Product →
              </a>
            </div>
          </div>
        `;
      }).join('');

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

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

})();
