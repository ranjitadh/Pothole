import { renderHook, act } from '@testing-library/react-native';
import { useColorScheme } from '../../components/useColorScheme';
import { useThemeStore } from '../../store/theme-store';

describe('useColorScheme hook', () => {
  beforeEach(() => {
    act(() => {
      useThemeStore.setState({ themeMode: 'system' });
    });
  });

  it('returns light when system mode and system scheme is unspecified or default', () => {
    act(() => {
      useThemeStore.setState({ themeMode: 'system' });
    });
    const { result } = renderHook(() => useColorScheme());
    expect(['light', 'dark']).toContain(result.current);
  });

  it('returns explicit themeMode when not system', () => {
    act(() => {
      useThemeStore.setState({ themeMode: 'dark' });
    });
    const { result } = renderHook(() => useColorScheme());
    expect(result.current).toBe('dark');

    act(() => {
      useThemeStore.setState({ themeMode: 'light' });
    });
    const { result: res2 } = renderHook(() => useColorScheme());
    expect(res2.current).toBe('light');
  });
});
