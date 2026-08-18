import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_KEY = '@pothole/onboarding_completed_v1';

interface OnboardingState {
  isCompleted: boolean;
  isLoading: boolean;
  initialize: () => Promise<void>;
  complete: () => Promise<void>;
  reset: () => Promise<void>;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  isCompleted: false,
  isLoading: true,

  initialize: async () => {
    try {
      const value = await AsyncStorage.getItem(ONBOARDING_KEY);
      set({ isCompleted: value === 'true', isLoading: false });
    } catch {
      set({ isCompleted: false, isLoading: false });
    }
  },

  complete: async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
      set({ isCompleted: true });
    } catch {
      set({ isCompleted: true });
    }
  },

  reset: async () => {
    try {
      await AsyncStorage.removeItem(ONBOARDING_KEY);
      set({ isCompleted: false });
    } catch {
      set({ isCompleted: false });
    }
  },
}));
