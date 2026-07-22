module.exports = {
  openAuthSessionAsync: jest.fn().mockResolvedValue({ type: 'cancel', url: '' }),
  maybeCompleteAuthSession: jest.fn(),
};
