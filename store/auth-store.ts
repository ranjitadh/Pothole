import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import type { UserProfile } from '../types';
import { supabase } from '../services/supabase';

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
  initialize: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

function mapProfile(raw: any): UserProfile {
  return {
    id: raw.id,
    username: raw.username,
    displayName: raw.display_name,
    bio: raw.bio,
    avatarUrl: raw.avatar_url,
    coverUrl: raw.cover_url,
    followersCount: raw.followers_count,
    followingCount: raw.following_count,
    postsCount: raw.posts_count,
    createdAt: raw.created_at,
  };
}

export async function fetchOrEnsureProfile(user: User): Promise<UserProfile | null> {
  try {
    const { data: rawProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (rawProfile) {
      return mapProfile(rawProfile);
    }

    // Fallback profile creation if database trigger was not executed
    const rawUsername = user.user_metadata?.username || user.email?.split('@')[0] || `user_${user.id.slice(0, 8)}`;
    const cleanUsername = rawUsername.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 20);
    const displayName = user.user_metadata?.display_name || user.user_metadata?.full_name || cleanUsername;
    const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture || null;

    const { data: createdProfile } = await supabase
      .from('profiles')
      .upsert(
        {
          id: user.id,
          username: cleanUsername,
          display_name: displayName,
          avatar_url: avatarUrl,
        },
        { onConflict: 'id' }
      )
      .select('*')
      .maybeSingle();

    if (createdProfile) {
      return mapProfile(createdProfile);
    }
  } catch (err) {
    console.error('Error fetching or ensuring profile:', err);
  }
  return null;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  isLoading: true,
  isAuthenticated: false,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setProfile: (profile) => set({ profile }),
  setLoading: (isLoading) => set({ isLoading }),

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        set({ user: session.user, isAuthenticated: true });
        const profile = await fetchOrEnsureProfile(session.user);
        set({ profile });
      }

      supabase.auth.onAuthStateChange(async (event, newSession) => {
        if (event === 'SIGNED_OUT' || !newSession) {
          set({ user: null, profile: null, isAuthenticated: false });
          return;
        }
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
          if (newSession?.user) {
            set({ user: newSession.user, isAuthenticated: true });
            const profile = await fetchOrEnsureProfile(newSession.user);
            set({ profile });
          }
        }
      });
    } catch (error) {
      console.error('Auth initialization error:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, profile: null, isAuthenticated: false });
  },

  refreshProfile: async () => {
    const { user } = get();
    if (!user) return;

    const profile = await fetchOrEnsureProfile(user);
    set({ profile });
  },
}));
