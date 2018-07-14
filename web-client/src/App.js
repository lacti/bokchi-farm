import React from 'react';
import Tile from './Tile';
import './App.css';

const apiBase =
  'https://ztpo29zqel.execute-api.ap-northeast-2.amazonaws.com/prod';
const gameId = '00000000-0000-0000-0000000000000000';

class App extends React.Component {
  componentDidMount() {
    this.initialize().then(async () => {
      this.tick();
      setInterval(() => this.tick(), 3000);
    });
  }

  onUpgrade = (x, y, value) => {
    fetch(`${apiBase}/act/${gameId}/${this.userId}`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'green',
        x,
        y,
        value,
      }),
    })
      .then(r => r.json())
      .then(window.console.log);
  };

  onWater = (x, y) => {
    fetch(`${apiBase}/act/${gameId}/${this.userId}`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'water',
        x,
        y,
        value: 1,
      }),
    })
      .then(r => r.json())
      .then(window.console.log);
  };

  onFire = () => {
    fetch(`${apiBase}/act/${gameId}/${this.userId}`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'fire',
      }),
    })
      .then(r => r.json())
      .then(window.console.log);
  };

  async initialize() {
    const userIdInStorage = localStorage.getItem('bf_userid');
    if (!userIdInStorage) {
      const user = await fetch(`${apiBase}/start/${gameId}`, {
        method: 'POST',
        body: '{}',
      }).then(r => r.json());
      window.console.log(user);
      localStorage.setItem('bf_userid', user.userId);
      this.userId = user.userId;
    } else {
      this.userId = userIdInStorage;
    }
    this.age = -1;
  }

  async fetchFarm() {
    return fetch(`${apiBase}/see/${gameId}/${this.userId}`, {
      method: 'POST',
      body: JSON.stringify({ age: this.age }),
    }).then(r => r.json());
  }

  async tick() {
    const see = await this.fetchFarm();
    window.console.log(see);
    if (this.age === see.age) {
      return;
    }
    this.age = see.age;
    this.setState({
      farm: see.farm,
    });
  }

  render() {
    window.console.log(this.state);
    if (!this.state) {
      return <div />;
    }
    const { farm } = this.state;
    if (!farm) {
      return <div />;
    }

    window.console.log(farm);
    const tiles = [];
    for (let index = 0; index < farm.Ground.length; index += 1) {
      const each = farm.Ground[index];
      tiles.push(
        <Tile
          key={each.Y * 100 + each.X}
          x={each.X}
          y={each.Y}
          state={each.State}
          value={each.Value}
          onUpgrade={this.onUpgrade}
          onWater={this.onWater}
        />,
      );
    }
    return (
      <div className="App">
        <header className="App-header">
          <h1 className="App-title">Fire Farm</h1>
          <sub>{farm.Money}</sub>
        </header>
        {tiles}
      </div>
    );
  }
}

export default App;
