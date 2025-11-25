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
  let showAllHistory = false;
  let domainStats = {};
  let blockedDomains = [];

  /**
   * Generate season cards from SEASONAL_PALETTES data
   */
  function generateSeasonCards() {
    const seasonGrid = document.getElementById('season-grid');
    if (!seasonGrid || !window.SEASONAL_PALETTES) return;

    const seasonsOrder = [
      'bright-spring', 'warm-spring', 'light-spring',
      'soft-summer', 'cool-summer', 'light-summer',
      'deep-autumn', 'warm-autumn', 'soft-autumn',
      'bright-winter', 'cool-winter', 'deep-winter'
    ];

    seasonGrid.innerHTML = seasonsOrder.map(seasonKey => {
      const season = window.SEASONAL_PALETTES[seasonKey];
      if (!season) return '';

      const first5Colors = season.colors.slice(0, 5);

      return `
        <button class="season-card" data-season="${seasonKey}" tabindex="0" aria-label="${season.name}: ${season.description}">
          <div class="season-card-header">
            <span class="season-emoji" aria-hidden="true">${season.emoji}</span>
            <h3>${season.name}</h3>
          </div>
          <p class="season-desc">${season.description}</p>
          <div class="season-colors" aria-hidden="true">
            ${first5Colors.map(color =>
              `<span class="color-dot" style="background: ${color}"></span>`
            ).join('')}
          </div>
        </button>
      `;
    }).join('');
  }

  /**
   * Initialize popup
   */
  async function initialize() {
    // Generate season cards from data
    generateSeasonCards();

    // Load current settings
    await loadSettings();

    // Load wishlist
    await loadWishlist();

    // Load color history
    await loadColorHistory();

    // Load domain statistics
    await loadDomainStats();

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
   * Load domain statistics from storage
   */
  function loadDomainStats() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'getDomainStats' }, (response) => {
        if (response) {
          domainStats = response.domainStats || {};
          blockedDomains = response.blockedDomains || [];
        }
        resolve();
      });
    });
  }

  /**
   * Set up event listeners
   */
  function setupEventListeners() {
    // Season card clicks and keyboard navigation
    document.querySelectorAll('.season-card').forEach(card => {
      card.addEventListener('click', () => {
        const season = card.dataset.season;
        selectSeason(season);
      });

      // Keyboard support
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const season = card.dataset.season;
          selectSeason(season);
        }
      });
    });

    // Change season button (toggle collapse/expand)
    const changeSeasonBtn = document.getElementById('change-season');
    if (changeSeasonBtn) {
      changeSeasonBtn.addEventListener('click', toggleSeasonSelection);
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

    // Show all history toggle
    const showAllHistoryBtn = document.getElementById('show-all-history');
    if (showAllHistoryBtn) {
      showAllHistoryBtn.addEventListener('click', toggleShowAllHistory);
    }

    // Clear blocked domains
    const clearBlockedDomainsBtn = document.getElementById('clear-blocked-domains');
    if (clearBlockedDomainsBtn) {
      clearBlockedDomainsBtn.addEventListener('click', clearBlockedDomains);
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

      // Auto-disable filter when no season is selected
      if (currentSettings.filterEnabled) {
        chrome.runtime.sendMessage({
          action: 'toggleFilter',
          enabled: false
        }, (response) => {
          if (response) {
            currentSettings.filterEnabled = false;
          }
        });
      }
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

    // Update blocked domains display
    renderBlockedDomains();

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

        // Automatically enable filter when a season is selected
        chrome.runtime.sendMessage({
          action: 'toggleFilter',
          enabled: true
        }, (filterResponse) => {
          if (filterResponse) {
            currentSettings.filterEnabled = true;
            // Update the filter toggle checkbox
            const filterToggle = document.getElementById('filter-toggle');
            if (filterToggle) {
              filterToggle.checked = true;
            }
          }
          updateUI();
        });

        // Automatically collapse the grid after selection
        const seasonGrid = document.querySelector('.season-grid');
        if (seasonGrid) {
          seasonGrid.classList.add('collapsed');
        }
      }
    });
  }

  /**
   * Toggle season selection UI (expand/collapse)
   */
  function toggleSeasonSelection() {
    const seasonGrid = document.querySelector('.season-grid');
    const expandIcon = document.querySelector('.expand-icon');

    if (!seasonGrid) return;

    const isCollapsed = seasonGrid.classList.contains('collapsed');

    if (isCollapsed) {
      // Expand
      seasonGrid.classList.remove('collapsed');
      seasonGrid.style.display = 'grid';
      if (expandIcon) expandIcon.classList.remove('expanded');
    } else {
      // Collapse
      seasonGrid.classList.add('collapsed');
      seasonGrid.style.display = 'none';
      if (expandIcon) expandIcon.classList.add('expanded');
    }
  }

  /**
   * Show season selection UI
   */
  function showSeasonSelection() {
    const seasonGrid = document.querySelector('.season-grid');
    const currentSeasonDiv = document.getElementById('current-season');
    const expandIcon = document.querySelector('.expand-icon');

    if (seasonGrid) {
      seasonGrid.classList.remove('collapsed');
      seasonGrid.style.display = 'grid';
    }
    if (currentSeasonDiv) currentSeasonDiv.style.display = 'none';
    if (expandIcon) expandIcon.classList.remove('expanded');
  }

  /**
   * Show current season UI
   */
  function showCurrentSeason() {
    const seasonGrid = document.querySelector('.season-grid');
    const currentSeasonDiv = document.getElementById('current-season');
    const currentSeasonName = document.getElementById('current-season-name');
    const expandIcon = document.querySelector('.expand-icon');

    if (seasonGrid) {
      seasonGrid.classList.add('collapsed');
      seasonGrid.style.display = 'none';
    }
    if (currentSeasonDiv) currentSeasonDiv.style.display = 'flex';
    if (expandIcon) expandIcon.classList.add('expanded');

    if (currentSeasonName && currentSettings.selectedSeason && window.SEASONAL_PALETTES) {
      const season = window.SEASONAL_PALETTES[currentSettings.selectedSeason];
      if (season) {
        currentSeasonName.textContent = `${season.emoji} ${season.name}`;
      }
    }
  }

  /**
   * Toggle filter on/off
   */
  function toggleFilter(enabled) {
    chrome.runtime.sendMessage({
      action: 'toggleFilter',
      enabled: enabled
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
        <div class="wishlist-item" data-id="${item.id}" role="listitem">
          <div class="wishlist-item-image">
            <img src="${item.imageUrl}" alt="Wishlist item ${item.matchScore}% match" loading="lazy">
            <button class="wishlist-item-remove" data-id="${item.id}" title="Remove" aria-label="Remove from wishlist">
              ×
            </button>
          </div>
          <div class="wishlist-item-info">
            <div class="wishlist-item-colors" aria-hidden="true">
              ${(item.dominantColors || []).slice(0, 3).map(color =>
                `<span class="color-dot" style="background: ${color}"></span>`
              ).join('')}
            </div>
            <div class="wishlist-item-score">
              ${item.matchScore}% match
            </div>
            <a href="${item.pageUrl}" class="wishlist-item-link" target="_blank" rel="noopener noreferrer" aria-label="View product on store website">
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
   * Clear all blocked domains
   */
  function clearBlockedDomains() {
    if (!confirm('Unblock all domains? This will allow the extension to try analyzing images from these domains again.')) {
      return;
    }

    chrome.runtime.sendMessage({
      action: 'clearBlockedDomains'
    }, (response) => {
      if (response && response.success) {
        blockedDomains = [];
        domainStats = {};
        renderBlockedDomains();
      }
    });
  }

  /**
   * Unblock a single domain
   */
  function unblockDomain(domain) {
    chrome.runtime.sendMessage({
      action: 'unblockDomain',
      domain: domain
    }, async (response) => {
      if (response && response.success) {
        // Reload domain stats
        await loadDomainStats();
        renderBlockedDomains();
      }
    });
  }

  /**
   * Render blocked domains list
   */
  function renderBlockedDomains() {
    const section = document.getElementById('blocked-domains-section');
    const list = document.getElementById('blocked-domains-list');

    if (!list || !section) return;

    // Show/hide section based on whether there are blocked domains
    if (blockedDomains.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';

    // Render each blocked domain with statistics
    list.innerHTML = blockedDomains.map(domain => {
      const stats = domainStats[domain] || { corsBlocked: 0 };
      const corsBlocked = stats.corsBlocked || 0;

      return `
        <div class="blocked-domain-item" role="listitem">
          <div class="blocked-domain-info">
            <div class="blocked-domain-name">${domain}</div>
            <div class="blocked-domain-stats">
              ${corsBlocked} CORS-blocked images detected
            </div>
          </div>
          <button
            class="btn btn-text btn-sm unblock-domain-btn"
            data-domain="${domain}"
            aria-label="Unblock ${domain}"
          >
            Unblock
          </button>
        </div>
      `;
    }).join('');

    // Add event listeners to unblock buttons
    list.querySelectorAll('.unblock-domain-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const domain = btn.dataset.domain;
        unblockDomain(domain);
      });
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

      // Send message directly to content script
      chrome.tabs.sendMessage(tab.id, {
        action: 'activateEyedropper',
        season: currentSettings.selectedSeason
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Failed to send message:', chrome.runtime.lastError);
          alert('Failed to activate eyedropper. Please refresh the page and try again.');
          return;
        }

        if (response && response.success) {
          // Close popup to allow user to interact with page
          window.close();
        } else {
          alert('Failed to activate eyedropper');
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
    const showAllBtn = document.getElementById('show-all-history');

    if (!historyContainer || !historySection) return;

    if (colorHistory.length === 0) {
      historySection.style.display = 'none';
      return;
    }

    historySection.style.display = 'block';

    // Show 3 colors by default, or all if toggled
    const displayLimit = showAllHistory ? colorHistory.length : 3;
    const recentColors = colorHistory.slice(0, displayLimit);

    historyContainer.innerHTML = recentColors.map(color => {
      const matchClass = color.match ? 'match' : 'no-match';
      const matchIcon = color.match ? '✓' : '✗';
      const matchText = color.match ? 'Matches' : 'No match';

      return `
        <div class="history-item ${matchClass}" role="listitem">
          <div class="history-color-info">
            <div class="history-swatch" style="background: ${color.hex};" aria-hidden="true"></div>
            <div class="history-details">
              <div class="history-hex">${color.hex}</div>
              <div class="history-status ${matchClass}">
                <span aria-hidden="true">${matchIcon}</span>
                <span>${matchText}</span>
              </div>
            </div>
          </div>
          <div class="history-distance" aria-label="Color distance: ${color.distance}">ΔE ${color.distance}</div>
        </div>
      `;
    }).join('');

    // Show/hide "Show All" button
    if (showAllBtn) {
      if (colorHistory.length > 3) {
        showAllBtn.style.display = 'block';
        showAllBtn.textContent = showAllHistory ? 'Show Less' : 'Show All';
      } else {
        showAllBtn.style.display = 'none';
      }
    }
  }

  /**
   * Toggle show all history
   */
  function toggleShowAllHistory() {
    showAllHistory = !showAllHistory;
    renderColorHistory();
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
