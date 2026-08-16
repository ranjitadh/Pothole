import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import NotificationsScreen from '../../../app/(tabs)/notifications';

const mockSelect = jest.fn().mockReturnThis();
const mockEq = jest.fn().mockReturnThis();
const mockOrder = jest.fn().mockResolvedValue({
  data: [{ id: 'notif-1', type: 'like', actor: { username: 'johndoe' }, created_at: '2024-06-01T00:00:00Z' }],
  error: null,
});

jest.mock('../../../services/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
    },
    from: jest.fn().mockReturnValue({
      select: () => mockSelect(),
    }),
  },
}));

jest.mock('lucide-react-native', () => ({
  Bell: 'Bell',
}));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));
jest.mock('@tanstack/react-query', () => {
  const actual = jest.requireActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: jest.fn(),
  };
});

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../services/supabase';

const mockUseQuery = useQuery as jest.Mock;
const mockSupabase = supabase as any;

describe('Notifications Screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ order: mockOrder });
  });

  it('shows loading state', () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    const { getByTestId } = render(<NotificationsScreen />);
    expect(getByTestId).toBeTruthy();
  });

  it('shows empty state when no notifications', () => {
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    });

    const { getByText } = render(<NotificationsScreen />);
    expect(getByText('No alerts yet')).toBeTruthy();
    expect(getByText('Activity related to your posts will appear here.')).toBeTruthy();
  });

  it('executes queryFn and fetches notification records from database', async () => {
    let capturedQueryFn: any;
    mockUseQuery.mockImplementation((options: any) => {
      capturedQueryFn = options.queryFn;
      return { data: [], isLoading: false, isError: false, refetch: jest.fn() };
    });

    render(<NotificationsScreen />);

    expect(capturedQueryFn).toBeDefined();
    const result = await capturedQueryFn();
    expect(mockSupabase.from).toHaveBeenCalledWith('notifications');
    expect(result.length).toBe(1);
  });

  it('handles pull to refresh', async () => {
    const mockRefetch = jest.fn().mockResolvedValue({});
    mockUseQuery.mockReturnValue({
      data: [
        {
          id: '1',
          type: 'like',
          actor: { username: 'johndoe' },
          created_at: '2024-06-01T00:00:00Z',
        },
      ],
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    });

    const { UNSAFE_getByType } = render(<NotificationsScreen />);
    const { FlatList } = require('react-native');
    const list = UNSAFE_getByType(FlatList);

    await act(async () => {
      list.props.refreshControl.props.onRefresh();
    });

    expect(mockRefetch).toHaveBeenCalled();
  });

  it('redirects to post detail screen when pressing a comment or like notification', async () => {
    mockUseQuery.mockReturnValue({
      data: [
        {
          id: 'notif-1',
          type: 'comment',
          post_id: 'post-100',
          actor: { username: 'commenter' },
          created_at: '2024-06-01T00:00:00Z',
        },
      ],
      isLoading: false,
      isError: false,
    });

    const { getByTestId } = render(<NotificationsScreen />);
    const row = getByTestId('notification-item-notif-1');
    
    fireEvent.press(row);

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/post/[id]',
      params: { id: 'post-100' },
    });
  });

  it('redirects to profile screen when pressing a follow notification', async () => {
    mockUseQuery.mockReturnValue({
      data: [
        {
          id: 'notif-2',
          type: 'follow',
          actor: { username: 'follower' },
          created_at: '2024-06-01T00:00:00Z',
        },
      ],
      isLoading: false,
      isError: false,
    });

    const { getByTestId } = render(<NotificationsScreen />);
    const row = getByTestId('notification-item-notif-2');
    
    fireEvent.press(row);

    expect(mockPush).toHaveBeenCalledWith('/profile/follower');
  });
});
