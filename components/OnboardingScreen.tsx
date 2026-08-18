import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from './useColorScheme';
import { useOnboardingStore } from '../store/onboarding-store';
import Svg, { Circle, Defs, Ellipse, G, Line, Path, Polygon, Polyline, Rect } from 'react-native-svg';
import { useRouter } from 'expo-router';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const BRAND = '#ea580c';
const BRAND_LIGHT = '#fff7ed';
const BRAND_DARK_BG = '#1a0a02';

type PageItem = {
  id: string;
  heading: string;
  description: string;
  illustration: React.FC<{ size: number; isDark: boolean }>;
};

const PAGES: PageItem[] = [
  {
    id: 'report',
    heading: 'Report Road Damage',
    description:
      'Quickly report potholes and damaged roads to help make every journey safer.',
    illustration: ReportIllustration,
  },
  {
    id: 'pin',
    heading: 'Pin the Exact Location',
    description:
      'Use GPS and the interactive map to mark exactly where the road problem is located.',
    illustration: PinIllustration,
  },
  {
    id: 'community',
    heading: 'Improve Your Community',
    description:
      'Track reports, support other road users, and help your community create safer streets.',
    illustration: CommunityIllustration,
  },
];

function ReportIllustration({ size, isDark }: { size: number; isDark: boolean }) {
  const s = size;
  const bg = isDark ? '#2d1608' : BRAND_LIGHT;
  const road = isDark ? '#4a3228' : '#d4a574';
  const crack = isDark ? '#1a0a02' : '#8b5e3c';
  const pin = BRAND;

  return (
    <Svg width={s} height={s} viewBox="0 0 200 200">
      <Rect x="0" y="0" width="200" height="200" rx="20" fill={bg} />
      <Rect x="40" y="70" width="120" height="80" rx="6" fill={road} />
      <Path d="M55 90 L75 105 L65 110 L85 125 L55 125 Z" fill={crack} opacity="0.7" />
      <Path d="M110 85 L130 95 L120 100 L140 115 L110 115 Z" fill={crack} opacity="0.5" />
      <Line x1="40" y1="110" x2="160" y2="110" stroke={crack} strokeWidth="1" opacity="0.3" />
      <G transform="translate(100, 38)">
        <Path d="M0,-22 C12.1,-22 22,-12.1 22,0 C22,16.5 0,38 0,38 C0,38 -22,16.5 -22,0 C-22,-12.1 -12.1,-22 0,-22Z" fill={pin} />
        <Circle cx="0" cy="0" r="8" fill="white" />
      </G>
    </Svg>
  );
}

function PinIllustration({ size, isDark }: { size: number; isDark: boolean }) {
  const s = size;
  const bg = isDark ? '#0a1628' : '#eff6ff';
  const mapBg = isDark ? '#1e3a5f' : '#bfdbfe';
  const road1 = isDark ? '#2d4a6f' : '#93c5fd';
  const road2 = isDark ? '#3b5a7f' : '#60a5fa';
  const marker = BRAND;
  const ring1 = isDark ? 'rgba(234,88,12,0.15)' : 'rgba(234,88,12,0.1)';
  const ring2 = isDark ? 'rgba(234,88,12,0.08)' : 'rgba(234,88,12,0.05)';

  return (
    <Svg width={s} height={s} viewBox="0 0 200 200">
      <Rect x="0" y="0" width="200" height="200" rx="20" fill={bg} />
      <Rect x="30" y="30" width="140" height="140" rx="12" fill={mapBg} opacity="0.6" />
      <Line x1="30" y1="80" x2="170" y2="80" stroke={road1} strokeWidth="2" />
      <Line x1="30" y1="120" x2="170" y2="120" stroke={road1} strokeWidth="2" />
      <Line x1="80" y1="30" x2="80" y2="170" stroke={road2} strokeWidth="2" />
      <Line x1="120" y1="30" x2="120" y2="170" stroke={road2} strokeWidth="2" />
      <Circle cx="100" cy="100" r="40" fill={ring2} />
      <Circle cx="100" cy="100" r="25" fill={ring1} />
      <G transform="translate(100, 78)">
        <Path d="M0,-20 C11,-20 20,-11 20,0 C20,14 0,32 0,32 C0,32 -20,14 -20,0 C-20,-11 -11,-20 0,-20Z" fill={marker} />
        <Circle cx="0" cy="0" r="7" fill="white" />
      </G>
    </Svg>
  );
}

function CommunityIllustration({ size, isDark }: { size: number; isDark: boolean }) {
  const s = size;
  const bg = isDark ? '#0a1a0a' : '#f0fdf4';
  const road = isDark ? '#2d4a28' : '#86efac';
  const check = '#22c55e';
  const person1 = isDark ? '#60a5fa' : '#3b82f6';
  const person2 = isDark ? '#f472b6' : '#ec4899';
  const person3 = isDark ? '#a78bfa' : '#8b5cf6';

  return (
    <Svg width={s} height={s} viewBox="0 0 200 200">
      <Rect x="0" y="0" width="200" height="200" rx="20" fill={bg} />
      <Rect x="30" y="110" width="140" height="20" rx="4" fill={road} opacity="0.4" />
      <Line x1="30" y1="120" x2="170" y2="120" stroke={road} strokeWidth="2" strokeDasharray="8 6" />
      <Circle cx="70" cy="80" r="14" fill={person1} opacity="0.8" />
      <Rect x="60" y="96" width="20" height="22" rx="4" fill={person1} opacity="0.6" />
      <Circle cx="130" cy="80" r="14" fill={person2} opacity="0.8" />
      <Rect x="120" y="96" width="20" height="22" rx="4" fill={person2} opacity="0.6" />
      <Circle cx="100" cy="60" r="14" fill={person3} opacity="0.8" />
      <Rect x="90" y="76" width="20" height="22" rx="4" fill={person3} opacity="0.6" />
      <G transform="translate(100, 152)">
        <Circle cx="0" cy="0" r="18" fill={check} />
        <Polyline points="-7,0 -2,6 8,-5" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </G>
    </Svg>
  );
}

export function OnboardingScreen() {
  const isDark = useColorScheme() === 'dark';
  const router = useRouter();
  const { complete } = useOnboardingStore();

  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);

  const scrollX = useRef(new Animated.Value(0)).current;

  const bg = isDark ? '#0f172a' : '#ffffff';
  const textPrimary = isDark ? '#f8fafc' : '#0f172a';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';

  const isLastPage = currentIndex === PAGES.length - 1;
  const isAnimating = useRef(false);

  const handleComplete = useCallback(async () => {
    if (isAnimating.current) return;
    isAnimating.current = true;
    setIsNavigating(true);
    try {
      await complete();
      router.replace('/(auth)/login');
    } catch {
      router.replace('/(auth)/login');
    }
  }, [complete, router]);

  const goToPage = useCallback(
    (index: number) => {
      if (isAnimating.current || isNavigating) return;
      flatListRef.current?.scrollToOffset({ offset: index * SCREEN_WIDTH, animated: true });
    },
    [isNavigating],
  );

  useEffect(() => {
    const onBackPress = () => {
      if (currentIndex > 0) {
        goToPage(currentIndex - 1);
        return true;
      }
      return false;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [currentIndex, goToPage]);

  const handleNext = useCallback(() => {
    if (isLastPage) {
      handleComplete();
    } else {
      goToPage(currentIndex + 1);
    }
  }, [currentIndex, isLastPage, handleComplete, goToPage]);

  const handleSkip = useCallback(() => {
    handleComplete();
  }, [handleComplete]);

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const renderItem = useCallback(
    ({ item }: { item: PageItem }) => {
      const Illustration = item.illustration;
      return (
        <View style={[styles.page, { width: SCREEN_WIDTH }]} key={item.id}>
          <View style={styles.illustrationContainer}>
            <Illustration size={200} isDark={isDark} />
          </View>
          <View style={styles.textContainer}>
            <Text style={[styles.heading, { color: textPrimary }]}>{item.heading}</Text>
            <Text style={[styles.description, { color: textSecondary }]}>{item.description}</Text>
          </View>
        </View>
      );
    },
    [isDark, textPrimary, textSecondary],
  );

  const keyExtractor = useCallback((item: PageItem) => item.id, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['top']}>
      <View style={styles.header}>
        {!isLastPage ? (
          <TouchableOpacity
            onPress={handleSkip}
            disabled={isNavigating}
            style={styles.skipButton}
            accessibilityLabel="Skip onboarding"
          >
            <Text style={[styles.skipText, { color: textSecondary }]}>Skip</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.skipButton} />
        )}
      </View>

      <FlatList
        ref={flatListRef}
        data={PAGES}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        bounces={false}
        onScrollBeginDrag={() => {
          isAnimating.current = false;
        }}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
          useNativeDriver: false,
        })}
      />

      <View style={styles.footer}>
        <View style={styles.dotsContainer}>
          {PAGES.map((_, i) => {
            const inputRange = [(i - 1) * SCREEN_WIDTH, i * SCREEN_WIDTH, (i + 1) * SCREEN_WIDTH];
            const dotWidth = scrollX.interpolate({
              inputRange,
              outputRange: [8, 24, 8],
              extrapolate: 'clamp',
            });
            const dotOpacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.3, 1, 0.3],
              extrapolate: 'clamp',
            });
            return (
              <Animated.View
                key={i}
                style={[
                  styles.dot,
                  {
                    width: dotWidth,
                    opacity: dotOpacity,
                    backgroundColor: BRAND,
                  },
                ]}
              />
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.nextButton, { backgroundColor: BRAND }, isNavigating && styles.buttonDisabled]}
          onPress={handleNext}
          disabled={isNavigating}
          accessibilityLabel={isLastPage ? 'Get Started' : 'Next page'}
        >
          <Text style={styles.nextText}>{isLastPage ? 'Get Started' : 'Next'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 8,
    minHeight: 44,
  },
  skipButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '600',
  },
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  illustrationContainer: {
    marginBottom: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    alignItems: 'center',
    gap: 12,
  },
  heading: {
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 8,
  },
  footer: {
    paddingHorizontal: 32,
    paddingBottom: 40,
    alignItems: 'center',
    gap: 24,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  nextButton: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});
