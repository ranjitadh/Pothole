import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, Image, ActivityIndicator, StyleSheet, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, MapPin, X, Hash } from 'lucide-react-native';
import { useAuthStore } from '../../store/auth-store';
import { searchUsers, searchPosts, searchHashtags } from '../../services/post';
import { PostCard } from '../../components/PostCard';
import type { PostWithDetails } from '../../types';
import { useColorScheme } from '../../components/useColorScheme';

import { useRouter } from 'expo-router';

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useAuthStore();
  const theme = useColorScheme();
  const isDark = theme === 'dark';

  const [searchQuery, setSearchQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [activeTab, setActiveTab] = useState<'users' | 'posts' | 'hashtags'>('users');
  const [users, setUsers] = useState<any[]>([]);
  const [posts, setPosts] = useState<PostWithDetails[]>([]);
  const [hashtags, setHashtags] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) {
      setUsers([]);
      setPosts([]);
      setHashtags([]);
      return;
    }

    setIsLoading(true);
    try {
      const [usersResult, postsResult, hashtagsResult] = await Promise.all([
        searchUsers(trimmed),
        searchPosts(trimmed),
        searchHashtags(trimmed),
      ]);
      setUsers(usersResult);
      setPosts(postsResult);
      setHashtags(hashtagsResult);
    } catch (err) {
      console.error('Error executing searches:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Debounced search trigger as user types
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      handleSearch(searchQuery);
    }, 350);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  const renderUserItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={[styles.userRow, isDark && styles.userRowDark]}
      activeOpacity={0.7}
      onPress={() => {
        if (profile?.username === item.username) {
          router.push('/(tabs)/profile');
        } else {
          router.push({
            pathname: '/profile/[username]' as any,
            params: { username: item.username }
          });
        }
      }}
    >
      <View style={styles.userRowLeft}>
        {item.avatar_url ? (
          <Image source={{ uri: item.avatar_url }} style={styles.userAvatar} />
        ) : (
          <View style={[styles.userAvatarPlaceholder, isDark && styles.userAvatarPlaceholderDark]}>
            <Text style={[styles.avatarPlaceholderText, isDark && styles.avatarPlaceholderTextDark]}>
              {item.display_name ? item.display_name[0].toUpperCase() : 'U'}
            </Text>
          </View>
        )}
        <View style={styles.userDetails}>
          <Text style={[styles.userDisplayName, isDark && styles.userDisplayNameDark]}>{item.display_name}</Text>
          <Text style={[styles.userUsername, isDark && styles.userUsernameDark]}>@{item.username}</Text>
        </View>
      </View>
      <Text style={[styles.userFollowers, isDark && styles.userFollowersDark]}>{item.followers_count ?? 0} followers</Text>
    </TouchableOpacity>
  );

  const renderHashtagItem = ({ item }: { item: any }) => (
    <View style={[styles.hashtagRow, isDark && styles.hashtagRowDark]}>
      <View style={styles.hashtagRowLeft}>
        <View style={[styles.hashtagIconWrapper, isDark && styles.hashtagIconWrapperDark]}>
          <Hash size={18} color="#ea580c" />
        </View>
        <Text style={[styles.hashtagName, isDark && styles.hashtagNameDark]}>#{item.name}</Text>
      </View>
      <Text style={[styles.hashtagCount, isDark && styles.hashtagCountDark]}>{item.posts_count ?? 0} reports</Text>
    </View>
  );

  const renderEmptyState = () => {
    if (isLoading) return null;
    if (!searchQuery.trim()) {
      return (
        <View style={[styles.emptyContainer, isDark && styles.emptyContainerDark]}>
          <View style={[styles.emptyIconCircle, isDark && styles.emptyIconCircleDark]}>
            <Search size={32} color="#ea580c" />
          </View>
          <Text style={[styles.emptyTitle, isDark && styles.emptyTitleDark]}>Search Pothole</Text>
          <Text style={[styles.emptySubtitle, isDark && styles.emptySubtitleDark]}>
            Find users, road hazard reports, or hashtags near you
          </Text>
        </View>
      );
    }

    return (
      <View style={[styles.emptyContainer, isDark && styles.emptyContainerDark]}>
        <Text style={[styles.emptyTitle, isDark && styles.emptyTitleDark]}>No results found</Text>
        <Text style={[styles.emptySubtitle, isDark && styles.emptySubtitleDark]}>
          We couldn't find any matches for "{searchQuery}"
        </Text>
      </View>
    );
  };

  const getActiveData = () => {
    if (activeTab === 'users') return users;
    if (activeTab === 'posts') return posts;
    return hashtags;
  };

  return (
    <View style={[styles.container, isDark && styles.containerDark, { paddingTop: Math.max(insets.top, 16) }]}>

      {/* Search Input Bar */}
      <View style={styles.searchContainer}>
        <View 
          style={[styles.searchInputWrapper, isDark && styles.searchInputWrapperDark, isFocused && styles.searchFocused]}
        >
          <Search size={18} color={isFocused ? '#ea580c' : '#94a3b8'} />
          <TextInput
            style={[styles.searchInput, isDark && styles.searchInputDark]}
            placeholder="Search posts, users or hashtags..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onSubmitEditing={() => handleSearch(searchQuery)}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
              <X size={16} color="#64748b" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Sub-tabs Selection */}
      <View style={[styles.tabBar, isDark && styles.tabBarDark]}>
        <TouchableOpacity 
          onPress={() => setActiveTab('users')} 
          style={[styles.tabItem, activeTab === 'users' && styles.tabActive]}
        >
          <Text style={[styles.tabText, activeTab === 'users' && styles.tabTextActive]}>
            Users ({users.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => setActiveTab('posts')} 
          style={[styles.tabItem, activeTab === 'posts' && styles.tabActive]}
        >
          <Text style={[styles.tabText, activeTab === 'posts' && styles.tabTextActive]}>
            Posts ({posts.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => setActiveTab('hashtags')} 
          style={[styles.tabItem, activeTab === 'hashtags' && styles.tabActive]}
        >
          <Text style={[styles.tabText, activeTab === 'hashtags' && styles.tabTextActive]}>
            Hashtags ({hashtags.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Loading Indicator */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#ea580c" />
        </View>
      )}

      {/* Results List */}
      <FlatList
        data={getActiveData()}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          if (activeTab === 'users') return renderUserItem({ item });
          if (activeTab === 'hashtags') return renderHashtagItem({ item });
          return <PostCard post={item} />;
        }}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={[styles.listContent, isDark && styles.listContentDark]}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoIcon: {
    backgroundColor: '#fff7ed',
    padding: 6,
    borderRadius: 8,
  },
  logoText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    marginLeft: 8,
    letterSpacing: -0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: 6,
    marginRight: 12,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
  },
  searchFocused: {
    borderColor: '#ea580c',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
    marginLeft: 10,
    fontWeight: '500',
    paddingVertical: 8,
  },
  clearButton: {
    padding: 4,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginTop: 8,
    backgroundColor: '#ffffff',
  },
  tabItem: {
    paddingBottom: 10,
    marginRight: 24,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#ea580c',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94a3b8',
  },
  tabTextActive: {
    color: '#ea580c',
  },
  loadingContainer: {
    paddingVertical: 16,
  },
  listContent: {
    flexGrow: 1,
    backgroundColor: '#f8fafc',
    paddingBottom: 110,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  userRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  userAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  avatarPlaceholderText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#475569',
  },
  userDetails: {
    marginLeft: 12,
  },
  userDisplayName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  userUsername: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  userFollowers: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
  },
  hashtagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  hashtagRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hashtagIconWrapper: {
    backgroundColor: '#fff7ed',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffedd5',
  },
  hashtagName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
    marginLeft: 12,
  },
  hashtagCount: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    marginTop: 40,
    backgroundColor: '#ffffff',
  },
  emptyIconCircle: {
    backgroundColor: '#fff7ed',
    padding: 16,
    borderRadius: 32,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    maxWidth: 240,
    lineHeight: 18,
  },
  containerDark: {
    backgroundColor: '#0f172a',
  },
  headerDark: {
    borderBottomColor: '#1e293b',
    backgroundColor: '#0f172a',
  },
  logoTextDark: {
    color: '#f8fafc',
  },
  avatarCircleDark: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
  },
  avatarTextDark: {
    color: '#cbd5e1',
  },
  searchInputWrapperDark: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
  },
  searchInputDark: {
    color: '#f8fafc',
  },
  tabBarDark: {
    borderBottomColor: '#1e293b',
    backgroundColor: '#0f172a',
  },
  listContentDark: {
    backgroundColor: '#0f172a',
  },
  userRowDark: {
    borderBottomColor: '#1e293b',
    backgroundColor: '#1e293b',
  },
  userAvatarPlaceholderDark: {
    backgroundColor: '#334155',
    borderColor: '#475569',
  },
  avatarPlaceholderTextDark: {
    color: '#cbd5e1',
  },
  userDisplayNameDark: {
    color: '#f8fafc',
  },
  userUsernameDark: {
    color: '#94a3b8',
  },
  userFollowersDark: {
    color: '#94a3b8',
  },
  hashtagRowDark: {
    borderBottomColor: '#1e293b',
    backgroundColor: '#1e293b',
  },
  hashtagIconWrapperDark: {
    backgroundColor: '#334155',
    borderColor: '#475569',
  },
  hashtagNameDark: {
    color: '#f8fafc',
  },
  hashtagCountDark: {
    color: '#94a3b8',
  },
  emptyContainerDark: {
    backgroundColor: '#0f172a',
  },
  emptyIconCircleDark: {
    backgroundColor: '#334155',
  },
  emptyTitleDark: {
    color: '#f8fafc',
  },
  emptySubtitleDark: {
    color: '#94a3b8',
  },
});
