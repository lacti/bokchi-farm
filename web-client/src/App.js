import React from 'react';
import './App.css';
import { Tile } from './Tile';

class App extends React.Component {
  render() {
    return (
      <div className="App">
        <header className="App-header">
          <h1 className="App-title">Fire Farm</h1>
        </header>
        <Tile x={1} y={1} />
      </div>
    );
  }
}

export default App;
