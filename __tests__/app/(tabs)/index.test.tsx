import React from 'react';
import { render, act } from '@testing-library/react-native';
import FeedScreen from '../../../app/(tabs)/index';

jest.mock('../../../services/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
    },
  },
}));

jest.mock('../../../services/post', () => ({
  getFeedPosts: jest.fn().mockResolvedValue({ data: [], nextCursor: 'cursor-2', hasMore: true }),
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
import { getFeedPosts } from '../../../services/post';

const mockUseInfiniteQuery = useInfiniteQuery as jest.Mock;
const mockGetFeedPosts = getFeedPosts as jest.Mock;

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

  it('executes queryFn and getNextPageParam', async () => {
    let capturedOptions: any;
    mockUseInfiniteQuery.mockImplementation((options: any) => {
      capturedOptions = options;
      return {
        data: { pages: [{ data: [], nextCursor: 'next-1', hasMore: false }] },
        fetchNextPage: jest.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
      };
    });

    render(<FeedScreen />);

    expect(capturedOptions).toBeDefined();
    await capturedOptions.queryFn({ pageParam: 'cursor-1' });
    expect(mockGetFeedPosts).toHaveBeenCalledWith('cursor-1');

    const next = capturedOptions.getNextPageParam({ nextCursor: 'cursor-2' });
    expect(next).toBe('cursor-2');
  });

  it('handles pull to refresh and load more', async () => {
    const mockRefetch = jest.fn().mockResolvedValue({});
    const mockFetchNextPage = jest.fn();

    mockUseInfiniteQuery.mockReturnValue({
      data: { pages: [{ data: [{ id: '1', text: 'Pothole' }], nextCursor: 'cursor-2', hasMore: true }] },
      fetchNextPage: mockFetchNextPage,
      hasNextPage: true,
      isFetchingNextPage: false,
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    });

    const { UNSAFE_getByType } = render(<FeedScreen />);
    const { FlatList } = require('react-native');
    const list = UNSAFE_getByType(FlatList);

    await act(async () => {
      list.props.refreshControl.props.onRefresh();
    });

    expect(mockRefetch).toHaveBeenCalled();

    act(() => {
      list.props.onEndReached();
    });

    expect(mockFetchNextPage).toHaveBeenCalled();
  });
});
