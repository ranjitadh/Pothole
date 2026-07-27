/**
 * store/notification-store.ts
 *
 * Single source of truth for notification state.
 *
 * Three independent dimensions:
 *   systemPermission  — what the OS says (granted / denied / undetermined)
 *   userPreference    — what the user chose in-app (enabled / disabled)
 *   tokenStatus       — whether a valid active token is in Supabase
 *
 * effectiveEnabled = systemPermission=granted AND userPreference=enabled AND tokenStatus=registered
 *
 * The store owns all async coordination, race-condition prevention (mutex),
 * optimistic updates, and rollback on failure. Components only call
 * `initialize`, `toggle`, and `refreshPermissions`.
 */

import { create } from 'zustand';
import {
  getNotificationPermissionStatus,
  requestNotificationPermission,
  getPersistedPreference,
  setPersistedPreference,
  registerAndUpsertToken,
  deactivateTokens,
  hasActiveToken,
  SystemPermission,
} from '../services/notifications';
import { Alert, Platform } from 'react-native';

// ── Types ─────────────────────────────────────────────────────────────────────

export type UserPreference = 'enabled' | 'disabled';
export type TokenStatus = 'registered' | 'inactive' | 'missing';

interface NotificationState {
  /** Current OS-level permission status. */
  systemPermission: SystemPermission | 'loading';
  /** User's explicit in-app choice, persisted to AsyncStorage. */
  userPreference: UserPreference | 'loading';
  /** Supabase push_tokens record status. */
  tokenStatus: TokenStatus | 'loading';
  /** True while an async toggle operation is in flight. Used to disable the Switch UI. */
  isToggling: boolean;
  /** True if the store has completed at least one initialize() call. */
  isInitialized: boolean;

  /**
   * Derived: true only when all three dimensions align.
   * Safe to read before initialization — returns false (not null).
   */
  effectiveEnabled: boolean;

  /**
   * True when system permission is 'denied'. The UI should render an
   * "Open Settings" prompt instead of treating the toggle as enabled.
   */
  isPermissionDenied: boolean;

  /** Hydrates all three dimensions. Call on app ready (after auth) and on AppState 'active'. */
  initialize: (userId: string) => Promise<void>;

  /**
   * Toggles notification preference safely:
   * - Immediate loading state (isToggling=true)
   * - Optimistic UI update
   * - Full async persistence (AsyncStorage + Supabase)
   * - Rollback + Alert on any failure
   * - Mutex prevents concurrent calls
   */
  toggle: (userId: string) => Promise<void>;

  /**
   * Lightweight re-check of system permission only.
   * Called when the app returns to foreground (AppState 'active').
   * If the user granted/revoked permission in device Settings, this
   * updates `systemPermission` and recomputes `effectiveEnabled`.
   */
  refreshPermissions: (userId: string) => Promise<void>;
}

// ── Mutex ─────────────────────────────────────────────────────────────────────
// Module-level flag: survives re-renders, never captured in a stale closure.
let _isTogglingMutex = false;

// ── Helpers ───────────────────────────────────────────────────────────────────

function deriveEffectiveEnabled(
  systemPermission: SystemPermission | 'loading',
  userPreference: UserPreference | 'loading',
  tokenStatus: TokenStatus | 'loading'
): boolean {
  return (
    systemPermission === 'granted' &&
    userPreference === 'enabled' &&
    tokenStatus === 'registered'
  );
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useNotificationStore = create<NotificationState>((set, get) => ({
  systemPermission: 'loading',
  userPreference: 'loading',
  tokenStatus: 'loading',
  isToggling: false,
  isInitialized: false,
  effectiveEnabled: false,
  isPermissionDenied: false,

  // ── initialize ─────────────────────────────────────────────────────────────

  initialize: async (userId: string) => {
    if (Platform.OS === 'web') {
      set({
        systemPermission: 'undetermined',
        userPreference: 'disabled',
        tokenStatus: 'missing',
        effectiveEnabled: false,
        isPermissionDenied: false,
        isInitialized: true,
      });
      return;
    }

    try {
      // Fetch all three dimensions in parallel for fast startup.
      const [systemPermission, persistedPref, activeToken] = await Promise.all([
        getNotificationPermissionStatus(),
        getPersistedPreference(),
        hasActiveToken(userId),
      ]);

      // If no preference has ever been stored, default to 'enabled'.
      const userPreference: UserPreference = persistedPref ?? 'enabled';
      const tokenStatus: TokenStatus = activeToken ? 'registered' : 'inactive';

      set({
        systemPermission,
        userPreference,
        tokenStatus,
        effectiveEnabled: deriveEffectiveEnabled(systemPermission, userPreference, tokenStatus),
        isPermissionDenied: systemPermission === 'denied',
        isInitialized: true,
      });
    } catch (error) {
      console.warn('[NotificationStore] initialize error:', error);
      // Leave 'loading' states — components will handle gracefully.
      set({ isInitialized: true });
    }
  },

  // ── toggle ─────────────────────────────────────────────────────────────────

  toggle: async (userId: string) => {
    // Mutex: reject concurrent calls (rapid tapping).
    if (_isTogglingMutex) return;
    _isTogglingMutex = true;

    const {
      systemPermission: currentPermission,
      userPreference: currentPreference,
      tokenStatus: currentTokenStatus,
    } = get();

    // Snapshot for rollback.
    const snapshot = {
      systemPermission: currentPermission,
      userPreference: currentPreference,
      tokenStatus: currentTokenStatus,
    };

    set({ isToggling: true });

    const wantsToEnable = currentPreference !== 'enabled';

    try {
      if (wantsToEnable) {
        // ── ENABLE FLOW ──────────────────────────────────────────────────────

        // 1. Check/request system permission.
        let permission = await getNotificationPermissionStatus();

        if (permission === 'undetermined') {
          permission = await requestNotificationPermission();
        }

        if (permission === 'denied') {
          // System denied — cannot enable. Update state and show guidance.
          set({
            systemPermission: 'denied',
            isPermissionDenied: true,
            effectiveEnabled: false,
            isToggling: false,
          });
          // Alert is shown here; the "Open Settings" button is rendered by the UI.
          Alert.alert(
            'Notifications Blocked',
            'Push notifications are blocked by your device. Please enable them in your phone\'s Settings and then return to the app.',
            [{ text: 'OK' }]
          );
          return;
        }

        // 2. Optimistically mark as enabled in UI while async ops run.
        set({
          systemPermission: permission,
          userPreference: 'enabled',
          tokenStatus: 'loading',
          effectiveEnabled: false, // will be true only after token registered
          isPermissionDenied: false,
        });

        // 3. Register token with Supabase (creates Android channel internally).
        const token = await registerAndUpsertToken(userId);

        if (!token) {
          throw new Error('Could not obtain a push token. Please try again.');
        }

        // 4. Persist user preference to AsyncStorage.
        await setPersistedPreference('enabled');

        // 5. Commit final state.
        set({
          userPreference: 'enabled',
          tokenStatus: 'registered',
          effectiveEnabled: true,
        });
      } else {
        // ── DISABLE FLOW ─────────────────────────────────────────────────────

        // 1. Optimistic UI update.
        set({
          userPreference: 'disabled',
          effectiveEnabled: false,
        });

        // 2. Persist preference and deactivate backend token in parallel.
        await Promise.all([
          setPersistedPreference('disabled'),
          deactivateTokens(userId),
        ]);

        // 3. Commit final state.
        set({
          userPreference: 'disabled',
          tokenStatus: 'inactive',
          effectiveEnabled: false,
        });
      }
    } catch (error: any) {
      console.warn('[NotificationStore] toggle error:', error);

      // Roll back to pre-toggle snapshot.
      set({
        systemPermission: snapshot.systemPermission,
        userPreference: snapshot.userPreference,
        tokenStatus: snapshot.tokenStatus,
        effectiveEnabled: deriveEffectiveEnabled(
          snapshot.systemPermission,
          snapshot.userPreference,
          snapshot.tokenStatus
        ),
        isPermissionDenied: snapshot.systemPermission === 'denied',
      });

      Alert.alert(
        'Something Went Wrong',
        error?.message || 'Could not update notification settings. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      set({ isToggling: false });
      _isTogglingMutex = false;
    }
  },

  // ── refreshPermissions ─────────────────────────────────────────────────────

  refreshPermissions: async (userId: string) => {
    if (Platform.OS === 'web') return;
    try {
      const systemPermission = await getNotificationPermissionStatus();
      const { userPreference, tokenStatus } = get();

      // If the user revoked permissions via system Settings, deactivate tokens.
      if (systemPermission === 'denied') {
        // Best-effort — do not block the UI on this.
        deactivateTokens(userId).catch(() => {});
        await setPersistedPreference('disabled').catch(() => {});
        set({
          systemPermission,
          userPreference: 'disabled',
          tokenStatus: 'inactive',
          effectiveEnabled: false,
          isPermissionDenied: true,
        });
        return;
      }

      set({
        systemPermission,
        isPermissionDenied: false,
        effectiveEnabled: deriveEffectiveEnabled(systemPermission, userPreference, tokenStatus),
      });
    } catch (error) {
      console.warn('[NotificationStore] refreshPermissions error:', error);
    }
  },
}));
