/**
 * SERVICE WORKER (Background Script)
 *
 * Handles:
 * - Message passing between popup and content scripts
 * - Storage management (user preferences, wishlist)
 * - Cross-origin image fetching if needed
 * - Extension lifecycle events
 */

// Import color processor (note: in MV3, importScripts works differently)
// We'll handle color processing in content script for simplicity

// Storage cache to improve performance
let storageCache = {
  selectedSeason: null,
  filterEnabled: true,
  wishlist: [],
  colorHistory: []
};

/**
 * Initialize extension on install
 */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // First-time install: set defaults
    chrome.storage.sync.set({
      selectedSeason: null,  // User must choose
      filterEnabled: false  // Off until user selects a season
    });

    chrome.storage.local.set({
      wishlist: []
    });

    // Open welcome page
    chrome.tabs.create({
      url: chrome.runtime.getURL('popup/popup.html')
    });
  } else if (details.reason === 'update') {
    // Extension updated
    console.log('Season Color Checker updated to version', chrome.runtime.getManifest().version);
  }
});

/**
 * Load storage cache on startup
 */
chrome.storage.sync.get(['selectedSeason', 'filterEnabled'], (data) => {
  storageCache.selectedSeason = data.selectedSeason;
  storageCache.filterEnabled = data.filterEnabled !== false; // Default true
});

chrome.storage.local.get(['wishlist', 'colorHistory'], (data) => {
  storageCache.wishlist = data.wishlist || [];
  storageCache.colorHistory = data.colorHistory || [];
});

/**
 * Listen for storage changes and update cache
 */
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync') {
    if (changes.selectedSeason) {
      storageCache.selectedSeason = changes.selectedSeason.newValue;
    }
    if (changes.filterEnabled) {
      storageCache.filterEnabled = changes.filterEnabled.newValue;
    }
  } else if (areaName === 'local') {
    if (changes.wishlist) {
      storageCache.wishlist = changes.wishlist.newValue;
    }
    if (changes.colorHistory) {
      storageCache.colorHistory = changes.colorHistory.newValue;
    }
  }
});

/**
 * Message handler
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  // Get current settings
  if (request.action === 'getSettings') {
    sendResponse({
      selectedSeason: storageCache.selectedSeason,
      filterEnabled: storageCache.filterEnabled
    });
    return true;
  }

  // Update selected season
  if (request.action === 'setSeason') {
    chrome.storage.sync.set({ selectedSeason: request.season }, () => {
      storageCache.selectedSeason = request.season;

      // Notify all tabs to refresh filter
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, {
            action: 'seasonChanged',
            season: request.season
          }).catch(() => {
            // Ignore errors for tabs without content script
          });
        });
      });

      sendResponse({ success: true });
    });
    return true;
  }

  // Toggle filter on/off
  if (request.action === 'toggleFilter') {
    // If enabled parameter is provided, use it; otherwise toggle
    const newState = request.enabled !== undefined ? request.enabled : !storageCache.filterEnabled;
    chrome.storage.sync.set({ filterEnabled: newState }, () => {
      storageCache.filterEnabled = newState;

      // Notify current tab
      if (sender.tab) {
        chrome.tabs.sendMessage(sender.tab.id, {
          action: 'filterToggled',
          enabled: newState
        }).catch(() => {});
      }

      sendResponse({ success: true, enabled: newState });
    });
    return true;
  }

  // Add item to wishlist
  if (request.action === 'addToWishlist') {
    const item = {
      id: Date.now(),
      imageUrl: request.imageUrl,
      pageUrl: request.pageUrl,
      dominantColors: request.dominantColors,
      matchScore: request.matchScore,
      season: storageCache.selectedSeason,
      dateAdded: new Date().toISOString()
    };

    storageCache.wishlist.unshift(item); // Add to beginning

    chrome.storage.local.set({ wishlist: storageCache.wishlist }, () => {
      sendResponse({ success: true, item });
    });
    return true;
  }

  // Get wishlist
  if (request.action === 'getWishlist') {
    sendResponse({ wishlist: storageCache.wishlist });
    return true;
  }

  // Remove from wishlist
  if (request.action === 'removeFromWishlist') {
    storageCache.wishlist = storageCache.wishlist.filter(item => item.id !== request.itemId);

    chrome.storage.local.set({ wishlist: storageCache.wishlist }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  // Clear entire wishlist
  if (request.action === 'clearWishlist') {
    storageCache.wishlist = [];

    chrome.storage.local.set({ wishlist: [] }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  // Fetch cross-origin image (if needed)
  if (request.action === 'fetchImage') {
    fetch(request.url)
      .then(response => response.blob())
      .then(blob => {
        const reader = new FileReader();
        reader.onload = () => {
          sendResponse({ success: true, dataUrl: reader.result });
        };
        reader.onerror = () => {
          sendResponse({ success: false, error: 'Failed to read image' });
        };
        reader.readAsDataURL(blob);
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep channel open for async response
  }

  // Note: Eyedropper activation now handled directly by content script
  // (eyedropper.js is loaded as content script and receives messages via chrome.tabs.sendMessage)

  // Save picked color to history
  if (request.action === 'savePickedColor') {
    const color = request.color;

    // Add to beginning of history
    storageCache.colorHistory.unshift(color);

    // Keep only last 50 colors
    if (storageCache.colorHistory.length > 50) {
      storageCache.colorHistory = storageCache.colorHistory.slice(0, 50);
    }

    chrome.storage.local.set({ colorHistory: storageCache.colorHistory }, () => {
      // Notify popup to update display
      chrome.runtime.sendMessage({
        type: 'colorHistoryUpdated'
      }).catch(() => {
        // Popup might be closed, ignore error
      });

      sendResponse({ success: true });
    });

    return true;
  }

  // Get color history
  if (request.action === 'getColorHistory') {
    sendResponse({ history: storageCache.colorHistory });
    return true;
  }

  // Clear color history
  if (request.action === 'clearColorHistory') {
    storageCache.colorHistory = [];

    chrome.storage.local.set({ colorHistory: [] }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  return false;
});

/**
 * Handle extension icon click (optional - popup already opens automatically)
 */
chrome.action.onClicked.addListener((tab) => {
  // This won't fire if popup is set, but included for completeness
  console.log('Extension icon clicked on tab:', tab.id);
});

console.log('Season Color Checker service worker initialized');
