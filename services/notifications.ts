/**
 * services/notifications.ts
 *
 * Single-responsibility notification service layer.
 *
 * Responsibilities:
 *  - System permission checks & requests
 *  - Android notification channel setup
 *  - Expo push token registration
 *  - Supabase push_tokens upsert / deactivate (backend record)
 *  - AsyncStorage preference persistence (user intent)
 *
 * This module does NOT own UI state. The notification-store owns that.
 */

import * as Notifications from 'expo-notifications';
import { Platform, Linking } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

// ── Notification handler (foreground display) ─────────────────────────────────

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ── Constants ─────────────────────────────────────────────────────────────────

const PREF_KEY = 'notif_pref'; // AsyncStorage key
const ANDROID_CHANNEL_ID = 'default';

export type SystemPermission = 'granted' | 'denied' | 'undetermined';

// ── Permission helpers ────────────────────────────────────────────────────────

/** Returns the current OS-level notification permission without prompting. */
export async function getNotificationPermissionStatus(): Promise<SystemPermission> {
  if (Platform.OS === 'web') return 'undetermined';
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status as SystemPermission;
  } catch {
    return 'undetermined';
  }
}

/**
 * Requests OS permission if undetermined, then returns the final status.
 * Safe to call when status is already 'granted' or 'denied'.
 */
export async function requestNotificationPermission(): Promise<SystemPermission> {
  if (Platform.OS === 'web') return 'undetermined';
  try {
    const current = await getNotificationPermissionStatus();
    if (current === 'granted' || current === 'denied') return current;
    const { status } = await Notifications.requestPermissionsAsync();
    return status as SystemPermission;
  } catch {
    return 'undetermined';
  }
}

/** Opens the device's system settings app to the notification permission screen. */
export function openNotificationSettings(): void {
  if (Platform.OS === 'ios') {
    Linking.openURL('app-settings:');
  } else {
    Linking.openSettings();
  }
}

// ── Android channel ───────────────────────────────────────────────────────────

/** Idempotent: creates the default Android notification channel if it doesn't exist. */
export async function createAndroidNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'Pothole Alerts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#ea580c',
      sound: 'default',
    });
  } catch (error) {
    console.warn('[Notifications] Failed to create Android channel:', error);
  }
}

// ── Expo push token ───────────────────────────────────────────────────────────

/**
 * Resolves the EAS project ID from Constants, following the documented
 * lookup order: expoConfig.extra.eas.projectId → easConfig.projectId.
 */
function getProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    undefined
  );
}

/**
 * Obtains the Expo push token. Returns null if the platform is web,
 * permissions are not granted, or token acquisition fails.
 */
export async function getExpoPushToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  try {
    const projectId = getProjectId();
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    return tokenData.data;
  } catch (error) {
    console.warn('[Notifications] Failed to get push token:', error);
    return null;
  }
}

// ── Backend token persistence ─────────────────────────────────────────────────

/**
 * Registers a push token for the given user, upserting into Supabase.
 * Safe to call multiple times — the unique (user_id, token) constraint
 * ensures only one row per token exists; existing rows are updated
 * (is_active = true, updated_at refreshed).
 *
 * @returns The token string on success, null on failure.
 */
export async function registerAndUpsertToken(userId: string): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  await createAndroidNotificationChannel();

  const token = await getExpoPushToken();
  if (!token) return null;

  const { error } = await supabase.from('push_tokens').upsert(
    {
      user_id: userId,
      token,
      platform: Platform.OS,
      is_active: true,
    },
    { onConflict: 'user_id,token' }
  );

  if (error) {
    console.warn('[Notifications] Failed to upsert push token:', error);
    return null;
  }

  return token;
}

/**
 * Marks all tokens for the given user as inactive in Supabase.
 * Does NOT delete the rows — the token can be re-activated without
 * a new registration if the device still holds the same Expo token.
 */
export async function deactivateTokens(userId: string): Promise<void> {
  const { error } = await supabase
    .from('push_tokens')
    .update({ is_active: false })
    .eq('user_id', userId);

  if (error) {
    console.warn('[Notifications] Failed to deactivate tokens:', error);
    throw error; // Re-throw so the store can roll back
  }
}

/**
 * Checks whether the user has at least one active token registered
 * in Supabase. Used to determine tokenStatus on app hydration.
 */
export async function hasActiveToken(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('push_tokens')
    .select('id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (error) return false;
  return data !== null;
}

// ── AsyncStorage preference ───────────────────────────────────────────────────

/**
 * Reads the persisted user preference from AsyncStorage.
 * Returns 'enabled' | 'disabled', or null if no preference has been saved yet
 * (first-time user — caller should treat as "enabled" by default).
 */
export async function getPersistedPreference(): Promise<'enabled' | 'disabled' | null> {
  try {
    const value = await AsyncStorage.getItem(PREF_KEY);
    if (value === 'enabled' || value === 'disabled') return value;
    return null;
  } catch {
    return null;
  }
}

/** Persists the user's notification preference to AsyncStorage. */
export async function setPersistedPreference(value: 'enabled' | 'disabled'): Promise<void> {
  try {
    await AsyncStorage.setItem(PREF_KEY, value);
  } catch (error) {
    console.warn('[Notifications] Failed to persist preference:', error);
    throw error; // Re-throw so store can roll back
  }
}

// ── Legacy compat (kept for existing test coverage) ──────────────────────────

/**
 * @deprecated Use getNotificationPermissionStatus + registerAndUpsertToken separately.
 * Retained so the existing notifications.test.ts suite passes without changes.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  try {
    const permission = await requestNotificationPermission();
    if (permission !== 'granted') return null;
    return await getExpoPushToken();
  } catch (error) {
    console.warn('[Notifications] Error registering for push notifications:', error);
    return null;
  }
}

/**
 * Schedules an immediate local notification as a quick smoke test.
 * NOTE: This is a LOCAL notification — it never leaves the device.
 * For a real server-side push test, use an EAS dev/release build and
 * call the Expo Push API from a backend Edge Function.
 */
export async function sendTestPushNotification(): Promise<boolean> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Pothole Alert! 🚨',
        body: 'Push notifications are successfully configured and working!',
        data: { test: true },
      },
      trigger: null, // trigger immediately
    });
    return true;
  } catch (error) {
    console.warn('[Notifications] Error scheduling local notification:', error);
    return false;
  }
}
