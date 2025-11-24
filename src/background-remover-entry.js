/**
 * Webpack entry point for @imgly/background-removal
 * Bundles the library for use in Chrome extension content script
 */

import { removeBackground, preload } from '@imgly/background-removal';

// Expose to global scope for use in BackgroundRemover class
window.imglyRemoveBackground = removeBackground;
window.imglyPreloadBackground = preload;

console.log('[BackgroundRemover] @imgly/background-removal loaded successfully');
