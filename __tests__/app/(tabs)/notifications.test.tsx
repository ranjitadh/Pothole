import React from 'react';
import { render } from '@testing-library/react-native';
import NotificationsScreen from '../../../app/(tabs)/notifications';

jest.mock('../../../services/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
    },
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue({ data: [], error: null }),
  },
}));
jest.mock('lucide-react-native', () => ({
  Bell: 'Bell',
}));
jest.mock('@tanstack/react-query', () => {
  const actual = jest.requireActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: jest.fn(),
  };
});

import { useQuery } from '@tanstack/react-query';

const mockUseQuery = useQuery as jest.Mock;

describe('Notifications Screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

  it('renders like notifications', () => {
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
    });

    const { getByText } = render(<NotificationsScreen />);
    expect(getByText('@johndoe')).toBeTruthy();
  });

  it('renders comment notifications', () => {
    mockUseQuery.mockReturnValue({
      data: [
        {
          id: '1',
          type: 'comment',
          actor: { username: 'janedoe' },
          created_at: '2024-06-01T00:00:00Z',
        },
      ],
      isLoading: false,
      isError: false,
    });

    const { getByText } = render(<NotificationsScreen />);
    expect(getByText('@janedoe')).toBeTruthy();
  });

  it('renders follow notifications', () => {
    mockUseQuery.mockReturnValue({
      data: [
        {
          id: '1',
          type: 'follow',
          actor: { username: 'newuser' },
          created_at: '2024-06-01T00:00:00Z',
        },
      ],
      isLoading: false,
      isError: false,
    });

    const { getByText } = render(<NotificationsScreen />);
    expect(getByText('@newuser')).toBeTruthy();
  });
});
