let http = require('http')
let express = require('express')
let ws = require('ws')
let geoip = require('geoip-lite')
let useragent = require('useragent')
let config = require('./config')

let app = express()
let server = http.Server(app)
let wss = new ws.Server({ server: server, path: '/', clientTracking: false, maxPayload: 2048 })

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
    ip: !config.anonymize ? ip : null,
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
      case 'update':
        user.scroll = msg.scroll
        user.focus = msg.focus
        break
      case 'timing':
        user.timing = msg.timing
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

      var intervalID = setInterval(function() {
        if (socket.readyState != socket.OPEN) return clearInterval(intervalID);
        socket.send(JSON.stringify({
          type: 'update',
          scroll: 100.0*document.documentElement.scrollTop/document.documentElement.scrollHeight,
          focus: 'hidden' in document ? !document.hidden : undefined,
        }));
      }, 20000);

      setTimeout(function() {
        if (socket.readyState != socket.OPEN) return;
        socket.send(JSON.stringify({
          type: 'timing',
          timing: window.performance ? window.performance.timing.toJSON() : null
        }));
      }, 10000);
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
      <h1>Test Page</h1>
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

let webpack = require('webpack')
let webpackDevMiddleware = require('webpack-dev-middleware')
let webpackHotMiddleware = require('webpack-hot-middleware')
let compiler = webpack(config.webpack)

app.use(basicAuth, webpackDevMiddleware(compiler, {
  publicPath: config.webpack.output.publicPath,
  noInfo: true
}))

if (!config.isProd) {
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
      <script>window.config = { wsdashboard: '${config.wsdashboard}' };</script>
      <script src="bundle.js"></script>
      ${config.trackDashboard && '<script src="analytics.js"></script>'}
    </body>
    </html>
  `

  res.send(html)
})

function sendData(socket) {
  try {
    socket.send(JSON.stringify(users))
  } catch (e) {
    return
  }
}

let wssadmin = new ws.Server({ server: server, path: '/dashboard' })

wssadmin.on('connection', socket => {
  if (!isAuth(socket.upgradeReq)) return socket.close()
  sendData()
})

setInterval(() => wssadmin.clients.forEach(s => sendData(s)), 1000)
