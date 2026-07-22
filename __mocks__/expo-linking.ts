module.exports = {
  createURL: jest.fn().mockReturnValue('pothole://'),
  useURL: jest.fn().mockReturnValue(null),
  openURL: jest.fn().mockResolvedValue(true),
};
