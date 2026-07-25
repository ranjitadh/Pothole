import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, ActivityIndicator, Alert, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, MapPin, UserPlus, UserMinus, ShieldAlert } from 'lucide-react-native';
import { supabase } from '../../services/supabase';
import { useColorScheme } from '../../components/useColorScheme';
import { PostCard } from '../../components/PostCard';
import { useAuthStore } from '../../store/auth-store';
import type { PostWithDetails, UserProfile } from '../../types';

export default function OtherUserProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const theme = useColorScheme();
  const isDark = theme === 'dark';

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<PostWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    if (username) {
      loadProfileAndPosts();
    }
  }, [username]);

  const loadProfileAndPosts = async () => {
    setLoading(true);
    try {
      // 1. Fetch other user profile
      const { data: rawProfile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!rawProfile) {
        Alert.alert('Error', 'User profile not found.');
        router.back();
        return;
      }

      const mappedProfile: UserProfile = {
        id: rawProfile.id,
        username: rawProfile.username,
        displayName: rawProfile.display_name,
        bio: rawProfile.bio,
        avatarUrl: rawProfile.avatar_url,
        coverUrl: rawProfile.cover_url,
        followersCount: rawProfile.followers_count || 0,
        followingCount: rawProfile.following_count || 0,
        postsCount: rawProfile.posts_count || 0,
        createdAt: rawProfile.created_at,
      };

      setProfile(mappedProfile);
      setFollowersCount(mappedProfile.followersCount);

      // 2. Fetch if current user is following this profile
      if (user) {
        const { data: followData } = await supabase
          .from('follows')
          .select('follower_id')
          .eq('follower_id', user.id)
          .eq('following_id', mappedProfile.id)
          .maybeSingle();
        setIsFollowing(!!followData);
      }

      // 3. Fetch user posts
      const { data: rawPosts, error: postsError } = await supabase
        .from('posts')
        .select(`
          *,
          author:profiles!posts_user_id_fkey(id, username, display_name, avatar_url, followers_count, following_count, posts_count, created_at),
          media:post_media(*),
          location:locations(*)
        `)
        .eq('user_id', mappedProfile.id)
        .order('created_at', { ascending: false });

      if (postsError) throw postsError;

      // Fetch current user likes & saved posts to map PostCard flags correctly
      let likedIds = new Set<string>();
      let savedIds = new Set<string>();
      if (user) {
        const { data: likedList } = await supabase.from('likes').select('post_id').eq('user_id', user.id);
        const { data: savedList } = await supabase.from('saved_posts').select('post_id').eq('user_id', user.id);
        likedIds = new Set(likedList?.map(l => l.post_id) || []);
        savedIds = new Set(savedList?.map(s => s.post_id) || []);
      }

      const mappedPosts: PostWithDetails[] = (rawPosts || []).map((p: any) => ({
        id: p.id,
        userId: p.user_id,
        text: p.text,
        status: p.status || 'unresolved',
        visibility: p.visibility,
        likesCount: p.likes_count || 0,
        commentsCount: p.comments_count || 0,
        sharesCount: p.shares_count || 0,
        isEdited: p.is_edited || false,
        createdAt: p.created_at,
        author: {
          id: p.author.id,
          username: p.author.username,
          displayName: p.author.display_name,
          bio: p.author.bio || null,
          avatarUrl: p.author.avatar_url,
          coverUrl: p.author.cover_url || null,
          followersCount: p.author.followers_count || 0,
          followingCount: p.author.following_count || 0,
          postsCount: p.author.posts_count || 0,
          createdAt: p.author.created_at,
        },
        media: (p.media || []).map((m: any) => ({
          id: m.id,
          url: m.url,
          type: m.type || 'image',
          width: m.width || null,
          height: m.height || null,
          thumbnailUrl: m.thumbnail_url || null,
        })),
        location: p.location ? {
          id: p.location.id,
          latitude: p.location.latitude,
          longitude: p.location.longitude,
          placeName: p.location.place_name,
          country: p.location.country || null,
          city: p.location.city || null,
          googlePlaceId: p.location.google_place_id || null,
        } : null,
        hashtags: [],
        isLiked: likedIds.has(p.id),
        isSaved: savedIds.has(p.id),
      }));

      setPosts(mappedPosts);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not load profile information.');
    } finally {
      setLoading(false);
    }
  };

  const handleFollowToggle = async () => {
    if (!profile || !user) return;
    setFollowLoading(true);
    try {
      if (isFollowing) {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', profile.id);
        if (error) throw error;
        setIsFollowing(false);
        setFollowersCount(prev => Math.max(0, prev - 1));
      } else {
        const { error } = await supabase
          .from('follows')
          .insert({
            follower_id: user.id,
            following_id: profile.id,
          });
        if (error) throw error;
        setIsFollowing(true);
        setFollowersCount(prev => prev + 1);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not update follow status');
    } finally {
      setFollowLoading(false);
    }
  };

  const handleBlockUser = async () => {
    if (!profile || !user) return;
    Alert.alert(
      'Block User',
      `Are you sure you want to block @${profile.username}? You will not see their posts or updates.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('blocks')
                .insert({
                  blocker_id: user.id,
                  blocked_id: profile.id,
                });
              if (error) throw error;
              Alert.alert('Blocked', `You have blocked @${profile.username}.`);
              router.back();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Could not block user');
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, isDark && styles.containerDark]}>
        <ActivityIndicator size="large" color="#ea580c" />
      </View>
    );
  }

  if (!profile) return null;

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
      {/* Custom Header */}
      <View style={[styles.header, isDark && styles.headerDark]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={20} color={isDark ? '#f8fafc' : '#0f172a'} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isDark && styles.textLight]} numberOfLines={1}>
          @{profile.username}
        </Text>
        <TouchableOpacity onPress={handleBlockUser} style={styles.blockBtn}>
          <ShieldAlert size={20} color="#ef4444" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <PostCard post={item} />}
        contentContainerStyle={styles.scrollContent}
        ListHeaderComponent={
          <>
            {/* Cover Photo Backdrop */}
            <View style={styles.coverPhotoContainer}>
              {profile.coverUrl ? (
                <Image source={{ uri: profile.coverUrl }} style={styles.coverPhoto} />
              ) : (
                <View style={styles.coverPhotoFallback} />
              )}
            </View>

            {/* Profile Details Header */}
            <View style={styles.profileHeader}>
              <View style={styles.avatarRow}>
                <Image
                  source={{ uri: profile.avatarUrl || 'https://via.placeholder.com/150' }}
                  style={styles.avatar}
                />
                
                {/* Follow Button */}
                {user?.id !== profile.id && (
                  <TouchableOpacity
                    onPress={handleFollowToggle}
                    disabled={followLoading}
                    style={[
                      styles.followBtn,
                      isFollowing ? styles.followingBtn : styles.followSolidBtn
                    ]}
                  >
                    {followLoading ? (
                      <ActivityIndicator size="small" color={isFollowing ? '#ea580c' : '#ffffff'} />
                    ) : isFollowing ? (
                      <>
                        <UserMinus size={16} color="#ea580c" style={{ marginRight: 6 }} />
                        <Text style={styles.followingBtnText}>Unfollow</Text>
                      </>
                    ) : (
                      <>
                        <UserPlus size={16} color="#ffffff" style={{ marginRight: 6 }} />
                        <Text style={styles.followBtnText}>Follow</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.infoContainer}>
                <Text style={[styles.displayName, isDark && styles.displayNameDark]}>{profile.displayName}</Text>
                <Text style={[styles.usernameText, isDark && styles.usernameDark]}>@{profile.username}</Text>
                {profile.bio && <Text style={[styles.bio, isDark && styles.bioDark]}>{profile.bio}</Text>}
              </View>

              {/* Stats Row */}
              <View style={[styles.statsRow, isDark && styles.statsRowDark]}>
                <View style={styles.statCol}>
                  <Text style={[styles.statCount, isDark && styles.statCountDark]}>{profile.postsCount}</Text>
                  <Text style={styles.statLabel}>reports</Text>
                </View>
                <View style={[styles.statDivider, isDark && styles.statDividerDark]} />
                <View style={styles.statCol}>
                  <Text style={[styles.statCount, isDark && styles.statCountDark]}>{followersCount}</Text>
                  <Text style={styles.statLabel}>followers</Text>
                </View>
                <View style={[styles.statDivider, isDark && styles.statDividerDark]} />
                <View style={styles.statCol}>
                  <Text style={[styles.statCount, isDark && styles.statCountDark]}>{profile.followingCount}</Text>
                  <Text style={styles.statLabel}>following</Text>
                </View>
              </View>
            </View>

            {/* Divider Section */}
            <View style={[styles.sectionDivider, isDark && styles.sectionDividerDark]} />
            <Text style={[styles.reportsTitle, isDark && styles.textLight]}>Hazard Reports</Text>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={[styles.emptyStateText, isDark && styles.textLight]}>No reports posted by this user yet.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  containerDark: {
    backgroundColor: '#0f172a',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 52,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  headerDark: {
    backgroundColor: '#1e293b',
    borderBottomColor: '#334155',
  },
  backBtn: {
    padding: 8,
  },
  blockBtn: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  coverPhotoContainer: {
    height: 128,
    width: '100%',
  },
  coverPhotoFallback: {
    height: 128,
    backgroundColor: 'rgba(234, 88, 12, 0.15)',
    width: '100%',
  },
  coverPhoto: {
    height: 128,
    width: '100%',
    resizeMode: 'cover',
  },
  profileHeader: {
    paddingHorizontal: 24,
    paddingBottom: 20,
    marginTop: -48,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 4,
    borderColor: '#ffffff',
    backgroundColor: '#e5e7eb',
  },
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    height: 38,
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  followSolidBtn: {
    backgroundColor: '#ea580c',
  },
  followingBtn: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ea580c',
    shadowColor: 'transparent',
  },
  followBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  followingBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ea580c',
  },
  infoContainer: {
    marginTop: 16,
  },
  displayName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  displayNameDark: {
    color: '#f8fafc',
  },
  usernameText: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  usernameDark: {
    color: '#94a3b8',
  },
  bio: {
    fontSize: 14,
    color: '#374151',
    marginTop: 10,
    lineHeight: 20,
  },
  bioDark: {
    color: '#cbd5e1',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    backgroundColor: '#f9fafb',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  statsRowDark: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
  },
  statCol: {
    alignItems: 'center',
    flex: 1,
  },
  statCount: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
  statCountDark: {
    color: '#f8fafc',
  },
  statLabel: {
    fontSize: 9,
    color: '#9ca3af',
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#e5e7eb',
  },
  statDividerDark: {
    backgroundColor: '#334155',
  },
  sectionDivider: {
    height: 8,
    backgroundColor: '#f9fafb',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#f3f4f6',
  },
  sectionDividerDark: {
    backgroundColor: '#1e293b',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#334155',
  },
  reportsTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginHorizontal: 16,
    marginTop: 18,
    marginBottom: 8,
  },
  textLight: {
    color: '#f8fafc',
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyStateText: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
  },
});
