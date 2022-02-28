const path = require('path');
const nodeExternals = require('webpack-node-externals');
const TersetPlugin = require('terser-webpack-plugin');

module.exports = {
  target: 'node',
  externals: [nodeExternals()],
  entry: './src/server.ts',
  mode: process.env.NODE_ENV || 'development',
  plugins: [
    new TersetPlugin({
      terserOptions: {
        mangle: false
      }
    })
  ],
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    modules: [
      path.resolve(__dirname, 'src'),
      path.resolve(__dirname, 'node_modules'),
    ],
    extensions: ['.ts', '.js'],
  },
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, 'dist'),
    libraryTarget: 'umd'
  },
}