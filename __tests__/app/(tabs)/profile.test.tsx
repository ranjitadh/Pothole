import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import ProfileScreen from '../../../app/(tabs)/profile';
import { Alert } from 'react-native';

const mockSignOut = jest.fn().mockResolvedValue(undefined);
const mockRefreshProfile = jest.fn().mockResolvedValue(undefined);

const mockProfile = {
  id: 'user-1',
  username: 'ranjit',
  displayName: 'Ranjit Adhikari',
  bio: 'Pothole reporter',
  avatarUrl: 'https://example.com/avatar.jpg',
  coverUrl: 'https://example.com/cover.jpg',
  followersCount: 10,
  followingCount: 5,
  postsCount: 3,
  createdAt: '2024-01-01',
};

jest.mock('../../../store/auth-store', () => ({
  useAuthStore: () => ({
    user: { id: 'user-1', email: 'test@example.com' },
    profile: mockProfile,
    signOut: mockSignOut,
    refreshProfile: mockRefreshProfile,
  }),
}));

const mockSetThemeMode = jest.fn();
jest.mock('../../../store/theme-store', () => ({
  useThemeStore: () => ({
    themeMode: 'system',
    setThemeMode: mockSetThemeMode,
  }),
}));

const mockToggleNotif = jest.fn();
jest.mock('../../../store/notification-store', () => ({
  useNotificationStore: () => ({
    effectiveEnabled: true,
    isToggling: false,
    isPermissionDenied: false,
    toggle: mockToggleNotif,
    refreshPermissions: jest.fn(),
  }),
}));

const mockUpdate = jest.fn().mockReturnValue({
  eq: jest.fn().mockResolvedValue({ error: null }),
});

jest.mock('../../../services/supabase', () => ({
  supabase: {
    from: jest.fn().mockReturnValue({
      update: (...args: any[]) => mockUpdate(...args),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      rpc: jest.fn().mockResolvedValue({ error: null }),
    }),
    rpc: jest.fn().mockResolvedValue({ error: null }),
    storage: {
      from: jest.fn().mockReturnValue({
        remove: jest.fn().mockResolvedValue({ error: null }),
      }),
    },
    auth: {
      signInWithPassword: jest.fn().mockResolvedValue({ error: null }),
      updateUser: jest.fn().mockResolvedValue({ error: null }),
    },
  },
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'https://example.com/new.jpg' }],
  }),
  MediaTypeOptions: { Images: 'Images' },
}));

jest.mock('../../../services/post', () => ({
  uploadPhoto: jest.fn().mockResolvedValue('https://example.com/uploaded.jpg'),
}));

jest.mock('lucide-react-native', () => new Proxy({}, { get: (_, prop) => prop }));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 20, bottom: 20, left: 0, right: 0 }),
  SafeAreaView: ({ children }: any) => children,
}));

describe('Profile Screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders profile details correctly', () => {
    const { getByText } = render(<ProfileScreen />);

    expect(getByText('Ranjit Adhikari')).toBeTruthy();
    expect(getByText('@ranjit')).toBeTruthy();
    expect(getByText('Pothole reporter')).toBeTruthy();
    expect(getByText('10')).toBeTruthy();
    expect(getByText('5')).toBeTruthy();
    expect(getByText('3')).toBeTruthy();
  });

  it('handles avatar and cover image picker update', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByTestId, getByText } = render(<ProfileScreen />);

    fireEvent.press(getByTestId('profile-menu-button'));

    await act(async () => {
      fireEvent.press(getByText('Edit Profile Photo'));
    });

    expect(mockRefreshProfile).toHaveBeenCalled();

    fireEvent.press(getByTestId('profile-menu-button'));

    await act(async () => {
      fireEvent.press(getByText('Edit Cover Photo'));
    });

    expect(mockRefreshProfile).toHaveBeenCalledTimes(2);
    alertSpy.mockRestore();
  });

  it('handles updating display name via modal', async () => {
    const { getByTestId, getByPlaceholderText, getByText } = render(<ProfileScreen />);

    fireEvent.press(getByTestId('edit-name-button'));
    const input = getByPlaceholderText('Enter display name...');
    fireEvent.changeText(input, 'New Ranjit');

    await act(async () => {
      fireEvent.press(getByText('Save'));
    });

    expect(mockRefreshProfile).toHaveBeenCalled();
  });

  it('handles sign out confirmation', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((title, msg, buttons) => {
      const confirm = buttons?.find((b: any) => b.style === 'destructive');
      if (confirm && confirm.onPress) {
        confirm.onPress();
      }
    });

    const { getByText } = render(<ProfileScreen />);

    await act(async () => {
      fireEvent.press(getByText('Sign Out'));
    });

    expect(mockSignOut).toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('handles delete account confirmation', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByText } = render(<ProfileScreen />);

    await act(async () => {
      fireEvent.press(getByText('Delete Account'));
    });

    expect(alertSpy).toHaveBeenCalledWith('Delete Account', expect.any(String), expect.any(Array));
    alertSpy.mockRestore();
  });
});
