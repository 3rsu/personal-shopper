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

    // Favorite button (heart icon) - controls extension activation
    const favoriteBtn = document.getElementById('favorite-btn');
    if (favoriteBtn) {
      favoriteBtn.addEventListener('click', toggleFavorite);
    }

    // Show overlay toggle
    const showOverlayToggle = document.getElementById('show-overlay-toggle');
    if (showOverlayToggle) {
      showOverlayToggle.addEventListener('change', (e) => {
        toggleOverlay(e.target.checked);
      });
    }

    // Show swatches toggle (debug mode)
    const showSwatchesToggle = document.getElementById('show-swatches-toggle');
    if (showSwatchesToggle) {
      showSwatchesToggle.addEventListener('change', (e) => {
        toggleSwatches(e.target.checked);
      });
    }

    // Favorites list management
    const toggleFavoritesListBtn = document.getElementById('toggle-favorites-list');
    if (toggleFavoritesListBtn) {
      toggleFavoritesListBtn.addEventListener('click', toggleFavoritesList);
    }

    const showAllFavoritesBtn = document.getElementById('show-all-favorites');
    if (showAllFavoritesBtn) {
      showAllFavoritesBtn.addEventListener('click', showAllFavorites);
    }

    const addCurrentSiteBtn = document.getElementById('add-current-site');
    if (addCurrentSiteBtn) {
      addCurrentSiteBtn.addEventListener('click', addCurrentSite);
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

    // Update domain info and favorite button
    updateDomainInfo();

    // Update favorites count (even if list is collapsed)
    const favoritesCount = document.getElementById('favorites-count');
    if (favoritesCount) {
      const count = currentSettings.favoriteSites?.length || 0;
      favoritesCount.textContent = `(${count})`;
    }

    // Update show overlay toggle
    const showOverlayToggle = document.getElementById('show-overlay-toggle');
    if (showOverlayToggle) {
      showOverlayToggle.checked = currentSettings.showOverlay !== false;
    }

    // Update show swatches toggle
    const showSwatchesToggle = document.getElementById('show-swatches-toggle');
    if (showSwatchesToggle) {
      showSwatchesToggle.checked = currentSettings.showSwatches || false;
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

        // Update UI after season selection
        updateUI();

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
   * Get current tab domain
   */
  async function getCurrentDomain() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url) return null;
      const url = new URL(tab.url);
      return url.hostname.replace(/^www\./, '');
    } catch (error) {
      console.error('Failed to get current domain:', error);
      return null;
    }
  }

  /**
   * Update domain info display and favorite button state
   */
  async function updateDomainInfo() {
    const domain = await getCurrentDomain();
    const statusEl = document.getElementById('domain-status');
    const favoriteBtn = document.getElementById('favorite-btn');
    const heartIcon = favoriteBtn?.querySelector('.heart-icon');

    if (!domain || !statusEl) return;

    // Check if domain is in favorites
    const isFavorite = currentSettings.favoriteSites?.includes(domain);

    // Update status display
    if (isFavorite) {
      statusEl.textContent = `Active on ${domain}`;
      statusEl.className = 'domain-status active';
    } else {
      statusEl.textContent = `Click ♡ to activate on ${domain}`;
      statusEl.className = 'domain-status inactive';
    }

    // Update heart icon
    if (heartIcon) {
      heartIcon.textContent = isFavorite ? '❤️' : '♡';
    }

    // Update button class and tooltip
    if (favoriteBtn) {
      if (isFavorite) {
        favoriteBtn.classList.add('favorited');
        favoriteBtn.title = 'Deactivate extension on this site';
      } else {
        favoriteBtn.classList.remove('favorited');
        favoriteBtn.title = 'Activate extension on this site';
      }
    }
  }

  /**
   * Toggle current domain in favorites
   */
  async function toggleFavorite() {
    const domain = await getCurrentDomain();
    if (!domain) return;

    const favoriteSites = currentSettings.favoriteSites || [];
    const isFavorite = favoriteSites.includes(domain);

    let newFavorites;
    if (isFavorite) {
      // Remove from favorites
      newFavorites = favoriteSites.filter(site => site !== domain);
    } else {
      // Add to favorites
      newFavorites = [...favoriteSites, domain];
    }

    // Update storage - wait for it to complete before reloading
    await chrome.storage.sync.set({ favoriteSites: newFavorites });
    currentSettings.favoriteSites = newFavorites;

    // Update UI
    updateDomainInfo();

    // Reload current tab to apply changes
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.reload(tab.id);
    }
  }


  /**
   * Toggle overlay visibility
   */
  function toggleOverlay(enabled) {
    // Update storage - content script will show/hide overlay
    chrome.storage.sync.set({ showOverlay: enabled });
    currentSettings.showOverlay = enabled;
  }

  /**
   * Toggle swatches display (debug mode)
   */
  function toggleSwatches(enabled) {
    // Update storage - content script will toggle body class
    chrome.storage.sync.set({ showSwatches: enabled });
    currentSettings.showSwatches = enabled;
  }

  /**
   * Toggle favorites list visibility
   */
  let favoritesListExpanded = false;
  let showingAllFavorites = false;

  function toggleFavoritesList() {
    const container = document.getElementById('favorites-list-container');
    const expandIcon = document.querySelector('.expand-icon');

    favoritesListExpanded = !favoritesListExpanded;

    if (favoritesListExpanded) {
      container.style.display = 'block';
      if (expandIcon) expandIcon.classList.add('expanded');
      renderFavoritesList();
    } else {
      container.style.display = 'none';
      if (expandIcon) expandIcon.classList.remove('expanded');
      showingAllFavorites = false;
    }
  }

  /**
   * Render favorites list
   */
  async function renderFavoritesList() {
    const listContainer = document.getElementById('favorites-list');
    const showAllBtn = document.getElementById('show-all-favorites');
    const addCurrentBtn = document.getElementById('add-current-site');
    const addSiteDomain = document.getElementById('add-site-domain');
    const favoritesCount = document.getElementById('favorites-count');

    if (!listContainer) return;

    const favoriteSites = currentSettings.favoriteSites || [];
    const currentDomain = await getCurrentDomain();

    // Update count
    if (favoritesCount) {
      favoritesCount.textContent = `(${favoriteSites.length})`;
    }

    // Show "Add current site" button if current domain is not in favorites
    const isCurrentInFavorites = currentDomain && favoriteSites.includes(currentDomain);
    if (addCurrentBtn && addSiteDomain && currentDomain) {
      if (!isCurrentInFavorites) {
        addCurrentBtn.style.display = 'block';
        addSiteDomain.textContent = currentDomain;
      } else {
        addCurrentBtn.style.display = 'none';
      }
    }

    // Determine how many to show
    const INITIAL_SHOW = 5;
    const sitesToShow = showingAllFavorites ? favoriteSites : favoriteSites.slice(0, INITIAL_SHOW);
    const remaining = favoriteSites.length - INITIAL_SHOW;

    // Render list
    listContainer.innerHTML = '';
    sitesToShow.forEach(site => {
      const item = document.createElement('div');
      item.className = 'favorite-site-item';
      if (site === currentDomain) {
        item.classList.add('current-site');
      }

      item.innerHTML = `
        <span class="favorite-site-name">${site}</span>
        <button class="remove-favorite-btn" data-domain="${site}" title="Remove ${site}">×</button>
      `;

      // Add remove button event listener
      const removeBtn = item.querySelector('.remove-favorite-btn');
      removeBtn.addEventListener('click', () => removeFavoriteSite(site));

      listContainer.appendChild(item);
    });

    // Show/hide "Show all" button
    if (showAllBtn) {
      const remainingCount = document.getElementById('remaining-count');
      if (remaining > 0 && !showingAllFavorites) {
        showAllBtn.style.display = 'block';
        if (remainingCount) remainingCount.textContent = remaining;
      } else {
        showAllBtn.style.display = 'none';
      }
    }
  }

  /**
   * Show all favorites (expand list)
   */
  function showAllFavorites() {
    showingAllFavorites = true;
    renderFavoritesList();
  }

  /**
   * Remove a site from favorites
   */
  async function removeFavoriteSite(domain) {
    const favoriteSites = currentSettings.favoriteSites || [];
    const newFavorites = favoriteSites.filter(site => site !== domain);

    // Update storage
    chrome.storage.sync.set({ favoriteSites: newFavorites });
    currentSettings.favoriteSites = newFavorites;

    // Re-render list
    renderFavoritesList();

    // Update domain info in case we removed current site
    updateDomainInfo();

    // Reload tab if we removed the current site
    const currentDomain = await getCurrentDomain();
    if (domain === currentDomain) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        chrome.tabs.reload(tab.id);
      }
    }
  }

  /**
   * Add current site to favorites
   */
  async function addCurrentSite() {
    const domain = await getCurrentDomain();
    if (!domain) return;

    const favoriteSites = currentSettings.favoriteSites || [];
    if (favoriteSites.includes(domain)) return; // Already in favorites

    const newFavorites = [...favoriteSites, domain];

    // Update storage
    chrome.storage.sync.set({ favoriteSites: newFavorites });
    currentSettings.favoriteSites = newFavorites;

    // Re-render list
    renderFavoritesList();

    // Update domain info
    updateDomainInfo();

    // Reload current tab to activate extension
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.reload(tab.id);
    }
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

  // Listen for storage changes to keep UI in sync
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync') {
      if (changes.favoriteSites) {
        currentSettings.favoriteSites = changes.favoriteSites.newValue;
        updateDomainInfo();

        // Update favorites count
        const favoritesCount = document.getElementById('favorites-count');
        if (favoritesCount) {
          const count = changes.favoriteSites.newValue?.length || 0;
          favoritesCount.textContent = `(${count})`;
        }

        // Re-render favorites list if it's expanded
        if (favoritesListExpanded) {
          renderFavoritesList();
        }
      }

      if (changes.showOverlay) {
        currentSettings.showOverlay = changes.showOverlay.newValue;
        const showOverlayToggle = document.getElementById('show-overlay-toggle');
        if (showOverlayToggle) {
          showOverlayToggle.checked = changes.showOverlay.newValue;
        }
      }
    }
  });

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

})();
