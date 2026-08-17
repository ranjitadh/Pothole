/**
 * app.config.ts
 *
 * Dynamic Expo configuration.
 * Replaces app.json so environment variables (injected by EAS at build time)
 * can drive the Google Maps API key and other runtime values.
 *
 * Environment variables used:
 *   EXPO_PUBLIC_GOOGLE_MAPS_API_KEY — Android/iOS Maps key (required in prod)
 *   EXPO_PUBLIC_SUPABASE_URL        — Supabase project URL
 *   EXPO_PUBLIC_SUPABASE_ANON_KEY  — Supabase anon key
 *   EXPO_PUBLIC_APP_URL             — Web app URL
 */

import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const mapsApiKey =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ??
    'AIzaSyCpWyUEinrDXj7mZmC_9EOrS8MIcQwyN5E'; // fallback for local dev

  return {
    ...config,
    name: 'Pothole',
    slug: 'PotholeReactNative',
    version: '5.4.0',
    orientation: 'default',
    icon: './assets/images/icon.png',
    scheme: 'pothole',
    userInterfaceStyle: 'automatic',

    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.pothole.app',
      config: {
        googleMapsApiKey: mapsApiKey,
      },
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          'We need your location to report potholes near you.',
        NSCameraUsageDescription:
          'We need camera access to take photos of potholes.',
        NSPhotoLibraryUsageDescription:
          'We need photo library access to attach pothole images.',
      },
    },

    android: {
      package: 'com.pothole.app',
      versionCode: 3,
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      // Explicit Android permission list.
      // ACCESS_BACKGROUND_LOCATION intentionally omitted — app only needs
      // foreground location for pothole reporting.
      permissions: [
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.CAMERA',
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
        'android.permission.INTERNET',
        'android.permission.VIBRATE',
        'android.permission.RECEIVE_BOOT_COMPLETED',
      ],
      predictiveBackGestureEnabled: false,
      config: {
        googleMaps: {
          // Key is injected from EXPO_PUBLIC_GOOGLE_MAPS_API_KEY at EAS build time.
          // In Google Cloud Console this key must have:
          //   - Maps SDK for Android ✅ enabled
          //   - Geocoding API ✅ enabled
          //   - Android app restriction: package=com.pothole.app,
          //     SHA-1=<Play Store upload cert from Play Console → App integrity>
          apiKey: mapsApiKey,
        },
      },
    },

    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/images/favicon.png',
    },

    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          image: './assets/images/splash-icon.png',
          resizeMode: 'contain',
          backgroundColor: '#ffffff',
          imageWidth: 200,
        },
      ],
      'expo-secure-store',
      [
        'expo-location',
        {
          // Android strings for the runtime permission dialog.
          locationAlwaysAndWhenInUsePermission:
            'Allow Pothole to use your location to report nearby potholes.',
          locationWhenInUsePermission:
            'Allow Pothole to use your location to report nearby potholes.',
        },
      ],
      [
        'expo-notifications',
        {
          icon: './assets/images/android-icon-monochrome.png',
          color: '#ea580c',
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission:
            'Allow Pothole to access your photos to attach pothole images.',
          cameraPermission:
            'Allow Pothole to use the camera to take photos of potholes.',
        },
      ],
      [
        'react-native-maps',
        {
          locationAlwaysAndWhenInUsePermission:
            'Allow Pothole to show your location on the map.',
          androidGoogleMapsApiKey: mapsApiKey,
        },
      ],
      'expo-web-browser',
      [
        'expo-build-properties',
        {
          android: {
            ndkVersion: '26.1.10909125',
          },
        },
      ],
    ],

    experiments: {
      typedRoutes: true,
    },

    extra: {
      eas: {
        projectId: 'f4579e84-439d-4b0a-b4c2-4c9e6068ac62',
      },
      router: {},
    },

    runtimeVersion: {
      policy: 'appVersion',
    },

    updates: {
      url: 'https://u.expo.dev/f4579e84-439d-4b0a-b4c2-4c9e6068ac62',
      fallbackToCacheTimeout: 30000,
      checkAutomatically: 'ON_LOAD',
    },

    owner: 'ranjitadh',
  };
};
