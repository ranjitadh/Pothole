import '../global.css';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import 'react-native-reanimated';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth-store';
import { useOnboardingStore } from '../store/onboarding-store';
import { useNotificationStore } from '../store/notification-store';
import Constants from 'expo-constants';
import { LogBox } from 'react-native';
import { AnimatedSplash } from '../components/AnimatedSplash';

LogBox.ignoreLogs([
  'SafeAreaView has been deprecated',
  'Tried to register two views with the same name',
  "'Splashscreen.setOptions' cannot be used in Expo Go",
  "Can't perform a React state update on a component that hasn't mounted yet",
]);

const queryClient = new QueryClient();

export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

try {
  SplashScreen.preventAutoHideAsync();
  if (Constants.appOwnership !== 'expo') {
    SplashScreen.setOptions({ duration: 800, fade: true });
  }
} catch {}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (fontError) throw fontError;
  }, [fontError]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <RootLayoutNav />
    </QueryClientProvider>
  );
}

type StartupPhase = 'init' | 'ready';

function RootLayoutNav() {
  const segments = useSegments();
  const router = useRouter();
  const { user, isLoading: authLoading, initialize: initAuth } = useAuthStore();
  const { isCompleted: onboardingDone, isLoading: onboardingLoading, initialize: initOnboarding } = useOnboardingStore();
  const [phase, setPhase] = useState<StartupPhase>('init');
  const initRan = useRef(false);

  const initializeNotifications = useNotificationStore((s) => s.initialize);

  useEffect(() => {
    if (initRan.current) return;
    initRan.current = true;
    Promise.all([initAuth(), initOnboarding()]);
  }, []);

  useEffect(() => {
    if (user?.id) {
      initializeNotifications(user.id);
    }
  }, [user?.id]);

  const handleSplashFinish = () => {
    setPhase('ready');
    try {
      SplashScreen.hideAsync();
    } catch {}
  };

  const ready = phase === 'ready' && !authLoading && !onboardingLoading;

  useEffect(() => {
    if (!ready) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (user) {
      if (inAuthGroup) {
        router.replace('/(tabs)');
      }
    } else {
      if (onboardingDone) {
        if (!inAuthGroup || segments[1] === 'onboarding') {
          router.replace('/(auth)/login');
        }
      } else {
        if (!inAuthGroup || (segments[1] !== 'onboarding')) {
          router.replace('/(auth)/onboarding');
        }
      }
    }
  }, [user, ready, onboardingDone, segments]);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
      </Stack>
      {phase === 'init' && (
        <AnimatedSplash onFinish={handleSplashFinish} />
      )}
    </>
  );
}
