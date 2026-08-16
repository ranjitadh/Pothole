import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import { PostCard } from '../../components/PostCard';

jest.mock('lucide-react-native', () => new Proxy({}, { get: (_, prop) => prop }));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 10, bottom: 10, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: any) => children,
  SafeAreaView: ({ children }: any) => children,
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

let mockUserId = 'user-1';

jest.mock('../../store/auth-store', () => ({
  useAuthStore: () => ({ user: { id: mockUserId } }),
}));

const mockToggle = jest.fn();
jest.mock('../../store/vote-store', () => ({
  useVoteStore: () => ({
    downvotedPostIds: [],
    togglePostDownvote: mockToggle,
  }),
}));

const mockLikePost = jest.fn().mockResolvedValue({ liked: true });
const mockUnlikePost = jest.fn().mockResolvedValue({ liked: false });
const mockSavePost = jest.fn().mockResolvedValue({ saved: true });
const mockUnsavePost = jest.fn().mockResolvedValue({ saved: false });
const mockRepostPost = jest.fn().mockResolvedValue(true);
const mockDeletePost = jest.fn().mockResolvedValue({ success: true });
const mockBlockUser = jest.fn().mockResolvedValue({ success: true });
const mockUpdatePostStatus = jest.fn().mockResolvedValue({ success: true });
const mockReportPost = jest.fn().mockResolvedValue({ success: true });

jest.mock('../../services/post', () => ({
  likePost: (...args: any[]) => mockLikePost(...args),
  unlikePost: (...args: any[]) => mockUnlikePost(...args),
  savePost: (...args: any[]) => mockSavePost(...args),
  unsavePost: (...args: any[]) => mockUnsavePost(...args),
  repostPost: (...args: any[]) => mockRepostPost(...args),
  deletePost: (...args: any[]) => mockDeletePost(...args),
  blockUser: (...args: any[]) => mockBlockUser(...args),
  updatePostStatus: (...args: any[]) => mockUpdatePostStatus(...args),
  reportPost: (...args: any[]) => mockReportPost(...args),
  getComments: jest.fn().mockResolvedValue([]),
  createComment: jest.fn().mockResolvedValue({}),
  deleteComment: jest.fn().mockResolvedValue(true),
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: jest.fn(),
  }),
  useQuery: () => ({ data: [], isLoading: false }),
  useMutation: () => ({ mutate: jest.fn(), isPending: false }),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('PostCard Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserId = 'user-1';
  });

  const createMockPost = (overrides = {}) => ({
    id: 'post-1',
    userId: 'user-1',
    text: 'Test post text',
    visibility: 'public' as const,
    likesCount: 10,
    commentsCount: 5,
    sharesCount: 2,
    isEdited: false,
    createdAt: new Date().toISOString(),
    status: 'unresolved' as const,
    author: {
      id: 'user-1',
      username: 'johndoe',
      displayName: 'John Doe',
      bio: 'Bio text',
      avatarUrl: 'https://example.com/avatar.jpg',
      coverUrl: null,
      followersCount: 100,
      followingCount: 50,
      postsCount: 20,
      createdAt: new Date().toISOString(),
    },
    media: [
      { id: 'm1', url: 'https://example.com/img1.jpg', type: 'image' as const, width: 800, height: 600, thumbnailUrl: null },
    ],
    location: {
      id: 'loc-1',
      latitude: 37.7749,
      longitude: -122.4194,
      placeName: 'San Francisco, CA',
      country: 'USA',
      city: 'San Francisco',
      googlePlaceId: null,
    },
    hashtags: ['pothole', 'fixit'],
    isLiked: false,
    isSaved: false,
    ...overrides,
  });

  it('renders post details correctly', () => {
    const post = createMockPost();
    const { getByText } = render(<PostCard post={post} />);

    expect(getByText('John Doe')).toBeTruthy();
    expect(getByText('@johndoe')).toBeTruthy();
    expect(getByText('Test post text')).toBeTruthy();
    expect(getByText('Unresolved')).toBeTruthy();
  });

  it('navigates to post detail when body or media is pressed', () => {
    const post = createMockPost();
    const { getByText } = render(<PostCard post={post} />);

    fireEvent.press(getByText('Test post text'));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/post/[id]',
      params: { id: 'post-1' },
    });
  });

  it('navigates to user profile when author header is pressed', () => {
    const post = createMockPost();
    const { getByText } = render(<PostCard post={post} />);

    fireEvent.press(getByText('John Doe'));

    expect(mockPush).toHaveBeenCalledWith('/(tabs)/profile');
  });

  it('renders 5 media image collage', () => {
    const post5 = createMockPost({
      media: [
        { id: 'm1', url: 'https://example.com/1.jpg', type: 'image' },
        { id: 'm2', url: 'https://example.com/2.jpg', type: 'image' },
        { id: 'm3', url: 'https://example.com/3.jpg', type: 'image' },
        { id: 'm4', url: 'https://example.com/4.jpg', type: 'image' },
        { id: 'm5', url: 'https://example.com/5.jpg', type: 'image' },
      ],
    });
    const { getByText } = render(<PostCard post={post5} />);
    expect(getByText('+2')).toBeTruthy();
  });

  it('handles post delete confirmation flow', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((title, msg, buttons) => {
      const deleteBtn = buttons?.find((b: any) => b.style === 'destructive');
      if (deleteBtn && deleteBtn.onPress) {
        deleteBtn.onPress();
      }
    });

    const post = createMockPost({ userId: 'user-1' });
    const { getByTestId, getByText } = render(<PostCard post={post} />);

    fireEvent.press(getByTestId('more-actions-button'));

    await act(async () => {
      fireEvent.press(getByText('Delete Post'));
    });

    expect(mockDeletePost).toHaveBeenCalledWith('post-1');
    alertSpy.mockRestore();
  });

  it('handles report options flow for other user post', async () => {
    mockUserId = 'other-user';

    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((title, msg, buttons) => {
      const spamBtn = buttons?.find((b: any) => b.text === 'Spam');
      if (spamBtn && spamBtn.onPress) {
        spamBtn.onPress();
      }
    });

    const post = createMockPost({ userId: 'user-1' });
    const { getByTestId, getByText } = render(<PostCard post={post} />);

    fireEvent.press(getByTestId('more-actions-button'));

    await act(async () => {
      fireEvent.press(getByText('Report'));
    });

    expect(mockReportPost).toHaveBeenCalledWith('post-1', 'spam');
    alertSpy.mockRestore();
  });
});
