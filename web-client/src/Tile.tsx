import * as React from 'react';
import * as model from './model';

interface TileProps {
  x: number;
  y: number;
  state: model.TileState;
  value: number;
  onUpgrade: (x: number, y: number, value: number) => void;
  onWater: (x: number, y: number) => void;
}

interface TileStates {
  power: number;
  value: number;
}

class Tile extends React.Component<TileProps, TileStates> {
  constructor(props: TileProps) {
    super(props);
    const { value } = props;
    this.state = {
      power: 0,
      value,
    };
  }
  public onClick = () => {
    const { power, value } = this.state;
    if (power === 9) {
      const { x, y, state, onUpgrade, onWater } = this.props;
      if (state === 'Green') {
        onUpgrade(x, y, value + 1);
        this.setState({
          value: value + 1,
        });
      } else {
        onWater(x, y);
      }

      this.setState({
        power: 0,
      });
    } else {
      this.setState({
        power: power + 1,
      });
    }
  };

  public render() {
    const { state } = this.props;
    const { value, power } = this.state;
    return (
      <span className={state} onClick={this.onClick}>
        {value} <sub>{power}</sub>
      </span>
    );
  }
}

export default Tile;
