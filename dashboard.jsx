import React from 'react'
import ReactDOM from 'react-dom'
import _ from 'lodash'

import 'bootstrap/dist/css/bootstrap.css'

if (module.hot) {
  module.hot.accept()
}

function groupsort(array, f) {
  return _.chain(array).countBy(f).toPairs().sortBy(p => p[1]).reverse().value()
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
    this.ws = new WebSocket('ws://localhost:8080/dashboard')
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
        {this.renderTable('Pages', groupsort(this.state.users, u => u.url))}
        {this.renderTable('Referers', groupsort(this.state.users, u => u.ref))}
        {this.renderTable('Countries', groupsort(this.state.users, u => u.ipgeo ? u.ipgeo.country : ''))}
      </div>
    )
  }

  renderTable(name, data) {
    return (
      <table className="table table-bordered table-condensed">
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
