import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import ExploreScreen from '../../../app/(tabs)/explore';

jest.mock('../../../store/auth-store', () => ({
  useAuthStore: () => ({
    profile: { id: 'user-1', display_name: 'Ranjit Adhikari', username: 'ranjit' },
  }),
}));

jest.mock('../../../services/post', () => ({
  searchUsers: jest.fn().mockResolvedValue([
    { id: 'u1', username: 'ranjit', display_name: 'ranjit', followers_count: 0 },
    { id: 'u2', username: 'ranjitadh24', display_name: 'Ranjit Adhikari', followers_count: 0 },
  ]),
  searchPosts: jest.fn().mockResolvedValue([]),
  searchHashtags: jest.fn().mockResolvedValue([]),
}));

jest.mock('lucide-react-native', () => ({
  Search: 'Search',
  Sun: 'Sun',
  MapPin: 'MapPin',
  X: 'X',
  Hash: 'Hash',
  Heart: 'Heart',
  MessageCircle: 'MessageCircle',
  Bookmark: 'Bookmark',
  AlertTriangle: 'AlertTriangle',
  MoreHorizontal: 'MoreHorizontal',
  Moon: 'Moon',
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 20, bottom: 0, left: 0, right: 0 }),
}));

// Mock PostCard to prevent rendering issues in explore page tests
jest.mock('../../../components/PostCard', () => {
  const { Text } = require('react-native');
  return {
    PostCard: () => <Text>PostCardMock</Text>,
  };
});

describe('Search Screen (formerly Explore)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders search input and initial empty state', () => {
    const { getByPlaceholderText, getByText } = render(<ExploreScreen />);
    
    expect(getByPlaceholderText('Search posts, users or hashtags...')).toBeTruthy();
    expect(getByText('Search Pothole')).toBeTruthy();
    expect(getByText('Find users, road hazard reports, or hashtags near you')).toBeTruthy();
  });

  it('triggers user query and renders user profiles results', async () => {
    const { getByPlaceholderText, getByText, findByText } = render(<ExploreScreen />);
    
    const input = getByPlaceholderText('Search posts, users or hashtags...');
    
    await act(async () => {
      fireEvent.changeText(input, 'ranjit');
    });

    // Wait for the debounced search or manual query to resolve
    const user1 = await findByText('ranjit');
    const user2 = await findByText('Ranjit Adhikari');
    
    expect(user1).toBeTruthy();
    expect(user2).toBeTruthy();
  });
});
