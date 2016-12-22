let webpack = require('webpack')

let isProd = process.env.NODE_ENV === 'production'

module.exports = {
  isProd: isProd,
  auth: { user: 'user', password: 'pass' },
  port: 8080,
  wshost: 'ws://localhost:8080',
  wsdashboard: 'ws://localhost:8080/dashboard',
  trackDashboard: false,
  webpack: {
    entry: ['./dashboard.jsx', !isProd && 'webpack-hot-middleware/client'].filter(x=>x),
    output: { path: '/' },
    module: {
      loaders: [
        {
          test: /.jsx?$/,
          loader: 'babel',
          exclude: /node_modules/,
          query: { presets: ['es2015', 'react'] }
        },
        { test: /\.css$/, loader: 'style!css' },
        { test: /\.png$/, loader: "url" },
        { test: /\.(woff|woff2)(\?v=\d+\.\d+\.\d+)?$/, loader: 'file' },
        { test: /\.ttf(\?v=\d+\.\d+\.\d+)?$/, loader: 'file' },
        { test: /\.eot(\?v=\d+\.\d+\.\d+)?$/, loader: 'file' },
        { test: /\.svg(\?v=\d+\.\d+\.\d+)?$/, loader: 'file' }
      ]
    },
    plugins: [
      isProd ? new webpack.DefinePlugin({ 'process.env': { 'NODE_ENV': "'production'" } }) : function() {},
      isProd ? new webpack.optimize.UglifyJsPlugin({ compress: { warnings: false } }) : function() {},
      new webpack.optimize.OccurenceOrderPlugin(),
      new webpack.HotModuleReplacementPlugin(),
      new webpack.NoErrorsPlugin()
    ],
    devtool: !isProd && 'source-map'
  }
}
