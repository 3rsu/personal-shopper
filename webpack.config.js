const path = require('path');

module.exports = {
  mode: 'production',
  entry: './src/background-remover-entry.js',
  output: {
    filename: 'background-removal-bundle.js',
    path: path.resolve(__dirname, 'dist'),
    publicPath: '', // Will be overridden by __webpack_public_path__ at runtime
    chunkFilename: '[id].background-removal-bundle.js',
  },
  experiments: {
    asyncWebAssembly: true,
  },
  performance: {
    hints: false,
    maxAssetSize: 512000,
    maxEntrypointSize: 512000,
  },
  optimization: {
    minimize: true,
  },
};
