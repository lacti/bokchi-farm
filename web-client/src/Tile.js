import React from 'react';
import PropTypes from 'prop-types';

class Tile extends React.Component {
  constructor() {
    super();
    this.state = {
      power: 0,
    };
  }
  onClick = () => {
    const { power } = this.state;
    if (power === 9) {
      const { x, y, state, value, onUpgrade, onWater } = this.props;
      if (state === 'Green') {
        onUpgrade(x, y, value + 1);
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

  render() {
    const { state, value } = this.props;
    const { power } = this.state;
    return (
      <span className={state} onClick={this.onClick}>
        {value} <sub>{power}</sub>
      </span>
    );
  }
}

Tile.propTypes = {
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
  state: PropTypes.string.isRequired,
  value: PropTypes.number.isRequired,
  onUpgrade: PropTypes.func.isRequired,
  onWater: PropTypes.func.isRequired,
};

export default Tile;
