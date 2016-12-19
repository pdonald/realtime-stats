import React from 'react'
import ReactDOM from 'react-dom'
import 'bootstrap/dist/css/bootstrap.css'

if (module.hot) {
  module.hot.accept()
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
      </div>
    )
  }
}

ReactDOM.render(<App/>, document.getElementById('root'))
