import React, { useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet, RefreshControl, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from '../../components/useColorScheme';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../services/supabase';
import { Bell } from 'lucide-react-native';

export default function NotificationsScreen() {
  const theme = useColorScheme();
  const isDark = theme === 'dark';

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          actor:profiles!notifications_actor_id_fkey(id, username, display_name, avatar_url)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);
      return data || [];
    },
  });

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const notifications = data || [];

  if (isLoading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: isDark ? '#0f172a' : '#f8fafc' }]}>
        <ActivityIndicator size="large" color="#ea580c" />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#0f172a' : '#f8fafc' }]}>
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={handleRefresh} 
            colors={['#ea580c']} 
            tintColor={isDark ? '#ea580c' : '#64748b'}
          />
        }
        renderItem={({ item }) => (
          <View style={[styles.notificationRow, isDark && styles.notificationRowDark]}>
            <View style={[styles.iconWrapper, isDark && styles.iconWrapperDark]}>
              <Bell size={18} color="#ea580c" />
            </View>
            <View style={styles.textContainer}>
              <Text style={[styles.descText, { color: isDark ? '#cbd5e1' : '#374151' }]}>
                <Text style={[styles.usernameText, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                  @{item.actor?.username || 'user'}{' '}
                </Text>
                {item.type === 'like' && 'liked your hazard report.'}
                {item.type === 'comment' && 'commented on your report.'}
                {item.type === 'follow' && 'started following you.'}
              </Text>
              <Text style={styles.timeText}>
                {new Date(item.created_at).toLocaleDateString()}
              </Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Bell size={40} color={isDark ? '#475569' : '#cbd5e1'} />
            <Text style={[styles.emptyTitle, isDark && styles.textLight]}>No alerts yet</Text>
            <Text style={[styles.emptySubtitle, isDark && styles.textMuted]}>
              Activity related to your posts will appear here.
            </Text>
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
  listContent: {
    paddingBottom: 110,
    flexGrow: 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  notificationRowDark: {
    backgroundColor: '#1e293b',
    borderBottomColor: '#334155',
  },
  iconWrapper: {
    backgroundColor: '#fff7ed',
    padding: 8,
    borderRadius: 9999,
  },
  iconWrapperDark: {
    backgroundColor: '#334155',
  },
  textContainer: {
    flex: 1,
    marginLeft: 12,
  },
  descText: {
    fontSize: 14,
    lineHeight: 20,
  },
  usernameText: {
    fontWeight: '700',
  },
  timeText: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#64748b',
    marginTop: 12,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
  },
  textLight: {
    color: '#f8fafc',
  },
  textMuted: {
    color: '#94a3b8',
  },
});
