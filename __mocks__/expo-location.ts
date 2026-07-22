module.exports = {
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getCurrentPositionAsync: jest.fn().mockResolvedValue({
    coords: { latitude: 27.7172, longitude: 85.324, altitude: null, accuracy: null },
  }),
  getLastKnownPositionAsync: jest.fn().mockResolvedValue({
    coords: { latitude: 27.7172, longitude: 85.324, altitude: null, accuracy: null },
  }),
  reverseGeocodeAsync: jest.fn().mockResolvedValue([
    { streetNumber: '123', street: 'Main St', city: 'Kathmandu', subregion: 'Bagmati' },
  ]),
  geocodeAsync: jest.fn().mockResolvedValue([
    { latitude: 27.7172, longitude: 85.324 },
  ]),
};
