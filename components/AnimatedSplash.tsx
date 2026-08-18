import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, StyleSheet, Text, View } from 'react-native';
import { useColorScheme } from './useColorScheme';

const SPLASH_LOGO = require('../assets/images/splash-icon.png');

const BRAND = '#ea580c';

const REDUCED_MOTION = Platform.OS === 'android'
  ? false
  : false;

interface AnimatedSplashProps {
  onFinish: () => void;
}

export function AnimatedSplash({ onFinish }: AnimatedSplashProps) {
  const isDark = useColorScheme() === 'dark';

  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.85)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleY = useRef(new Animated.Value(12)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const containerOpacity = useRef(new Animated.Value(1)).current;

  const bg = isDark ? '#0f172a' : '#ffffff';
  const textPrimary = isDark ? '#f8fafc' : '#0f172a';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';

  const [animationDone, setAnimationDone] = useState(false);

  useEffect(() => {
    const entrance = Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(100),
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 350,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(titleY, {
          toValue: 0,
          duration: 350,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(80),
      Animated.timing(subtitleOpacity, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    const hold = Animated.delay(400);

    const exit = Animated.timing(containerOpacity, {
      toValue: 0,
      duration: 250,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    });

    const full = Animated.sequence([entrance, hold, exit]);
    full.start(() => {
      setAnimationDone(true);
      onFinish();
    });

    return () => full.stop();
  }, []);

  return (
    <Animated.View
      style={[styles.container, { backgroundColor: bg, opacity: containerOpacity }]}
      pointerEvents="auto"
    >
      <View style={styles.center}>
        <Animated.View
          style={[
            styles.logoWrap,
            {
              opacity: logoOpacity,
              transform: [{ scale: logoScale }],
            },
          ]}
        >
          <Image source={SPLASH_LOGO} style={styles.logo} resizeMode="contain" />
        </Animated.View>

        <Animated.Text
          style={[
            styles.title,
            {
              color: textPrimary,
              opacity: titleOpacity,
              transform: [{ translateY: titleY }],
            },
          ]}
        >
          Pothole
        </Animated.Text>

        <Animated.Text
          style={[
            styles.subtitle,
            { color: textSecondary, opacity: subtitleOpacity },
          ]}
        >
          Report and track local road hazards
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    zIndex: 9999,
    elevation: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  center: {
    alignItems: 'center',
    gap: 14,
  },
  logoWrap: {
    width: 88,
    height: 88,
    borderRadius: 22,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: BRAND,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    letterSpacing: 0.1,
    marginTop: 2,
  },
});
