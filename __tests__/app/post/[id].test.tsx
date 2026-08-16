import React from 'react';
import { Alert, Linking } from 'react-native';
import { render, waitFor, fireEvent, act } from '@testing-library/react-native';
import PostDetailScreen from '../../../app/post/[id]';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as postService from '../../../services/post';
import { useAuthStore } from '../../../store/auth-store';
import { useLocalSearchParams, useRouter } from 'expo-router';

jest.mock('lucide-react-native', () => new Proxy({}, { get: (_, prop) => prop }));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 10, bottom: 10, left: 0, right: 0 }),
  SafeAreaView: ({ children }: any) => children,
}));

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(),
  useRouter: jest.fn(),
}));

jest.mock('../../../services/post');

describe('PostDetailScreen', () => {
  let queryClient: QueryClient;
  const mockBack = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ back: mockBack });
    (useLocalSearchParams as jest.Mock).mockReturnValue({ id: 'p1' });

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    useAuthStore.setState({
      user: { id: 'user-1' } as any,
      profile: { id: 'user-1', username: 'me', displayName: 'My Name' } as any,
    });

    (postService.getPostById as jest.Mock).mockResolvedValue({
      id: 'p1',
      userId: 'user-1',
      text: 'Pothole detail text',
      visibility: 'public',
      likesCount: 5,
      commentsCount: 2,
      sharesCount: 1,
      isEdited: false,
      createdAt: '2024-01-01',
      status: 'unresolved',
      author: { id: 'user-1', username: 'me', displayName: 'My Name', avatarUrl: null },
      media: [{ id: 'm1', url: 'https://example.com/pothole.jpg', type: 'image' }],
      location: { latitude: 27.7172, longitude: 85.3240, placeName: 'Main Road' },
      isLiked: false,
      isSaved: false,
    });

    (postService.getComments as jest.Mock).mockResolvedValue([
      {
        id: 'c1',
        postId: 'p1',
        userId: 'u2',
        text: 'First detail comment',
        isEdited: false,
        createdAt: '2024-01-01',
        parentId: null,
        author: { id: 'u2', username: 'john', displayName: 'John Doe', avatarUrl: null },
      },
    ]);

    (postService.createComment as jest.Mock).mockResolvedValue({ id: 'c2' });
    (postService.deleteComment as jest.Mock).mockResolvedValue(true);
    (postService.likePost as jest.Mock).mockResolvedValue({ liked: true });
    (postService.unlikePost as jest.Mock).mockResolvedValue({ liked: false });
    (postService.repostPost as jest.Mock).mockResolvedValue(true);
  });

  const renderScreen = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <PostDetailScreen />
      </QueryClientProvider>
    );
  };

  it('renders report details and comments', async () => {
    const { getByText } = renderScreen();

    await waitFor(() => {
      expect(getByText('Report Detail')).toBeTruthy();
      expect(getByText('Pothole detail text')).toBeTruthy();
      expect(getByText('Main Road')).toBeTruthy();
      expect(getByText('First detail comment')).toBeTruthy();
    });
  });

  it('submits a new comment', async () => {
    const { getByPlaceholderText, UNSAFE_getByType } = renderScreen();

    await waitFor(() => expect(getByPlaceholderText('Add a comment...')).toBeTruthy());

    const input = getByPlaceholderText('Add a comment...');
    fireEvent.changeText(input, 'New detail comment');

    const { Send } = require('lucide-react-native');
    const sendBtn = UNSAFE_getByType(Send);

    await act(async () => {
      fireEvent.press(sendBtn);
    });

    expect(postService.createComment).toHaveBeenCalledWith('p1', 'New detail comment', undefined);
  });

  it('handles upvote, downvote, and location press', async () => {
    const linkSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as any);
    const { getByText, UNSAFE_getAllByType } = renderScreen();

    await waitFor(() => expect(getByText('Main Road')).toBeTruthy());

    fireEvent.press(getByText('Main Road'));
    expect(linkSpy).toHaveBeenCalledWith(expect.stringContaining('google.com/maps'));

    const { ArrowUp, ArrowDown } = require('lucide-react-native');
    const upBtn = UNSAFE_getAllByType(ArrowUp)[0];
    const downBtn = UNSAFE_getAllByType(ArrowDown)[0];

    await act(async () => {
      fireEvent.press(upBtn);
    });
    expect(postService.likePost).toHaveBeenCalledWith('p1');

    await act(async () => {
      fireEvent.press(downBtn);
    });

    linkSpy.mockRestore();
  });

  it('handles repost alert', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { UNSAFE_getAllByType } = renderScreen();

    const { Repeat } = require('lucide-react-native');
    await waitFor(() => expect(UNSAFE_getAllByType(Repeat).length).toBeGreaterThan(0));

    const repostBtn = UNSAFE_getAllByType(Repeat)[0];
    fireEvent.press(repostBtn);

    expect(alertSpy).toHaveBeenCalledWith(
      'Repost Hazard Report',
      expect.any(String),
      expect.any(Array)
    );
    alertSpy.mockRestore();
  });
});
