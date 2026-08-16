process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '../../services/supabase';

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn().mockResolvedValue(null),
  getItemAsync: jest.fn().mockResolvedValue('test_val'),
  deleteItemAsync: jest.fn().mockResolvedValue(null),
}));

describe('Supabase Client & SecureStoreAdapter', () => {
  it('exports initialized supabase client', () => {
    expect(supabase).toBeDefined();
    expect(supabase.auth).toBeDefined();
  });

  describe('ExpoSecureStoreAdapter', () => {
    it('handles mobile storage methods via SecureStore', async () => {
      (Platform as any).OS = 'ios';
      const storage = (supabase as any).auth?.storage;
      if (storage) {
        await storage.setItem('test_key', 'test_val');
        expect(SecureStore.setItemAsync).toHaveBeenCalledWith('test_key', 'test_val');

        await storage.getItem('test_key');
        expect(SecureStore.getItemAsync).toHaveBeenCalledWith('test_key');

        await storage.removeItem('test_key');
        expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('test_key');
      }
    });

    it('handles web storage methods via localStorage', async () => {
      (Platform as any).OS = 'web';
      const mockStorage: Record<string, string> = {};
      const globalWindow = global as any;
      globalWindow.window = {
        localStorage: {
          getItem: jest.fn((k) => mockStorage[k] || null),
          setItem: jest.fn((k, v) => { mockStorage[k] = v; }),
          removeItem: jest.fn((k) => { delete mockStorage[k]; }),
        },
      };

      const storage = (supabase as any).auth?.storage;
      if (storage) {
        storage.setItem('web_key', 'web_val');
        expect(globalWindow.window.localStorage.setItem).toHaveBeenCalledWith('web_key', 'web_val');

        storage.getItem('web_key');
        expect(globalWindow.window.localStorage.getItem).toHaveBeenCalledWith('web_key');

        storage.removeItem('web_key');
        expect(globalWindow.window.localStorage.removeItem).toHaveBeenCalledWith('web_key');
      }
      (Platform as any).OS = 'ios';
    });
  });
});
