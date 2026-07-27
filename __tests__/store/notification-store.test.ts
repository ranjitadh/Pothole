/**
 * __tests__/store/notification-store.test.ts
 *
 * Tests for the notification Zustand store.
 *
 * Covers:
 *  - initialize: hydrates all three dimensions from real service calls
 *  - toggle (enable path): permission check → token upsert → persistence
 *  - toggle (disable path): deactivate token → persist preference
 *  - toggle: rollback on backend failure
 *  - toggle: mutex prevents concurrent calls
 *  - toggle: permission denied shows correct state
 *  - refreshPermissions: updates systemPermission from OS
 *  - effectiveEnabled derivation
 */

import { act } from 'react-test-renderer';

// ── Service mocks ─────────────────────────────────────────────────────────────

const mockGetNotificationPermissionStatus = jest.fn().mockResolvedValue('granted');
const mockRequestNotificationPermission = jest.fn().mockResolvedValue('granted');
const mockGetPersistedPreference = jest.fn().mockResolvedValue(null);
const mockSetPersistedPreference = jest.fn().mockResolvedValue(undefined);
const mockRegisterAndUpsertToken = jest.fn().mockResolvedValue('ExponentPushToken[abc]');
const mockDeactivateTokens = jest.fn().mockResolvedValue(undefined);
const mockHasActiveToken = jest.fn().mockResolvedValue(true);

jest.mock('../../services/notifications', () => ({
  getNotificationPermissionStatus: () => mockGetNotificationPermissionStatus(),
  requestNotificationPermission: () => mockRequestNotificationPermission(),
  getPersistedPreference: () => mockGetPersistedPreference(),
  setPersistedPreference: (v: string) => mockSetPersistedPreference(v),
  registerAndUpsertToken: (userId: string) => mockRegisterAndUpsertToken(userId),
  deactivateTokens: (userId: string) => mockDeactivateTokens(userId),
  hasActiveToken: (userId: string) => mockHasActiveToken(userId),
}));

// Mock Alert directly — spyOn approach avoids the NativeWind jsx-runtime
// breakage that jest.mock('react-native', ...) causes.
import { Alert } from 'react-native';
const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

import { useNotificationStore } from '../../store/notification-store';

beforeEach(async () => {
  jest.clearAllMocks();
  alertSpy.mockClear();
  // Reset store state before every test
  useNotificationStore.setState({
    systemPermission: 'loading',
    userPreference: 'loading',
    tokenStatus: 'loading',
    isToggling: false,
    isInitialized: false,
    effectiveEnabled: false,
    isPermissionDenied: false,
  });
});

// ── initialize ────────────────────────────────────────────────────────────────

describe('initialize', () => {
  it('hydrates all three dimensions in parallel', async () => {
    mockGetNotificationPermissionStatus.mockResolvedValueOnce('granted');
    mockGetPersistedPreference.mockResolvedValueOnce('enabled');
    mockHasActiveToken.mockResolvedValueOnce(true);

    await act(async () => {
      await useNotificationStore.getState().initialize('user-1');
    });

    const state = useNotificationStore.getState();
    expect(state.systemPermission).toBe('granted');
    expect(state.userPreference).toBe('enabled');
    expect(state.tokenStatus).toBe('registered');
    expect(state.effectiveEnabled).toBe(true);
    expect(state.isPermissionDenied).toBe(false);
    expect(state.isInitialized).toBe(true);
  });

  it('defaults userPreference to "enabled" when no pref stored (first-time user)', async () => {
    mockGetPersistedPreference.mockResolvedValueOnce(null);
    mockHasActiveToken.mockResolvedValueOnce(false);

    await act(async () => {
      await useNotificationStore.getState().initialize('user-1');
    });

    expect(useNotificationStore.getState().userPreference).toBe('enabled');
    expect(useNotificationStore.getState().tokenStatus).toBe('inactive');
    // effectiveEnabled = false because tokenStatus !== 'registered'
    expect(useNotificationStore.getState().effectiveEnabled).toBe(false);
  });

  it('sets isPermissionDenied when OS permission is denied', async () => {
    mockGetNotificationPermissionStatus.mockResolvedValueOnce('denied');
    mockGetPersistedPreference.mockResolvedValueOnce('enabled');
    mockHasActiveToken.mockResolvedValueOnce(false);

    await act(async () => {
      await useNotificationStore.getState().initialize('user-1');
    });

    const state = useNotificationStore.getState();
    expect(state.isPermissionDenied).toBe(true);
    expect(state.effectiveEnabled).toBe(false);
  });

  it('marks isInitialized=true even if services throw', async () => {
    mockGetNotificationPermissionStatus.mockRejectedValueOnce(new Error('fail'));

    await act(async () => {
      await useNotificationStore.getState().initialize('user-1');
    });

    expect(useNotificationStore.getState().isInitialized).toBe(true);
  });
});

// ── toggle — disable path ─────────────────────────────────────────────────────

describe('toggle (disable)', () => {
  beforeEach(() => {
    // Start from enabled state
    useNotificationStore.setState({
      systemPermission: 'granted',
      userPreference: 'enabled',
      tokenStatus: 'registered',
      effectiveEnabled: true,
      isPermissionDenied: false,
      isToggling: false,
      isInitialized: true,
    });
  });

  it('sets userPreference=disabled and deactivates tokens', async () => {
    await act(async () => {
      await useNotificationStore.getState().toggle('user-1');
    });

    expect(mockDeactivateTokens).toHaveBeenCalledWith('user-1');
    expect(mockSetPersistedPreference).toHaveBeenCalledWith('disabled');

    const state = useNotificationStore.getState();
    expect(state.userPreference).toBe('disabled');
    expect(state.tokenStatus).toBe('inactive');
    expect(state.effectiveEnabled).toBe(false);
    expect(state.isToggling).toBe(false);
  });

  it('rolls back and shows alert when deactivateTokens fails', async () => {
    mockDeactivateTokens.mockRejectedValueOnce(new Error('network error'));

    await act(async () => {
      await useNotificationStore.getState().toggle('user-1');
    });

    const state = useNotificationStore.getState();
    // State must be rolled back to the snapshot (enabled)
    expect(state.userPreference).toBe('enabled');
    expect(state.effectiveEnabled).toBe(true);
    expect(state.isToggling).toBe(false);
    expect(Alert.alert).toHaveBeenCalledWith(
      'Something Went Wrong',
      expect.any(String),
      expect.any(Array)
    );
  });
});

// ── toggle — enable path ──────────────────────────────────────────────────────

describe('toggle (enable)', () => {
  beforeEach(() => {
    // Start from disabled state
    useNotificationStore.setState({
      systemPermission: 'granted',
      userPreference: 'disabled',
      tokenStatus: 'inactive',
      effectiveEnabled: false,
      isPermissionDenied: false,
      isToggling: false,
      isInitialized: true,
    });
  });

  it('registers token, persists preference, sets effectiveEnabled=true', async () => {
    mockGetNotificationPermissionStatus.mockResolvedValueOnce('granted');
    mockRegisterAndUpsertToken.mockResolvedValueOnce('ExponentPushToken[xyz]');

    await act(async () => {
      await useNotificationStore.getState().toggle('user-1');
    });

    expect(mockRegisterAndUpsertToken).toHaveBeenCalledWith('user-1');
    expect(mockSetPersistedPreference).toHaveBeenCalledWith('enabled');

    const state = useNotificationStore.getState();
    expect(state.userPreference).toBe('enabled');
    expect(state.tokenStatus).toBe('registered');
    expect(state.effectiveEnabled).toBe(true);
    expect(state.isToggling).toBe(false);
  });

  it('shows permission-denied UI when OS permission is denied', async () => {
    mockGetNotificationPermissionStatus.mockResolvedValueOnce('denied');

    await act(async () => {
      await useNotificationStore.getState().toggle('user-1');
    });

    const state = useNotificationStore.getState();
    expect(state.isPermissionDenied).toBe(true);
    expect(state.effectiveEnabled).toBe(false);
    expect(state.isToggling).toBe(false);
    expect(mockRegisterAndUpsertToken).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      'Notifications Blocked',
      expect.any(String),
      expect.any(Array)
    );
  });

  it('requests permission when undetermined, then proceeds', async () => {
    mockGetNotificationPermissionStatus.mockResolvedValueOnce('undetermined');
    mockRequestNotificationPermission.mockResolvedValueOnce('granted');

    await act(async () => {
      await useNotificationStore.getState().toggle('user-1');
    });

    expect(mockRequestNotificationPermission).toHaveBeenCalled();
    expect(mockRegisterAndUpsertToken).toHaveBeenCalled();
    expect(useNotificationStore.getState().effectiveEnabled).toBe(true);
  });

  it('rolls back and shows alert when registerAndUpsertToken fails', async () => {
    mockGetNotificationPermissionStatus.mockResolvedValueOnce('granted');
    mockRegisterAndUpsertToken.mockResolvedValueOnce(null); // token acquisition failed

    await act(async () => {
      await useNotificationStore.getState().toggle('user-1');
    });

    const state = useNotificationStore.getState();
    expect(state.userPreference).toBe('disabled');
    expect(state.effectiveEnabled).toBe(false);
    expect(state.isToggling).toBe(false);
    expect(Alert.alert).toHaveBeenCalled();
  });
});

// ── toggle — rapid-toggle mutex ───────────────────────────────────────────────

describe('toggle (mutex)', () => {
  beforeEach(() => {
    useNotificationStore.setState({
      systemPermission: 'granted',
      userPreference: 'disabled',
      tokenStatus: 'inactive',
      effectiveEnabled: false,
      isPermissionDenied: false,
      isToggling: false,
      isInitialized: true,
    });
  });

  it('ignores a second call while the first is still in flight', async () => {
    // Make the first call slow
    let resolveToggle!: () => void;
    mockGetNotificationPermissionStatus.mockReturnValueOnce(
      new Promise((res) => { resolveToggle = () => res('granted'); })
    );

    const firstToggle = useNotificationStore.getState().toggle('user-1');
    // Immediately call toggle again — should be rejected by mutex
    await act(async () => {
      await useNotificationStore.getState().toggle('user-1');
    });

    // registerAndUpsertToken should NOT have been called yet (first toggle is still pending)
    expect(mockRegisterAndUpsertToken).not.toHaveBeenCalled();

    // Now resolve the first toggle
    resolveToggle();
    await act(async () => { await firstToggle; });

    // Only called once total
    expect(mockRegisterAndUpsertToken).toHaveBeenCalledTimes(1);
  });
});

// ── refreshPermissions ────────────────────────────────────────────────────────

describe('refreshPermissions', () => {
  it('updates systemPermission when called', async () => {
    useNotificationStore.setState({
      systemPermission: 'granted',
      userPreference: 'enabled',
      tokenStatus: 'registered',
      effectiveEnabled: true,
      isPermissionDenied: false,
      isToggling: false,
      isInitialized: true,
    });

    mockGetNotificationPermissionStatus.mockResolvedValueOnce('denied');

    await act(async () => {
      await useNotificationStore.getState().refreshPermissions('user-1');
    });

    const state = useNotificationStore.getState();
    expect(state.systemPermission).toBe('denied');
    expect(state.isPermissionDenied).toBe(true);
    expect(state.effectiveEnabled).toBe(false);
    // Should also persist the preference as disabled and deactivate tokens
    expect(mockSetPersistedPreference).toHaveBeenCalledWith('disabled');
  });

  it('clears isPermissionDenied when permission is re-granted', async () => {
    useNotificationStore.setState({
      systemPermission: 'denied',
      userPreference: 'enabled',
      tokenStatus: 'registered',
      effectiveEnabled: false,
      isPermissionDenied: true,
      isToggling: false,
      isInitialized: true,
    });

    mockGetNotificationPermissionStatus.mockResolvedValueOnce('granted');

    await act(async () => {
      await useNotificationStore.getState().refreshPermissions('user-1');
    });

    const state = useNotificationStore.getState();
    expect(state.isPermissionDenied).toBe(false);
    // effectiveEnabled = granted + enabled + registered = true
    expect(state.effectiveEnabled).toBe(true);
  });
});
