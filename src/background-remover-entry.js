/**
 * Webpack entry point for @imgly/background-removal
 * Bundles the library for use in Chrome extension content script
 */

// CRITICAL: Set webpack public path BEFORE any imports
__webpack_public_path__ = chrome.runtime.getURL('dist/');

import { removeBackground, preload } from '@imgly/background-removal';

// Expose to global scope for use in BackgroundRemover class
window.imglyRemoveBackground = removeBackground;
window.imglyPreloadBackground = preload;

console.log('[BackgroundRemover] @imgly/background-removal loaded successfully');
