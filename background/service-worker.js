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
  favoriteSites: [], // User's favorite shopping sites (auto-enable)
  showOverlay: true,
  showSwatches: false, // Hidden by default
  wishlist: [],
  colorHistory: [],
  domainStats: {},
  blockedDomains: [],

  // Trial & payment
  trialStartDate: null,
  isPaid: false,
  paidUntil: null,
  showedWelcome: false
};

/**
 * Initialize extension on install
 */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // First-time install: set defaults
    chrome.storage.sync.set({
      selectedSeason: null,  // User must choose
      filterEnabled: true,  // Master enable toggle

      // Pre-seed 20 popular shopping sites
      favoriteSites: [
        // Department stores
        'nordstrom.com', 'macys.com', 'bloomingdales.com',
        'saksfifthavenue.com', 'neimanmarcus.com',

        // Fast fashion
        'zara.com', 'hm.com', 'asos.com', 'gap.com', 'uniqlo.com',

        // Online retailers
        'shopbop.com', 'revolve.com', 'net-a-porter.com',
        'farfetch.com', 'ssense.com',

        // Affordable/popular
        'target.com', 'oldnavy.com', 'jcrew.com',
        'madewell.com', 'anthropologie.com'
      ],

      showOverlay: true,
      showSwatches: false, // Hidden by default (70% accuracy)

      // Trial & payment
      trialStartDate: new Date().toISOString(),
      isPaid: false,
      paidUntil: null,
      showedWelcome: false
    });

    chrome.storage.local.set({
      wishlist: [],
      domainStats: {},
      blockedDomains: [],
      colorHistory: []
    });

    // Open welcome page for onboarding
    chrome.tabs.create({ url: 'popup/welcome.html' });
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

chrome.storage.local.get(['wishlist', 'colorHistory', 'domainStats', 'blockedDomains'], (data) => {
  storageCache.wishlist = data.wishlist || [];
  storageCache.colorHistory = data.colorHistory || [];
  storageCache.domainStats = data.domainStats || {};
  storageCache.blockedDomains = data.blockedDomains || [];

  // Update badge on startup
  updateBadge();
});

/**
 * Fetch image as data URL with timeout
 * @param {string} url - Image URL to fetch
 * @param {number} timeout - Timeout in milliseconds (default: 3000)
 * @returns {Promise<string>} - Data URL of the image
 */
async function fetchImageAsDataUrl(url, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(Object.assign(new Error('Fetch timeout'), { type: 'timeout' }));
    }, timeout);

    fetch(url)
      .then(response => {
        if (!response.ok) {
          throw Object.assign(new Error(`HTTP ${response.status}: ${response.statusText}`), { type: 'http' });
        }
        return response.blob();
      })
      .then(blob => {
        const reader = new FileReader();
        reader.onload = () => {
          clearTimeout(timeoutId);
          resolve(reader.result);
        };
        reader.onerror = () => {
          clearTimeout(timeoutId);
          reject(Object.assign(new Error('Failed to read image blob'), { type: 'read' }));
        };
        reader.readAsDataURL(blob);
      })
      .catch(error => {
        clearTimeout(timeoutId);
        // Categorize network errors
        if (error.type) {
          reject(error);
        } else if (error.name === 'TypeError') {
          reject(Object.assign(new Error('Network error: ' + error.message), { type: 'network' }));
        } else {
          reject(Object.assign(new Error(error.message), { type: 'unknown' }));
        }
      });
  });
}

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
    if (changes.domainStats) {
      storageCache.domainStats = changes.domainStats.newValue;
    }
    if (changes.blockedDomains) {
      storageCache.blockedDomains = changes.blockedDomains.newValue;
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

  // toggleFilter handler removed - components now update storage directly
  // Storage listeners handle synchronization across all components

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
    fetchImageAsDataUrl(request.url, 3000)
      .then(dataUrl => {
        sendResponse({ success: true, dataUrl });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message, errorType: error.type || 'unknown' });
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

  // Track CORS event from content script
  if (request.action === 'trackCorsEvent') {
    const { domain, eventType, method } = request;
    trackDomainCorsEvent(domain, eventType, method);
    // No response needed - fire and forget
    return false;
  }

  // Get domain statistics
  if (request.action === 'getDomainStats') {
    sendResponse({
      domainStats: storageCache.domainStats,
      blockedDomains: storageCache.blockedDomains
    });
    return true;
  }

  // Unblock a domain
  if (request.action === 'unblockDomain') {
    const domain = request.domain;
    storageCache.blockedDomains = storageCache.blockedDomains.filter(d => d !== domain);

    // Reset domain statistics
    if (storageCache.domainStats[domain]) {
      delete storageCache.domainStats[domain];
    }

    chrome.storage.local.set({
      blockedDomains: storageCache.blockedDomains,
      domainStats: storageCache.domainStats
    }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  // Clear all blocked domains
  if (request.action === 'clearBlockedDomains') {
    storageCache.blockedDomains = [];
    storageCache.domainStats = {};

    chrome.storage.local.set({
      blockedDomains: [],
      domainStats: {}
    }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  // Manual block domain
  if (request.action === 'blockDomain') {
    const domain = request.domain;
    if (!storageCache.blockedDomains.includes(domain)) {
      storageCache.blockedDomains.push(domain);

      chrome.storage.local.set({
        blockedDomains: storageCache.blockedDomains
      }, () => {
        sendResponse({ success: true });
      });
    } else {
      sendResponse({ success: true });
    }
    return true;
  }

  // Get preferred method for a domain (for caching)
  if (request.action === 'getPreferredMethod') {
    const domain = request.domain;
    const stats = storageCache.domainStats[domain];
    const preferredMethod = stats?.preferredMethod || null;
    sendResponse({ preferredMethod });
    return true;
  }

  return false;
});

/**
 * Track CORS events for domain statistics
 * @param {string} domain - Domain name
 * @param {string} eventType - 'success' or 'failure'
 * @param {string} method - 'direct', 'crossorigin', 'fetch', or 'all-failed'
 */
function trackDomainCorsEvent(domain, eventType, method = 'direct') {
  if (!domain) return;

  // Initialize domain stats if not exists
  if (!storageCache.domainStats[domain]) {
    storageCache.domainStats[domain] = {
      totalAttempts: 0,
      directSuccess: 0,
      crossoriginSuccess: 0,
      fetchSuccess: 0,
      totalFailures: 0,
      lastCheck: Date.now(),
      preferredMethod: null  // Cache which method works best
    };
  }

  const stats = storageCache.domainStats[domain];
  stats.lastCheck = Date.now();
  stats.totalAttempts++;

  // Update counters based on event type and method
  if (eventType === 'success') {
    if (method === 'direct') {
      stats.directSuccess++;
      stats.preferredMethod = 'direct';
    } else if (method === 'crossorigin') {
      stats.crossoriginSuccess++;
      if (!stats.preferredMethod || stats.preferredMethod === 'direct') {
        stats.preferredMethod = 'crossorigin';
      }
    } else if (method === 'fetch') {
      stats.fetchSuccess++;
      if (!stats.preferredMethod) {
        stats.preferredMethod = 'fetch';
      }
    }
  } else if (eventType === 'failure') {
    stats.totalFailures++;
  }

  // Calculate success rate
  const successCount = stats.directSuccess + stats.crossoriginSuccess + stats.fetchSuccess;
  const successRate = stats.totalAttempts > 0 ? (successCount / stats.totalAttempts) : 0;

  // Auto-block domain if poor success rate
  // Threshold: < 20% success rate after at least 20 attempts
  const MIN_ATTEMPTS = 20;
  const MIN_SUCCESS_RATE = 0.20;

  if (stats.totalAttempts >= MIN_ATTEMPTS && successRate < MIN_SUCCESS_RATE) {
    if (!storageCache.blockedDomains.includes(domain)) {
      storageCache.blockedDomains.push(domain);
      console.log(
        `[Season Color Checker] Auto-blocked domain: ${domain} ` +
        `(${Math.round(successRate * 100)}% success rate after ${stats.totalAttempts} attempts)`
      );

      // Update badge to show blocked domains count
      updateBadge();
    }
  }

  // Save to storage (debounce this to avoid too many writes)
  if (!trackDomainCorsEvent.saveTimeout) {
    trackDomainCorsEvent.saveTimeout = setTimeout(() => {
      chrome.storage.local.set({
        domainStats: storageCache.domainStats,
        blockedDomains: storageCache.blockedDomains
      });
      trackDomainCorsEvent.saveTimeout = null;
    }, 1000); // Save at most once per second
  }
}

/**
 * Update extension badge to show blocked domains count
 */
function updateBadge() {
  const count = storageCache.blockedDomains.length;

  if (count > 0) {
    chrome.action.setBadgeText({ text: count.toString() });
    chrome.action.setBadgeBackgroundColor({ color: '#FF6B6B' });
    chrome.action.setTitle({
      title: `Season Color Checker - ${count} domain${count > 1 ? 's' : ''} blocked`
    });
  } else {
    chrome.action.setBadgeText({ text: '' });
    chrome.action.setTitle({ title: 'Season Color Checker' });
  }
}

/**
 * Handle extension icon click (optional - popup already opens automatically)
 */
chrome.action.onClicked.addListener((tab) => {
  // This won't fire if popup is set, but included for completeness
  console.log('Extension icon clicked on tab:', tab.id);
});

console.log('Season Color Checker service worker initialized');
