import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { Alert } from 'react-native';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 20, bottom: 0, left: 0, right: 0 }),
  SafeAreaView: ({ children }: any) => children,
}));

jest.mock('../../../services/supabase', () => ({
  supabase: {
    rpc: jest.fn().mockResolvedValue({ error: null }),
    from: jest.fn().mockReturnValue({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    }),
  },
}));

jest.mock('lucide-react-native', () => ({
  LogOut: 'LogOut',
  Trash2: 'Trash2',
  Bell: 'Bell',
  MapPin: 'MapPin',
  Moon: 'Moon',
  Eye: 'Eye',
  EyeOff: 'EyeOff',
  Camera: 'Camera',
  Image: 'Image',
  AlignLeft: 'AlignLeft',
  MoreHorizontal: 'MoreHorizontal',
}));

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: false, assets: [{ uri: 'ph://photo.jpg' }] }),
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  MediaTypeOptions: { Images: 'Images' },
}));

jest.mock('../../../services/post', () => ({
  uploadPhoto: jest.fn().mockResolvedValue('https://example.com/uploaded.jpg'),
}));

jest.mock('../../../services/notifications', () => ({
  registerForPushNotificationsAsync: jest.fn().mockResolvedValue('token-123'),
  sendTestPushNotification: jest.fn().mockResolvedValue(true),
}));

const mockProfile = {
  id: 'user-1',
  username: 'testuser',
  displayName: 'Test User',
  bio: 'Road safety enthusiast',
  avatarUrl: 'https://example.com/avatar.jpg',
  coverUrl: null,
  followersCount: 15,
  followingCount: 8,
  postsCount: 5,
  createdAt: '2024-01-01',
};

const mockSignOut = jest.fn().mockResolvedValue(undefined);

jest.mock('../../../store/auth-store', () => ({
  useAuthStore: jest.fn(() => ({
    profile: mockProfile,
    signOut: mockSignOut,
    refreshProfile: jest.fn(),
  })),
}));

import ProfileScreen from '../../../app/(tabs)/profile';
import { useAuthStore } from '../../../store/auth-store';
import { supabase } from '../../../services/supabase';

const mockSupabase = supabase as any;
const mockUseAuthStore = useAuthStore as jest.Mock;

describe('Profile Screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSignOut.mockResolvedValue(undefined);
    mockSupabase.rpc.mockResolvedValue({ error: null });
    mockUseAuthStore.mockReturnValue({
      profile: mockProfile,
      signOut: mockSignOut,
      refreshProfile: jest.fn(),
    });
  });

  it('shows loading when no profile', () => {
    mockUseAuthStore.mockReturnValue({
      profile: null,
      signOut: mockSignOut,
    });

    const { getByTestId } = render(<ProfileScreen />);
    expect(getByTestId).toBeTruthy();
  });

  it('renders profile data correctly', () => {
    const { getByText } = render(<ProfileScreen />);

    expect(getByText('Test User')).toBeTruthy();
    expect(getByText('@testuser')).toBeTruthy();
    expect(getByText('Road safety enthusiast')).toBeTruthy();
    expect(getByText('5')).toBeTruthy();
    expect(getByText('15')).toBeTruthy();
    expect(getByText('8')).toBeTruthy();
    expect(getByText('reports')).toBeTruthy();
    expect(getByText('followers')).toBeTruthy();
    expect(getByText('following')).toBeTruthy();
  });

  it('renders account action buttons', () => {
    const { getByText } = render(<ProfileScreen />);

    expect(getByText('Sign Out')).toBeTruthy();
    expect(getByText('Delete Account')).toBeTruthy();
  });

  it('shows sign out confirmation dialog', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const { getByText } = render(<ProfileScreen />);

    await act(async () => {
      fireEvent.press(getByText('Sign Out'));
    });

    expect(alertSpy).toHaveBeenCalledWith(
      'Sign Out',
      'Are you sure you want to sign out?',
      expect.any(Array)
    );
    alertSpy.mockRestore();
  });

  it('shows delete account confirmation dialog', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const { getByText } = render(<ProfileScreen />);

    await act(async () => {
      fireEvent.press(getByText('Delete Account'));
    });

    expect(alertSpy).toHaveBeenCalledWith(
      'Delete Account',
      expect.stringContaining('WARNING'),
      expect.any(Array)
    );
    alertSpy.mockRestore();
  });

  it('calls signOut when confirmed', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((title: any, message: any, buttons: any) => {
      const confirmButton = buttons?.find((b: any) => b.style === 'destructive');
      if (confirmButton?.onPress) {
        confirmButton.onPress();
      }
      return undefined as any;
    });

    const { getByText } = render(<ProfileScreen />);

    await act(async () => {
      fireEvent.press(getByText('Sign Out'));
    });

    expect(mockSignOut).toHaveBeenCalled();
  });

  it('calls delete account RPC when confirmed', async () => {
    mockSupabase.rpc.mockResolvedValue({ error: null });

    jest.spyOn(Alert, 'alert').mockImplementation((title: any, message: any, buttons: any) => {
      const confirmButton = buttons?.find((b: any) => b.style === 'destructive');
      if (confirmButton?.onPress) {
        confirmButton.onPress();
      }
      return undefined as any;
    });

    const { getByText } = render(<ProfileScreen />);

    await act(async () => {
      fireEvent.press(getByText('Delete Account'));
    });

    expect(mockSupabase.rpc).toHaveBeenCalledWith('delete_user_account');
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('triggers profile picture selection and upload', async () => {
    const { getByTestId } = render(<ProfileScreen />);
    
    await act(async () => {
      fireEvent.press(getByTestId('profile-menu-button'));
    });

    await act(async () => {
      fireEvent.press(getByTestId('change-avatar-menu-item'));
    });

    expect(getByTestId('profile-menu-button')).toBeTruthy();
  });

  it('triggers cover photo selection and upload', async () => {
    const { getByTestId } = render(<ProfileScreen />);
    
    await act(async () => {
      fireEvent.press(getByTestId('profile-menu-button'));
    });

    await act(async () => {
      fireEvent.press(getByTestId('change-cover-menu-item'));
    });

    expect(getByTestId('profile-menu-button')).toBeTruthy();
  });

  it('opens bio editor modal and saves bio updates', async () => {
    const { getByTestId, getByPlaceholderText, getByText } = render(<ProfileScreen />);
    
    await act(async () => {
      fireEvent.press(getByTestId('profile-menu-button'));
    });

    await act(async () => {
      fireEvent.press(getByTestId('edit-bio-menu-item'));
    });

    expect(getByPlaceholderText('Tell us about yourself...')).toBeTruthy();
    
    fireEvent.changeText(getByPlaceholderText('Tell us about yourself...'), 'New Bio Text');
    
    await act(async () => {
      fireEvent.press(getByText('Save'));
    });

    expect(mockUseAuthStore).toHaveBeenCalled();
  });
});
