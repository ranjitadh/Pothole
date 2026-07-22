import { useColorScheme as useColorSchemeCore } from 'react-native';
import { useThemeStore } from '../store/theme-store';

export const useColorScheme = () => {
  const themeMode = useThemeStore((state) => state.themeMode);
  const systemScheme = useColorSchemeCore();
  
  if (themeMode === 'system') {
    return systemScheme === 'unspecified' || !systemScheme ? 'light' : systemScheme;
  }
  return themeMode;
};
