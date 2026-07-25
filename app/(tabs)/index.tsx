import React, { useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, RefreshControl, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from '../../components/useColorScheme';
import { useInfiniteQuery } from '@tanstack/react-query';
import { getFeedPosts } from '../../services/post';
import { PostCard } from '../../components/PostCard';

export default function FeedScreen() {
  const theme = useColorScheme();
  const isDark = theme === 'dark';

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['feed'],
    queryFn: async ({ pageParam }) => {
      return getFeedPosts(pageParam as string | undefined);
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: undefined as string | undefined,
  });

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleLoadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const posts = data?.pages.flatMap((page) => page.data) ?? [];

  if (isLoading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: isDark ? '#0f172a' : '#f8fafc' }]}>
        <ActivityIndicator size="large" color="#ea580c" />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: isDark ? '#0f172a' : '#f8fafc', padding: 24 }]}>
        <Text style={[styles.errorTitle, isDark && styles.textLight]}>Failed to load feed</Text>
        <Text style={[styles.errorSubtitle, isDark && styles.textMuted]}>{error?.message || 'Something went wrong.'}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#0f172a' : '#f8fafc' }]}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <PostCard post={item} />}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={handleRefresh} 
            colors={['#ea580c']} 
            tintColor={isDark ? '#ea580c' : '#64748b'}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          isFetchingNextPage ? (
            <ActivityIndicator size="small" color="#ea580c" style={styles.footerLoader} />
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyTitle, isDark && styles.textLight]}>No reports yet</Text>
            <Text style={[styles.emptySubtitle, isDark && styles.textMuted]}>Be the first to report a road hazard!</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? 16 : 8,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 110,
    flexGrow: 1,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ef4444',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorSubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
  },
  footerLoader: {
    marginVertical: 16,
  },
  textLight: {
    color: '#f8fafc',
  },
  textMuted: {
    color: '#94a3b8',
  },
});
