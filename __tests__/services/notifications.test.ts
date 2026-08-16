/**
 * __tests__/services/notifications.test.ts
 *
 * Tests for the notifications service layer.
 * Covers both the new granular API and the legacy registerForPushNotificationsAsync.
 */
import * as Notifications from 'expo-notifications';
import { Platform, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  registerForPushNotificationsAsync,
  sendTestPushNotification,
  getNotificationPermissionStatus,
  requestNotificationPermission,
  openNotificationSettings,
  createAndroidNotificationChannel,
  registerAndUpsertToken,
  deactivateTokens,
  hasActiveToken,
  getPersistedPreference,
  setPersistedPreference,
} from '../../services/notifications';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn().mockImplementation((config) => {
    if (config && config.handleNotification) {
      config.handleNotification();
    }
  }),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'ExponentPushToken[token-123]' }),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('id-123'),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(null),
  AndroidImportance: { HIGH: 4 },
}));

jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      eas: { projectId: 'f4579e84-439d-4b0a-b4c2-4c9e6068ac62' },
    },
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../services/supabase', () => ({
  supabase: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: { id: '1' }, error: null }),
  },
}));

import { supabase } from '../../services/supabase';
const mockSupabase = supabase as any;

// ── Helpers ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  (Platform as any).OS = 'ios';
  mockSupabase.from.mockReturnThis();
  mockSupabase.upsert.mockResolvedValue({ data: null, error: null });
  mockSupabase.update.mockReturnThis();
  mockSupabase.eq.mockReturnThis();
  mockSupabase.select.mockReturnThis();
  mockSupabase.limit.mockReturnThis();
  mockSupabase.maybeSingle.mockResolvedValue({ data: { id: '1' }, error: null });
});

// ── getNotificationPermissionStatus ──────────────────────────────────────────

describe('getNotificationPermissionStatus', () => {
  it('returns granted when OS says granted', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'granted' });
    const result = await getNotificationPermissionStatus();
    expect(result).toBe('granted');
  });

  it('returns denied when OS says denied', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'denied' });
    const result = await getNotificationPermissionStatus();
    expect(result).toBe('denied');
  });

  it('returns undetermined when OS says undetermined', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'undetermined' });
    const result = await getNotificationPermissionStatus();
    expect(result).toBe('undetermined');
  });

  it('returns undetermined if getPermissionsAsync throws', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockRejectedValueOnce(new Error('fail'));
    const result = await getNotificationPermissionStatus();
    expect(result).toBe('undetermined');
  });

  it('returns undetermined on web platform', async () => {
    (Platform as any).OS = 'web';
    const result = await getNotificationPermissionStatus();
    expect(result).toBe('undetermined');
  });
});

// ── requestNotificationPermission ────────────────────────────────────────────

describe('requestNotificationPermission', () => {
  it('returns granted without prompting when already granted', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'granted' });
    const result = await requestNotificationPermission();
    expect(result).toBe('granted');
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('calls requestPermissionsAsync when undetermined', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'undetermined' });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'granted' });
    const result = await requestNotificationPermission();
    expect(result).toBe('granted');
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('returns denied without prompting when already denied', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'denied' });
    const result = await requestNotificationPermission();
    expect(result).toBe('denied');
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('returns undetermined on web platform', async () => {
    (Platform as any).OS = 'web';
    const result = await requestNotificationPermission();
    expect(result).toBe('undetermined');
  });

  it('handles error in requestPermissionsAsync gracefully', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'undetermined' });
    (Notifications.requestPermissionsAsync as jest.Mock).mockRejectedValueOnce(new Error('err'));
    const result = await requestNotificationPermission();
    expect(result).toBe('undetermined');
  });
});

// ── openNotificationSettings & Android Channel ───────────────────────────────

describe('openNotificationSettings and Channel', () => {
  it('opens iOS settings link on iOS', () => {
    const linkSpy = jest.spyOn(Linking, 'openURL').mockImplementation(() => Promise.resolve());
    openNotificationSettings();
    expect(linkSpy).toHaveBeenCalledWith('app-settings:');
    linkSpy.mockRestore();
  });

  it('opens Android settings link on Android', () => {
    (Platform as any).OS = 'android';
    const linkSpy = jest.spyOn(Linking, 'openSettings').mockImplementation(() => Promise.resolve());
    openNotificationSettings();
    expect(linkSpy).toHaveBeenCalled();
    linkSpy.mockRestore();
  });

  it('creates Android channel on android platform', async () => {
    (Platform as any).OS = 'android';
    await createAndroidNotificationChannel();
    expect(Notifications.setNotificationChannelAsync).toHaveBeenCalled();
  });

  it('handles error in channel creation gracefully', async () => {
    (Platform as any).OS = 'android';
    (Notifications.setNotificationChannelAsync as jest.Mock).mockRejectedValueOnce(new Error('Channel err'));
    await createAndroidNotificationChannel();
  });
});

// ── registerAndUpsertToken ───────────────────────────────────────────────────

describe('registerAndUpsertToken', () => {
  it('returns the push token and calls supabase upsert', async () => {
    const token = await registerAndUpsertToken('user-abc');
    expect(token).toBe('ExponentPushToken[token-123]');
    expect(supabase.from).toHaveBeenCalledWith('push_tokens');
    expect(supabase.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-abc', is_active: true }),
      expect.objectContaining({ onConflict: 'user_id,token' })
    );
  });

  it('returns null when token acquisition fails', async () => {
    (Notifications.getExpoPushTokenAsync as jest.Mock).mockRejectedValueOnce(new Error('no token'));
    const token = await registerAndUpsertToken('user-abc');
    expect(token).toBeNull();
  });

  it('returns null when supabase upsert errors', async () => {
    supabase.upsert.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });
    const token = await registerAndUpsertToken('user-abc');
    expect(token).toBeNull();
  });
});

// ── deactivateTokens ─────────────────────────────────────────────────────────

describe('deactivateTokens', () => {
  it('calls update with is_active=false for the user', async () => {
    supabase.update.mockReturnThis();
    supabase.eq.mockResolvedValueOnce({ data: null, error: null });
    await deactivateTokens('user-abc');
    expect(supabase.update).toHaveBeenCalledWith({ is_active: false });
    expect(supabase.eq).toHaveBeenCalledWith('user_id', 'user-abc');
  });

  it('throws when supabase returns an error', async () => {
    supabase.eq.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });
    await expect(deactivateTokens('user-abc')).rejects.toBeTruthy();
  });
});

// ── hasActiveToken ───────────────────────────────────────────────────────────

describe('hasActiveToken', () => {
  it('returns true when an active token row exists', async () => {
    supabase.maybeSingle.mockResolvedValueOnce({ data: { id: 'row-1' }, error: null });
    const result = await hasActiveToken('user-abc');
    expect(result).toBe(true);
  });

  it('returns false when no active token row exists', async () => {
    supabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const result = await hasActiveToken('user-abc');
    expect(result).toBe(false);
  });

  it('returns false on supabase error', async () => {
    supabase.maybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'err' } });
    const result = await hasActiveToken('user-abc');
    expect(result).toBe(false);
  });
});

// ── AsyncStorage preference ───────────────────────────────────────────────────

describe('getPersistedPreference / setPersistedPreference', () => {
  it('returns null when nothing stored', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
    const result = await getPersistedPreference();
    expect(result).toBeNull();
  });

  it('returns "enabled" when stored', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('enabled');
    const result = await getPersistedPreference();
    expect(result).toBe('enabled');
  });

  it('returns "disabled" when stored', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('disabled');
    const result = await getPersistedPreference();
    expect(result).toBe('disabled');
  });

  it('returns null for an unexpected stored value', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('invalid');
    const result = await getPersistedPreference();
    expect(result).toBeNull();
  });

  it('returns null when AsyncStorage.getItem throws', async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('storage error'));
    const result = await getPersistedPreference();
    expect(result).toBeNull();
  });

  it('setPersistedPreference calls AsyncStorage.setItem', async () => {
    await setPersistedPreference('disabled');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('notif_pref', 'disabled');
  });

  it('setPersistedPreference throws on error', async () => {
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('write error'));
    await expect(setPersistedPreference('disabled')).rejects.toThrow();
  });
});

// ── Legacy API compatibility ──────────────────────────────────────────────────

describe('registerForPushNotificationsAsync (legacy)', () => {
  it('returns token when permission is granted', async () => {
    const token = await registerForPushNotificationsAsync();
    expect(token).toBe('ExponentPushToken[token-123]');
    expect(Notifications.getPermissionsAsync).toHaveBeenCalled();
  });

  it('requests permissions when undetermined', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'undetermined' });
    const token = await registerForPushNotificationsAsync();
    expect(token).toBe('ExponentPushToken[token-123]');
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
  });

  it('returns null when permission is denied', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'denied' });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'denied' });
    const token = await registerForPushNotificationsAsync();
    expect(token).toBeNull();
  });

  it('returns null on web platform', async () => {
    (Platform as any).OS = 'web';
    const token = await registerForPushNotificationsAsync();
    expect(token).toBeNull();
  });

  it('handles errors gracefully and returns null', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockRejectedValueOnce(new Error('err'));
    const token = await registerForPushNotificationsAsync();
    expect(token).toBeNull();
  });
});

describe('sendTestPushNotification', () => {
  it('schedules a local notification and returns true', async () => {
    const success = await sendTestPushNotification();
    expect(success).toBe(true);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          title: expect.stringContaining('Pothole'),
        }),
      })
    );
  });

  it('returns false when scheduling fails', async () => {
    (Notifications.scheduleNotificationAsync as jest.Mock).mockRejectedValueOnce(new Error('fail'));
    const success = await sendTestPushNotification();
    expect(success).toBe(false);
  });
});
