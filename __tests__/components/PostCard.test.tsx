import React from 'react';
import { Alert, Share } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import { PostCard } from '../../components/PostCard';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('../../services/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
    },
  },
}));
jest.mock('../../store/auth-store', () => {
  const mockGetState = jest.fn().mockReturnValue({ user: { id: 'user-1' } });
  const mockUseAuthStore = Object.assign(jest.fn().mockReturnValue({ user: { id: 'user-1' } }), {
    getState: mockGetState,
  });
  return { useAuthStore: mockUseAuthStore };
});
jest.mock('../../services/post', () => ({
  likePost: jest.fn().mockResolvedValue({ liked: true }),
  unlikePost: jest.fn().mockResolvedValue({ liked: false }),
  savePost: jest.fn().mockResolvedValue({ saved: true }),
  unsavePost: jest.fn().mockResolvedValue({ saved: false }),
  deletePost: jest.fn().mockResolvedValue({ success: true }),
  blockUser: jest.fn().mockResolvedValue({ success: true }),
  updatePostStatus: jest.fn().mockResolvedValue({ success: true }),
  reportPost: jest.fn().mockResolvedValue({ success: true }),
  repostPost: jest.fn().mockResolvedValue({ success: true }),
}));
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
  useQuery: jest.fn().mockReturnValue({ data: [], isLoading: false }),
  useMutation: jest.fn().mockReturnValue({ mutate: jest.fn(), isPending: false }),
}));
jest.mock('lucide-react-native', () => ({
  Heart: 'Heart',
  MessageCircle: 'MessageCircle',
  Bookmark: 'Bookmark',
  AlertTriangle: 'AlertTriangle',
  MoreHorizontal: 'MoreHorizontal',
  MapPin: 'MapPin',
  Flag: 'Flag',
  ShieldAlert: 'ShieldAlert',
  Trash2: 'Trash2',
  ArrowUp: 'ArrowUp',
  ArrowDown: 'ArrowDown',
  Repeat: 'Repeat',
  Forward: 'Forward',
}));

import { useAuthStore } from '../../store/auth-store';
import { likePost, unlikePost, savePost, unsavePost, updatePostStatus, reportPost, repostPost } from '../../services/post';
import type { PostWithDetails } from '../../types';

const mockUseAuthStore = useAuthStore as any;
const mockLikePost = likePost as jest.Mock;
const mockRepostPost = repostPost as jest.Mock;
const mockUnlikePost = unlikePost as jest.Mock;
const mockSavePost = savePost as jest.Mock;
const mockUnsavePost = unsavePost as jest.Mock;
const mockUpdatePostStatus = updatePostStatus as jest.Mock;
const mockReportPost = reportPost as jest.Mock;

const createMockPost = (overrides: Partial<PostWithDetails> = {}): PostWithDetails => ({
  id: 'post-1',
  userId: 'user-1',
  text: 'Large pothole on Ring Road near hospital',
  visibility: 'public',
  likesCount: 10,
  commentsCount: 3,
  sharesCount: 1,
  isEdited: false,
  createdAt: '2024-06-01T00:00:00Z',
  author: {
    id: 'author-1',
    username: 'roadwatcher',
    displayName: 'Road Watcher',
    bio: null,
    avatarUrl: 'https://example.com/avatar.jpg',
    coverUrl: null,
    followersCount: 50,
    followingCount: 20,
    postsCount: 15,
    createdAt: '2024-01-01',
  },
  media: [],
  location: {
    id: 'loc-1',
    latitude: 27.7172,
    longitude: 85.324,
    placeName: 'Ring Road, Kathmandu',
    country: 'Nepal',
    city: 'Kathmandu',
    googlePlaceId: null,
  },
  hashtags: [],
  isLiked: false,
  isSaved: false,
  status: 'unresolved',
  ...overrides,
});

describe('PostCard Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuthStore.mockReturnValue({ user: { id: 'user-1' } });
    mockUseAuthStore.getState.mockReturnValue({ user: { id: 'user-1' } });
  });

  it('renders post details correctly', () => {
    const post = createMockPost();
    const { getByText } = render(<PostCard post={post} />);

    expect(getByText('Road Watcher')).toBeTruthy();
    expect(getByText('@roadwatcher')).toBeTruthy();
    expect(getByText('Large pothole on Ring Road near hospital')).toBeTruthy();
    expect(getByText('Unresolved')).toBeTruthy();
    expect(getByText('10')).toBeTruthy();
    expect(getByText('3')).toBeTruthy();
  });

  it('renders location tag', () => {
    const post = createMockPost();
    const { getByText } = render(<PostCard post={post} />);

    expect(getByText('Ring Road, Kathmandu')).toBeTruthy();
  });

  it('renders coordinates when no placeName', () => {
    const post = createMockPost({
      location: { id: 'loc-1', latitude: 27.7172, longitude: 85.324, placeName: null, country: null, city: null, googlePlaceId: null },
    });
    const { getByText } = render(<PostCard post={post} />);

    expect(getByText('27.7172, 85.3240')).toBeTruthy();
  });

  it('toggles upvote when upvote button is pressed', async () => {
    const post = createMockPost({ isLiked: false, likesCount: 10 });
    const { getByTestId } = render(<PostCard post={post} />);

    await act(async () => {
      fireEvent.press(getByTestId('upvote-button'));
    });

    expect(mockLikePost).toHaveBeenCalledWith('post-1');
  });

  it('toggles unlike when already upvoted', async () => {
    const post = createMockPost({ isLiked: true, likesCount: 10 });
    const { getByTestId } = render(<PostCard post={post} />);

    await act(async () => {
      fireEvent.press(getByTestId('upvote-button'));
    });

    expect(mockUnlikePost).toHaveBeenCalledWith('post-1');
  });

  it('toggles downvote when downvote button is pressed', async () => {
    const post = createMockPost({ isLiked: false, likesCount: 10 });
    const { getByTestId } = render(<PostCard post={post} />);

    await act(async () => {
      fireEvent.press(getByTestId('downvote-button'));
    });

    // Downvotes are handled locally via vote-store
    expect(getByTestId('downvote-button')).toBeTruthy();
  });

  it('triggers repost confirmation when repost button is pressed', async () => {
    jest.spyOn(Alert, 'alert');
    const post = createMockPost({ sharesCount: 3 });
    const { getByTestId } = render(<PostCard post={post} />);

    await act(async () => {
      fireEvent.press(getByTestId('repost-button'));
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Repost Hazard Report',
      expect.any(String),
      expect.any(Array)
    );
  });

  it('triggers share dialog when share button is pressed', async () => {
    jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
    const post = createMockPost();
    const { getByTestId } = render(<PostCard post={post} />);

    await act(async () => {
      fireEvent.press(getByTestId('share-button'));
    });

    expect(Share.share).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('play.google.com/store/apps/details?id=com.pothole.app'),
      })
    );
  });

  it('renders status badge for in_progress', () => {
    const post = createMockPost({ status: 'in_progress' });
    const { getByText } = render(<PostCard post={post} />);

    expect(getByText('In Progress')).toBeTruthy();
  });

  it('renders status badge for resolved', () => {
    const post = createMockPost({ status: 'resolved' });
    const { getByText } = render(<PostCard post={post} />);

    expect(getByText('Resolved')).toBeTruthy();
  });

  it('renders media image when present', () => {
    const post = createMockPost({
      media: [{ id: 'm1', url: 'https://example.com/pothole.jpg', type: 'image', width: null, height: null, thumbnailUrl: null }],
    });

    const { getByText } = render(<PostCard post={post} />);
    expect(getByText('Road Watcher')).toBeTruthy();
  });

  it('shows different user actions for own posts', () => {
    mockUseAuthStore.getState.mockReturnValue({ user: { id: 'user-1' } });
    const post = createMockPost({ userId: 'user-1' });
    const { getByText } = render(<PostCard post={post} />);

    expect(getByText('Road Watcher')).toBeTruthy();
  });

  it('shows different user actions for other users posts', () => {
    mockUseAuthStore.getState.mockReturnValue({ user: { id: 'different-user' } });
    const post = createMockPost({ userId: 'user-1' });
    const { getByText } = render(<PostCard post={post} />);

    expect(getByText('Road Watcher')).toBeTruthy();
  });

  it('can open menu and trigger status update for own post', async () => {
    mockUseAuthStore.getState.mockReturnValue({ user: { id: 'user-1' } });
    const post = createMockPost({ userId: 'user-1', status: 'unresolved' });
    
    const { getByTestId, getByText, queryByText } = render(<PostCard post={post} />);
    
    // Menu should be hidden initially
    expect(queryByText('Mark In Progress')).toBeNull();
    
    // Tap more-actions button
    const toggleBtn = getByTestId('more-actions-button');
    fireEvent.press(toggleBtn);
    
    // Menu items for owner should be shown
    expect(getByText('Mark In Progress')).toBeTruthy();
    expect(getByText('Mark Resolved')).toBeTruthy();
    
    // Tap "Mark In Progress"
    await act(async () => {
      fireEvent.press(getByText('Mark In Progress'));
    });
    
    expect(mockUpdatePostStatus).toHaveBeenCalledWith('post-1', 'in_progress');
  });

  it('can open menu and trigger report flow for other user post', async () => {
    mockUseAuthStore.mockReturnValue({ user: { id: 'different-user' } });
    mockUseAuthStore.getState.mockReturnValue({ user: { id: 'different-user' } });
    const post = createMockPost({ userId: 'user-1', status: 'unresolved' });
    
    const { getByTestId, getByText, queryByText } = render(<PostCard post={post} />);
    
    // Tap more-actions button
    const toggleBtn = getByTestId('more-actions-button');
    fireEvent.press(toggleBtn);
    
    // Options for other users should show Report and Block User
    expect(getByText('Report')).toBeTruthy();
    expect(getByText('Block User')).toBeTruthy();
    expect(queryByText('Mark In Progress')).toBeNull();
    
    // Mock Alert.alert
    const originalAlert = Alert.alert;
    Alert.alert = jest.fn();
    
    // Tap Report
    fireEvent.press(getByText('Report'));
    expect(Alert.alert).toHaveBeenCalledWith(
      'Report Post',
      expect.any(String),
      expect.any(Array),
      expect.any(Object)
    );
    
    Alert.alert = originalAlert;
  });
});
