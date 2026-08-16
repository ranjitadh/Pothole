import { useAuthStore } from '../../store/auth-store';

jest.mock('../../services/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signOut: jest.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: jest.fn().mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } }),
    },
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

import { supabase } from '../../services/supabase';

const mockSupabase = supabase as any;

describe('Auth Store', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      profile: null,
      isLoading: false,
      isAuthenticated: false,
    });
    jest.clearAllMocks();
  });

  it('has correct initial state', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.profile).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('setUser sets user and isAuthenticated', () => {
    const mockUser = { id: 'user-1', email: 'test@test.com' } as any;
    useAuthStore.getState().setUser(mockUser);

    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.isAuthenticated).toBe(true);
  });

  it('setUser with null clears isAuthenticated', () => {
    useAuthStore.getState().setUser(null);

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('setProfile sets profile', () => {
    const mockProfile = {
      id: 'user-1',
      username: 'testuser',
      displayName: 'Test User',
      bio: 'Hello',
      avatarUrl: null,
      coverUrl: null,
      followersCount: 0,
      followingCount: 0,
      postsCount: 0,
      createdAt: '2024-01-01',
    };
    useAuthStore.getState().setProfile(mockProfile);

    const state = useAuthStore.getState();
    expect(state.profile).toEqual(mockProfile);
  });

  it('setLoading sets isLoading', () => {
    useAuthStore.getState().setLoading(true);
    expect(useAuthStore.getState().isLoading).toBe(true);

    useAuthStore.getState().setLoading(false);
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('initialize sets session user and profile when session exists', async () => {
    const mockUser = { id: 'user-1', email: 'test@test.com' };
    const mockRawProfile = {
      id: 'user-1',
      username: 'testuser',
      display_name: 'Test User',
      bio: null,
      avatar_url: null,
      cover_url: null,
      followers_count: 5,
      following_count: 3,
      posts_count: 2,
      created_at: '2024-01-01',
    };

    let authChangeListener: any;
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { user: mockUser } },
      error: null,
    });

    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({ data: mockRawProfile, error: null }),
        }),
      }),
    });

    mockSupabase.auth.onAuthStateChange.mockImplementation((callback: any) => {
      authChangeListener = callback;
      return { data: { subscription: { unsubscribe: jest.fn() } } };
    });

    await useAuthStore.getState().initialize();

    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.isAuthenticated).toBe(true);
    expect(state.profile?.username).toBe('testuser');

    // Trigger SIGNED_OUT auth change
    await authChangeListener('SIGNED_OUT', null);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);

    // Trigger SIGNED_IN auth change
    await authChangeListener('SIGNED_IN', { user: mockUser });
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('handles error in fetchOrEnsureProfile gracefully', async () => {
    const mockUser = { id: 'user-1', email: 'test@test.com' };

    useAuthStore.getState().setUser(mockUser as any);
    mockSupabase.from.mockImplementation(() => {
      throw new Error('Database error');
    });

    await useAuthStore.getState().refreshProfile();
    expect(useAuthStore.getState().profile).toBeNull();
  });

  it('handles initialization error gracefully', async () => {
    mockSupabase.auth.getSession.mockRejectedValue(new Error('Session error'));

    await useAuthStore.getState().initialize();
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('signOut clears state', async () => {
    useAuthStore.getState().setUser({ id: 'user-1' } as any);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    mockSupabase.auth.signOut.mockResolvedValue({ error: null });

    await useAuthStore.getState().signOut();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.profile).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });
});
