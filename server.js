let http = require('http')
let express = require('express')
let ws = require('ws')
let geoip = require('geoip-lite')
let useragent = require('useragent')
let webpack = require('webpack')

let app = express()
let server = http.Server(app)
let wss = new ws.Server({ server: server, path: '/', clientTracking: false, maxPayload: 1024 })

let isProd = process.env.NODE_ENV === 'production'
let config = {
  auth: { user: 'user', password: 'pass' },
  port: 8080,
  wshost: 'ws://localhost:8080',
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

app.disable('x-powered-by')
server.listen(config.port)

let users = {}
let userCount = 0
let userLastID = 0

setInterval(() => console.log(`Users online: ${userCount}`), 10 * 1000)

wss.on('connection', socket => {
  userCount++

  let id = userLastID++
  let ip = socket.upgradeReq.headers['x-real-ip'] || socket.upgradeReq.connection.remoteAddress
  let user = users[id] = {
    id: id,
    host: socket.upgradeReq.headers['host'],
    ip: ip,
    ipgeo: geoip.lookup(ip),
    ua: useragent.lookup(socket.upgradeReq.headers['user-agent']).toJSON(),
    date: Date.now(),
    updated: Date.now()
  }

  socket.on('message', msg => {
    try {
      msg = JSON.parse(msg)
    } catch (e) {
      return
    }

    switch (msg.type) {
      case 'init':
        user.url = msg.url
        user.ref = msg.ref
        break
    }

    user.updated = Date.now()
  })

  socket.once('close', () => {
    delete users[id]
    userCount--
  })
})

wss.on('error', err => console.error(err))

app.get('/analytics.js', (req, res) => {
  let trackerjs = `
    var socket = new WebSocket('${config.wshost}');
    socket.onopen = function() {
      socket.send(JSON.stringify({
        type: 'init',
        url: document.location.href,
        ref: document.referrer
      }));
    };`

  res.set('Content-Type', 'application/javascript')
  res.send(trackerjs)
})

app.get('/test/*', (req, res) => {
  let html = `
    <!doctype html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Test Page</title>
    </head>
    <body>
      <h1>test page</h1>
      <script src="/analytics.js"></script>
    </body>
    </html>`

  res.send(html)
})

function isAuth(req) {
  try {
    let header = req.headers.authorization
    let userpass = config.auth.user + ':' + config.auth.password
    return header && header.indexOf('Basic ') === 0 && 
      new Buffer(header.split(' ')[1], 'base64').toString() === userpass
  } catch (e) {
    return false
  }
}

function basicAuth(req, res, next) {
  if (isAuth(req)) {
    return next()
  }

  res.set('WWW-Authenticate', 'Basic realm="Admin Area"')
  setTimeout(() => res.status(401).send('Authentication required'), req.headers.authorization ? 5000 : 0)
}

let webpackDevMiddleware = require('webpack-dev-middleware')
let webpackHotMiddleware = require('webpack-hot-middleware')
let compiler = webpack(config.webpack)

app.use(basicAuth, webpackDevMiddleware(compiler, {
  publicPath: config.webpack.output.publicPath,
  noInfo: true
}))

if (!isProd) {
  app.use(basicAuth, webpackHotMiddleware(compiler))
}

app.get('/', basicAuth, (req, res) => {
  let html = `
    <!doctype html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Stats</title>
    </head>
    <body>
      <div id="root"></div>
      <script src="bundle.js"></script>
    </body>
    </html>
  `

  res.send(html)
})

let wssadmin = new ws.Server({ server: server, path: '/dashboard' })

wssadmin.on('connection', socket => {
  if (!isAuth(socket.upgradeReq)) return socket.close()
  socket.send(JSON.stringify(users))
})

setInterval(() => wssadmin.clients.forEach(s => s.send(JSON.stringify(users))), 1000)
