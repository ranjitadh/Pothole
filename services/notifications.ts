import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Configure how notifications are handled when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'web') return null;
  
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      return null;
    }

    // Try to get push token, fall back gracefully if easel config is not set up
    let projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId && Constants.easConfig?.projectId) {
      projectId = Constants.easConfig.projectId;
    }

    const token = await Notifications.getExpoPushTokenAsync({
      projectId: projectId || undefined,
    });

    return token.data;
  } catch (error) {
    console.warn('Error registering for push notifications:', error);
    return null;
  }
}

export async function sendTestPushNotification() {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Pothole Watcher Alert! 🚨",
        body: "Push notifications are successfully configured and working!",
        data: { test: true },
      },
      trigger: null, // trigger immediately
    });
    return true;
  } catch (error) {
    console.warn('Error scheduling local notification:', error);
    return false;
  }
}
