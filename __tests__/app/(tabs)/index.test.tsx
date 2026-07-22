import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import FeedScreen from '../../../app/(tabs)/index';

jest.mock('../../../services/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
    },
  },
}));
jest.mock('../../../services/post', () => ({
  getFeedPosts: jest.fn(),
}));
jest.mock('../../../components/PostCard', () => ({
  PostCard: ({ post }: any) => {
    const { View, Text } = require('react-native');
    return (
      <View testID="post-card">
        <Text>{post.text}</Text>
      </View>
    );
  },
}));
jest.mock('@tanstack/react-query', () => {
  const actual = jest.requireActual('@tanstack/react-query');
  return {
    ...actual,
    useInfiniteQuery: jest.fn(),
  };
});

import { useInfiniteQuery } from '@tanstack/react-query';

const mockUseInfiniteQuery = useInfiniteQuery as jest.Mock;

describe('Feed Screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading state', () => {
    mockUseInfiniteQuery.mockReturnValue({
      data: undefined,
      fetchNextPage: jest.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: true,
      isError: false,
      error: null,
      refetch: jest.fn(),
    });

    const { getByTestId } = render(<FeedScreen />);
    expect(getByTestId).toBeTruthy();
  });

  it('shows error state', () => {
    mockUseInfiniteQuery.mockReturnValue({
      data: undefined,
      fetchNextPage: jest.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      isError: true,
      error: { message: 'Network error' },
      refetch: jest.fn(),
    });

    const { getByText } = render(<FeedScreen />);
    expect(getByText('Failed to load feed')).toBeTruthy();
    expect(getByText('Network error')).toBeTruthy();
  });

  it('shows empty state when no posts', () => {
    mockUseInfiniteQuery.mockReturnValue({
      data: { pages: [{ data: [], nextCursor: null, hasMore: false }] },
      fetchNextPage: jest.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    });

    const { getByText } = render(<FeedScreen />);
    expect(getByText('No reports yet')).toBeTruthy();
    expect(getByText('Be the first to report a road hazard!')).toBeTruthy();
  });

  it('renders posts when data is available', () => {
    const mockPosts = [
      { id: '1', text: 'Big pothole on Main St' },
      { id: '2', text: 'Dangerous curve ahead' },
    ];

    mockUseInfiniteQuery.mockReturnValue({
      data: { pages: [{ data: mockPosts, nextCursor: null, hasMore: false }] },
      fetchNextPage: jest.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    });

    const { getByText } = render(<FeedScreen />);
    expect(getByText('Big pothole on Main St')).toBeTruthy();
    expect(getByText('Dangerous curve ahead')).toBeTruthy();
  });

  it('shows loading indicator when fetching next page', () => {
    mockUseInfiniteQuery.mockReturnValue({
      data: { pages: [{ data: [{ id: '1', text: 'Post 1' }], nextCursor: 'cursor', hasMore: true }] },
      fetchNextPage: jest.fn(),
      hasNextPage: true,
      isFetchingNextPage: true,
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    });

    const { getByText } = render(<FeedScreen />);
    expect(getByText('Post 1')).toBeTruthy();
  });
});
