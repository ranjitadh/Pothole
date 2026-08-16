import { Platform } from 'react-native';
import { useNotificationStore } from '../../store/notification-store';
import * as notifService from '../../services/notifications';

jest.mock('../../services/notifications');

describe('Notification Store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as any).OS = 'ios';
    useNotificationStore.setState({
      systemPermission: 'undetermined',
      userPreference: null,
      tokenStatus: 'missing',
      effectiveEnabled: false,
      isToggling: false,
      isInitialized: false,
      isPermissionDenied: false,
    });
  });

  describe('initialize', () => {
    it('handles web platform early return', async () => {
      (Platform as any).OS = 'web';
      await useNotificationStore.getState().initialize('user-1');

      const state = useNotificationStore.getState();
      expect(state.effectiveEnabled).toBe(false);
      expect(state.isInitialized).toBe(true);
    });

    it('hydrates all three dimensions in parallel', async () => {
      (notifService.getNotificationPermissionStatus as jest.Mock).mockResolvedValue('granted');
      (notifService.getPersistedPreference as jest.Mock).mockResolvedValue('enabled');
      (notifService.hasActiveToken as jest.Mock).mockResolvedValue(true);

      await useNotificationStore.getState().initialize('user-1');

      const state = useNotificationStore.getState();
      expect(state.systemPermission).toBe('granted');
      expect(state.userPreference).toBe('enabled');
      expect(['active', 'registered']).toContain(state.tokenStatus);
      expect(state.effectiveEnabled).toBe(true);
      expect(state.isInitialized).toBe(true);
    });

    it('defaults userPreference to enabled when no pref stored', async () => {
      (notifService.getNotificationPermissionStatus as jest.Mock).mockResolvedValue('granted');
      (notifService.getPersistedPreference as jest.Mock).mockResolvedValue(null);
      (notifService.hasActiveToken as jest.Mock).mockResolvedValue(false);

      await useNotificationStore.getState().initialize('user-1');

      const state = useNotificationStore.getState();
      expect(state.userPreference).toBe('enabled');
    });

    it('sets isPermissionDenied when OS permission is denied', async () => {
      (notifService.getNotificationPermissionStatus as jest.Mock).mockResolvedValue('denied');
      (notifService.getPersistedPreference as jest.Mock).mockResolvedValue('enabled');
      (notifService.hasActiveToken as jest.Mock).mockResolvedValue(false);

      await useNotificationStore.getState().initialize('user-1');

      const state = useNotificationStore.getState();
      expect(state.isPermissionDenied).toBe(true);
    });

    it('marks isInitialized=true even if services throw', async () => {
      (notifService.getNotificationPermissionStatus as jest.Mock).mockRejectedValue(new Error('fail'));

      await useNotificationStore.getState().initialize('user-1');

      expect(useNotificationStore.getState().isInitialized).toBe(true);
    });
  });

  describe('toggle', () => {
    it('toggles state successfully', async () => {
      useNotificationStore.setState({
        systemPermission: 'granted',
        userPreference: 'enabled',
        tokenStatus: 'registered',
        effectiveEnabled: true,
      });

      (notifService.setPersistedPreference as jest.Mock).mockResolvedValue(true);
      (notifService.deactivateTokens as jest.Mock).mockResolvedValue(undefined);

      await useNotificationStore.getState().toggle('user-1');

      const state = useNotificationStore.getState();
      expect(state.userPreference).toBe('disabled');
      expect(state.effectiveEnabled).toBe(false);
    });
  });

  describe('refreshPermissions', () => {
    it('updates systemPermission when called', async () => {
      (notifService.getNotificationPermissionStatus as jest.Mock).mockResolvedValue('granted');
      await useNotificationStore.getState().refreshPermissions('user-1');

      expect(useNotificationStore.getState().systemPermission).toBe('granted');
    });

    it('handles refreshPermissions error gracefully', async () => {
      (notifService.getNotificationPermissionStatus as jest.Mock).mockRejectedValue(new Error('refresh err'));
      await useNotificationStore.getState().refreshPermissions('user-1');
      // Does not throw
    });
  });
});
