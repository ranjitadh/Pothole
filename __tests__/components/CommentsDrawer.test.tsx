process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { CommentsDrawer } from '../../components/CommentsDrawer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as postService from '../../services/post';
import { useAuthStore } from '../../store/auth-store';

jest.mock('lucide-react-native', () => new Proxy({}, { get: (_, prop) => prop }));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 10, bottom: 10, left: 0, right: 0 }),
}));

jest.mock('../../services/post');

describe('CommentsDrawer Component', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    useAuthStore.setState({
      profile: {
        id: 'user-1',
        username: 'me',
        displayName: 'SingleName',
        avatarUrl: null,
      } as any,
    });

    (postService.getComments as jest.Mock).mockResolvedValue([
      {
        id: 'c1',
        postId: 'post-1',
        userId: 'u2',
        text: 'Top level comment',
        isEdited: false,
        createdAt: '2024-01-01',
        parentId: null,
        author: { id: 'u2', username: 'john', displayName: 'SingleName', avatarUrl: null },
      },
      {
        id: 'c2',
        postId: 'post-1',
        userId: 'u3',
        text: 'Nested reply comment',
        isEdited: false,
        createdAt: '2024-01-01',
        parentId: 'c1',
        author: { id: 'u3', username: 'jane', displayName: 'Jane Smith', avatarUrl: 'https://example.com/avatar.jpg' },
      },
    ]);

    (postService.createComment as jest.Mock).mockResolvedValue({
      id: 'c3',
      postId: 'post-1',
      userId: 'user-1',
      text: 'New created comment',
      createdAt: '2024-01-01',
    });
  });

  const renderComponent = (props = { visible: true, onClose: jest.fn(), postId: 'post-1' }) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <CommentsDrawer {...props} />
      </QueryClientProvider>
    );
  };

  it('renders modal and comment list when visible', async () => {
    const { getByText } = renderComponent();

    await waitFor(() => {
      expect(getByText('Comments (2)')).toBeTruthy();
      expect(getByText('Top level comment')).toBeTruthy();
      expect(getByText('Nested reply comment')).toBeTruthy();
      expect(getByText('SingleName')).toBeTruthy();
      expect(getByText('@john')).toBeTruthy();
    });
  });

  it('submits a new comment when Send is pressed', async () => {
    const { getByPlaceholderText, UNSAFE_getByType } = renderComponent();

    await waitFor(() => expect(getByPlaceholderText('Add a comment...')).toBeTruthy());

    const input = getByPlaceholderText('Add a comment...');
    fireEvent.changeText(input, 'Great pothole report!');

    const { Send } = require('lucide-react-native');
    const sendBtn = UNSAFE_getByType(Send);

    await act(async () => {
      fireEvent.press(sendBtn);
    });

    expect(postService.createComment).toHaveBeenCalledWith('post-1', 'Great pothole report!', null);
  });

  it('handles reply button press and nested reply submission', async () => {
    const { getByText, getByPlaceholderText, UNSAFE_getByType } = renderComponent();

    await waitFor(() => expect(getByText('Top level comment')).toBeTruthy());

    const replyBtn = getByText('Reply');
    fireEvent.press(replyBtn);

    expect(getByPlaceholderText('Reply to @john...')).toBeTruthy();

    const input = getByPlaceholderText('Reply to @john...');
    fireEvent.changeText(input, 'Replying to top comment');

    const { Send } = require('lucide-react-native');
    const sendBtn = UNSAFE_getByType(Send);

    await act(async () => {
      fireEvent.press(sendBtn);
    });

    expect(postService.createComment).toHaveBeenCalledWith('post-1', 'Replying to top comment', 'c1');
  });

  it('toggles comment upvotes and downvotes', async () => {
    const { UNSAFE_getAllByType } = renderComponent();

    const { ArrowUp, ArrowDown } = require('lucide-react-native');
    await waitFor(() => expect(UNSAFE_getAllByType(ArrowUp).length).toBeGreaterThan(0));

    const upBtn = UNSAFE_getAllByType(ArrowUp)[0];
    const downBtn = UNSAFE_getAllByType(ArrowDown)[0];

    fireEvent.press(upBtn);
    fireEvent.press(downBtn);
  });
});
