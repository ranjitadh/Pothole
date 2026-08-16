import React from 'react';
import { Alert } from 'react-native';
import { render, waitFor, fireEvent, act } from '@testing-library/react-native';
import OtherUserProfileScreen from '../../../app/profile/[username]';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../services/supabase';
import { useAuthStore } from '../../../store/auth-store';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('lucide-react-native', () => new Proxy({}, { get: (_, prop) => prop }));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 10, bottom: 10, left: 0, right: 0 }),
  SafeAreaView: ({ children }: any) => children,
}));

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(),
  useRouter: jest.fn(),
}));

jest.mock('../../../services/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
    },
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn(),
  },
}));

describe('OtherUserProfileScreen', () => {
  let queryClient: QueryClient;
  const mockBack = jest.fn();
  const mockSupabase = supabase as any;

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ back: mockBack });
    (useLocalSearchParams as jest.Mock).mockReturnValue({ username: 'jane_doe' });

    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    useAuthStore.setState({
      user: { id: 'user-1' } as any,
    });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: {
                  id: 'u2',
                  username: 'jane_doe',
                  display_name: 'Jane Doe',
                  bio: 'Avid road reviewer',
                  avatar_url: null,
                  cover_url: null,
                  followers_count: 10,
                  following_count: 5,
                  posts_count: 3,
                  created_at: '2024-01-01',
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'follows') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
          insert: jest.fn().mockResolvedValue({ error: null }),
          delete: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: null }),
            }),
          }),
        };
      }
      if (table === 'blocks') {
        return {
          insert: jest.fn().mockResolvedValue({ error: null }),
        };
      }
      if (table === 'posts') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: [
                  {
                    id: 'p1',
                    user_id: 'u2',
                    text: 'Pothole on 5th Ave',
                    visibility: 'public',
                    likes_count: 2,
                    comments_count: 1,
                    shares_count: 0,
                    is_edited: false,
                    created_at: '2024-01-01',
                    status: 'unresolved',
                    author: { id: 'u2', username: 'jane_doe', display_name: 'Jane Doe', avatar_url: null },
                    media: [{ id: 'm1', url: 'https://example.com/img.jpg', type: 'image' }],
                    location: null,
                  },
                ],
                error: null,
              }),
            }),
          }),
        };
      }
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      };
    });
  });

  const renderScreen = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <OtherUserProfileScreen />
      </QueryClientProvider>
    );
  };

  it('loads and displays user profile and posts', async () => {
    const { getAllByText, getByText } = renderScreen();

    await waitFor(() => {
      expect(getAllByText('Jane Doe').length).toBeGreaterThan(0);
      expect(getAllByText('@jane_doe').length).toBeGreaterThan(0);
      expect(getByText('Avid road reviewer')).toBeTruthy();
      expect(getByText('Pothole on 5th Ave')).toBeTruthy();
    });
  });

  it('handles missing user profile gracefully', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });

    renderScreen();

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Error', 'User profile not found.');
      expect(mockBack).toHaveBeenCalled();
    });
    alertSpy.mockRestore();
  });

  it('handles follow button toggle and block user flow', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((title, msg, buttons) => {
      const confirm = buttons?.find((b: any) => b.style === 'destructive');
      if (confirm && confirm.onPress) {
        confirm.onPress();
      }
    });

    const { getByText, UNSAFE_getByType } = renderScreen();

    await waitFor(() => {
      expect(getByText('Follow')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByText('Follow'));
    });

    const { ShieldAlert, ArrowLeft } = require('lucide-react-native');
    const blockBtn = UNSAFE_getByType(ShieldAlert);
    await act(async () => {
      fireEvent.press(blockBtn);
    });

    expect(alertSpy).toHaveBeenCalledWith(
      'Block User',
      expect.stringContaining('@jane_doe'),
      expect.any(Array)
    );

    const backBtn = UNSAFE_getByType(ArrowLeft);
    fireEvent.press(backBtn);
    expect(mockBack).toHaveBeenCalled();

    alertSpy.mockRestore();
  });
});
