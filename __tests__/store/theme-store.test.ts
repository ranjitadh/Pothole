import { useThemeStore } from '../../store/theme-store';

describe('Theme Store', () => {
  beforeEach(() => {
    useThemeStore.setState({ themeMode: 'system' });
  });

  it('defaults to system themeMode', () => {
    expect(useThemeStore.getState().themeMode).toBe('system');
  });

  it('updates themeMode to light or dark', () => {
    const { setThemeMode } = useThemeStore.getState();

    setThemeMode('dark');
    expect(useThemeStore.getState().themeMode).toBe('dark');

    setThemeMode('light');
    expect(useThemeStore.getState().themeMode).toBe('light');

    setThemeMode('system');
    expect(useThemeStore.getState().themeMode).toBe('system');
  });
});
