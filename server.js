let http = require('http')
let express = require('express')
let ws = require('ws')
let geoip = require('geoip-lite')
let useragent = require('useragent')

let app = express()
let server = http.Server(app)
let wss = new ws.Server({ server: server, path: '/', clientTracking: false, maxPayload: 1024 })

let config = {
  port: 8080,
  wshost: 'ws://localhost:8080'
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

  socket.once('close', () => {
    delete users[id]
    userCount--
  })
})

wss.on('error', err => console.error(err))

app.get('/analytics.js', (req, res) => {
  let trackerjs = `var socket = new WebSocket('${config.wshost}');`

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
