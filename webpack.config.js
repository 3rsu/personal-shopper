const path = require('path');

module.exports = {
  mode: 'production',
  entry: './src/background-remover-entry.js',
  output: {
    filename: 'background-removal-bundle.js',
    path: path.resolve(__dirname, 'dist'),
  },
  experiments: {
    asyncWebAssembly: true,
  },
  performance: {
    hints: false,
    maxAssetSize: 512000,
    maxEntrypointSize: 512000,
  },
};
