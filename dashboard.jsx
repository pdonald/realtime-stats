import React from 'react'
import ReactDOM from 'react-dom'
import { Map, Marker, Popup, TileLayer } from 'react-leaflet'
import url from 'url'
import _ from 'lodash'

import 'bootstrap/dist/css/bootstrap.css'
//import 'leaflet/dist/leaflet.css'

if (module.hot) {
  module.hot.accept()
}

function groupsort(array, f) {
  return _.chain(array).countBy(f).toPairs().sortBy(p => p[1]).reverse().value()
}

let sources = {
  'https://t.co/': url => 'Twitter',
  'https://www.google.': url => 'Google',
  'https://mail.google.com': url => 'GMail',
  'https://plus.google.com/': url => 'Google+',
  'https://www.facebook.com': url => 'Facebook',
  'http://feedly.com/': url => 'Feedly',
  'https://lobste.rs/': url => 'Lobste.rs',
  'https://news.ycombinator.com': url => 'Hacker News',
  'https://www.reddit.com/r/': url => 'Reddit /r/' + url.split('/')[4],
  'https://en.reddit.com/r/': url => 'Reddit /r/' + url.split('/')[4],
  'https://www.reddit.com/': url => 'Reddit'
}

function source(url) {
  if (!url) return '(undefined)'
  for (let key in sources) {
    if (url.indexOf(key) === 0) {
      return sources[key](url)
    }
  }
  return url.split('/')[2]
}

class App extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      users: [],
      error: null
    }
  }

  componentDidMount() {
    this.ws = new WebSocket(window.config.wsdashboard)
    this.ws.onmessage = e => this.setState({ users: Object.values(JSON.parse(e.data)) })
    this.ws.onerror = e => this.setState({ error: 'WebSocket error' })
    this.ws.onclose = e => !e.wasClean && this.setState({ error: `WebSocket error: ${e.code} ${e.reason}` })
  }

  componentWillUnmount() {
    this.ws.close()
  }

  render() {
    return (
      <div className="container">
        <style>{`.table-breakable td { word-break: break-all; }`}</style>
        <h1>Real Time Stats</h1>
        {this.state.error && 
          <div className="alert alert-danger">
            <a onClick={() => this.setState({ error: null })} className="pull-right">x</a>
            {this.state.error}
          </div>}
        <div className="well text-center">
          <span style={{ fontSize: '72px', fontWeight: 'bold' }}>{this.state.users.length}</span><br/>
          Users Online
        </div>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.0.2/dist/leaflet.css" />
        <Map center={[0,0]} zoom={1} style={{ height: '400px', marginBottom: '20px' }}>
          <TileLayer url='http://{s}.tile.osm.org/{z}/{x}/{y}.png'/>
          {this.state.users.filter(u => u.ipgeo).map(u => (
            <Marker key={u.id} position={u.ipgeo.ll}>
              <Popup>
                <span>{u.url}<br/>{[u.ipgeo.city, u.ipgeo.region, u.ipgeo.country].filter(x=>x).join(', ')}</span>
              </Popup>
            </Marker>))}
        </Map>
        {this.renderTable('Pages', groupsort(this.state.users, u => u.url ? url.parse(u.url).pathname : '(undefined)'))}
        <div className="row">
          <div className="col-md-8">
            {this.renderTable('Referers', groupsort(this.state.users, u => u.ref))}
          </div>
          <div className="col-md-4">
            {this.renderTable('Sources', groupsort(this.state.users, u => source(u.ref)))}
          </div>
        </div>
        <div className="row">
          <div className="col-md-4">
            {this.renderTable('Countries', groupsort(this.state.users, u => u.ipgeo ? u.ipgeo.country : ''))}
          </div>
          <div className="col-md-4">
            {this.renderTable('Browsers', groupsort(this.state.users, u => u.ua ? u.ua.family : ''))}
          </div>
          <div className="col-md-4">
            {this.renderTable('Operating Systems', groupsort(this.state.users, u => u.ua && u.ua.os ? u.ua.os.family : ''))}
          </div>
        </div>
        <table className="table table-bordered table-condensed table-breakable">
        <thead>
        <tr>
          <th style={{width:'30%'}}>URL</th>
          <th style={{width:'25%'}}>Referrer</th>
          <th>Load time</th>
          <th>Browser</th>
          <th>OS</th>
          <th>Country</th>
        </tr>
        </thead>
        <tbody>
          {this.state.users.slice(0).reverse().map(u => (
            <tr key={u.id}>
              <td>{u.url + ('scroll' in u ? ' @ ' + u.scroll + '%' : '') +  (u.focus === false ? ' no focus' : '')}</td>
              <td>{u.ref}</td>
              <td>{u.timing ? ((u.timing.loadEventEnd-u.timing.navigationStart)/1000).toFixed(3) + 's' : 'n/a'}</td>
              <td>{u.ua ? u.ua.family : 'n/a'}</td>
              <td>{u.ua && u.ua.os ? u.ua.os.family : 'n/a'}</td>
              <td>{u.ipgeo ? [u.ipgeo.city, u.ipgeo.country].filter(x=>x).join(', ') : 'n/a'}</td>
            </tr>))}
        </tbody>
        </table>
      </div>
    )
  }

  renderTable(name, data) {
    return (
      <table className="table table-bordered table-condensed table-breakable">
      <thead>
        <tr><th>{name}</th><th>Count</th></tr>
      </thead>
      <tbody>
        {data.map(item => <tr key={item[0]}><td>{item[0] || '(none)'}</td><td>{item[1]}</td></tr>)}
      </tbody>
      </table>
    )
  }
}

ReactDOM.render(<App/>, document.getElementById('root'))
