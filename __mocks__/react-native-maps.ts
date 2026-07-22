const React = require('react');

function MapView(props) {
  return React.createElement('MapView', props);
}

function Marker(props) {
  return React.createElement('Marker', props);
}

function Callout(props) {
  return React.createElement('Callout', props);
}

module.exports = {
  __esModule: true,
  default: MapView,
  Marker,
  Callout,
};
