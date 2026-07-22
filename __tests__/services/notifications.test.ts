import * as Notifications from 'expo-notifications';
import { registerForPushNotificationsAsync, sendTestPushNotification } from '../../services/notifications';

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'token-123' }),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('id-123'),
}));

jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      eas: {
        projectId: 'project-123',
      },
    },
  },
}));

describe('Notifications Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers for push notifications when permission is granted', async () => {
    const token = await registerForPushNotificationsAsync();
    expect(token).toBe('token-123');
    expect(Notifications.getPermissionsAsync).toHaveBeenCalled();
  });

  it('requests permissions when not already granted', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'undetermined' });
    const token = await registerForPushNotificationsAsync();
    expect(token).toBe('token-123');
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
  });

  it('returns null when permission is denied', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'denied' });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'denied' });
    const token = await registerForPushNotificationsAsync();
    expect(token).toBeNull();
  });

  it('schedules a test push notification', async () => {
    const success = await sendTestPushNotification();
    expect(success).toBe(true);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          title: expect.stringContaining('Pothole Watcher'),
        }),
      })
    );
  });
});
