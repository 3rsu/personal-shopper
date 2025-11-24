/**
 * Set webpack public path for dynamic chunk loading
 * This must load BEFORE background-removal-bundle.js
 */
__webpack_public_path__ = chrome.runtime.getURL('dist/');
