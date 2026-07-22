const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  navigate: jest.fn(),
  canGoBack: jest.fn().mockReturnValue(true),
};

const useRouter = jest.fn(() => mockRouter);
const useSegments = jest.fn().mockReturnValue([]);
const useLocalSearchParams = jest.fn().mockReturnValue({});

module.exports = {
  useRouter,
  useSegments,
  useLocalSearchParams,
  Link: 'Link',
  Stack: {
    Screen: 'Screen',
  },
  router: mockRouter,
};
