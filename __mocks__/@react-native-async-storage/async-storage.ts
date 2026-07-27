// __mocks__/@react-native-async-storage/async-storage.ts
// Manual mock for @react-native-async-storage/async-storage.
// Used by services/notifications.ts (preference persistence).

const mockStore: Record<string, string | null> = {};

const AsyncStorage = {
  getItem: jest.fn(async (key: string) => mockStore[key] ?? null),
  setItem: jest.fn(async (key: string, value: string) => {
    mockStore[key] = value;
  }),
  removeItem: jest.fn(async (key: string) => {
    delete mockStore[key];
  }),
  clear: jest.fn(async () => {
    Object.keys(mockStore).forEach((k) => delete mockStore[k]);
  }),
  getAllKeys: jest.fn(async () => Object.keys(mockStore)),
  multiGet: jest.fn(async (keys: string[]) =>
    keys.map((k) => [k, mockStore[k] ?? null])
  ),
  multiSet: jest.fn(async (pairs: [string, string][]) => {
    pairs.forEach(([k, v]) => { mockStore[k] = v; });
  }),
  multiRemove: jest.fn(async (keys: string[]) => {
    keys.forEach((k) => { delete mockStore[k]; });
  }),
};

export default AsyncStorage;
module.exports = AsyncStorage;
