import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, Alert, StyleSheet, Share } from 'react-native';
import { MessageCircle, MoreHorizontal, MapPin, Flag, ShieldAlert, Trash2, ArrowUp, ArrowDown, Repeat, Forward } from 'lucide-react-native';
import type { PostWithDetails } from '../types';
import { useAuthStore } from '../store/auth-store';
import { likePost, unlikePost, savePost, unsavePost, deletePost, blockUser, updatePostStatus, reportPost, repostPost } from '../services/post';
import { useColorScheme } from '../components/useColorScheme';
import { useVoteStore } from '../store/vote-store';
import { CommentsDrawer } from './CommentsDrawer';
import { supabase } from '../services/supabase';
import { useRouter } from 'expo-router';

import { useMutation, useQueryClient } from '@tanstack/react-query';

interface PostCardProps {
  post: PostWithDetails;
}

export function PostCard({ post }: PostCardProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [isUpvoted, setIsUpvoted] = useState(post.isLiked);
  const [isSaved, setIsSaved] = useState(post.isSaved);
  const [showMenu, setShowMenu] = useState(false);
  const [isCommentsVisible, setIsCommentsVisible] = useState(false);

  const handleProfilePress = () => {
    if (user?.id === post.userId) {
      router.push('/(tabs)/profile');
    } else {
      router.push({
        pathname: '/profile/[username]' as any,
        params: { username: post.author.username }
      });
    }
  };

  const [isReposted, setIsReposted] = useState(false);
  const [repostsCount, setRepostsCount] = useState(post.sharesCount || 0);

  const { downvotedPostIds, togglePostDownvote } = useVoteStore();
  const isDownvoted = downvotedPostIds.includes(post.id);

  const isOwnPost = user?.id === post.userId;

  const handleRepost = () => {
    Alert.alert(
      isReposted ? 'Undo Repost' : 'Repost Hazard Report',
      isReposted ? 'Are you sure you want to undo your repost?' : 'Do you want to repost this hazard report to your feed?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: isReposted ? 'Undo' : 'Repost', 
          onPress: async () => {
            try {
              if (isReposted) {
                setIsReposted(false);
                setRepostsCount(prev => Math.max(0, prev - 1));
                const { data: p } = await supabase.from('posts').select('shares_count').eq('id', post.id).single();
                if (p) {
                  await supabase.from('posts').update({ shares_count: Math.max(0, (p.shares_count || 0) - 1) }).eq('id', post.id);
                }
              } else {
                setIsReposted(true);
                setRepostsCount(prev => prev + 1);
                await repostPost(post.id);
              }
              queryClient.invalidateQueries({ queryKey: ['feed'] });
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Could not process repost');
            }
          }
        }
      ]
    );
  };

  const handleShare = async () => {
    try {
      const appLink = 'https://play.google.com/store/apps/details?id=com.pothole.app';
      await Share.share({
        message: `Check out this road hazard report on Pothole app: ${appLink}\n\n"${post.text || 'Pothole alert!'}"`,
      });
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleUpvote = async () => {
    try {
      if (isUpvoted) {
        setIsUpvoted(false);
        await unlikePost(post.id);
      } else {
        setIsUpvoted(true);
        if (isDownvoted) {
          togglePostDownvote(post.id);
        }
        await likePost(post.id);
      }
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    } catch (err) {
      setIsUpvoted(post.isLiked);
    }
  };

  const handleDownvote = async () => {
    try {
      if (isDownvoted) {
        togglePostDownvote(post.id);
      } else {
        togglePostDownvote(post.id);
        if (isUpvoted) {
          setIsUpvoted(false);
          await unlikePost(post.id);
        }
      }
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    } catch (err) {
      // Revert locally if error
    }
  };

  const getVoteScore = () => {
    let score = post.likesCount;
    if (isUpvoted && !post.isLiked) {
      score += 1;
    } else if (!isUpvoted && post.isLiked) {
      score -= 1;
    }
    if (isDownvoted) {
      score -= 1;
    }
    return score;
  };

  const toggleSave = async () => {
    try {
      if (isSaved) {
        setIsSaved(false);
        await unsavePost(post.id);
      } else {
        setIsSaved(true);
        await savePost(post.id);
      }
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    } catch (err) {
      setIsSaved(post.isSaved);
    }
  };

  const handleDelete = async () => {
    setShowMenu(false);
    Alert.alert('Delete Post', 'Are you sure you want to delete this hazard report?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePost(post.id);
            queryClient.invalidateQueries({ queryKey: ['feed'] });
            queryClient.invalidateQueries({ queryKey: ['explore-map'] });
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Could not delete post');
          }
        },
      },
    ]);
  };

  const handleBlockUser = async () => {
    setShowMenu(false);
    Alert.alert('Block User', `Are you sure you want to block @${post.author.username}? You will no longer see their reports.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: async () => {
          try {
            await blockUser(post.author.id);
            queryClient.invalidateQueries({ queryKey: ['feed'] });
            queryClient.invalidateQueries({ queryKey: ['explore-map'] });
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Could not block user');
          }
        },
      },
    ]);
  };

  const handleUpdateStatus = async (newStatus: 'unresolved' | 'in_progress' | 'resolved') => {
    setShowMenu(false);
    try {
      await updatePostStatus(post.id, newStatus);
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['explore-map'] });
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not update status');
    }
  };

  const handleReportPost = async () => {
    setShowMenu(false);
    Alert.alert(
      'Report Post',
      'Select a reason for reporting this post:',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Spam', 
          onPress: () => submitReport('spam') 
        },
        { 
          text: 'Harassment', 
          onPress: () => submitReport('harassment') 
        },
        { 
          text: 'Inappropriate Content', 
          onPress: () => submitReport('other') 
        }
      ],
      { cancelable: true }
    );
  };

  const submitReport = async (reason: 'spam' | 'hate_speech' | 'harassment' | 'nudity' | 'violence' | 'other') => {
    try {
      await reportPost(post.id, reason);
      Alert.alert('Report Submitted', 'Thank you for reporting this post. We will review it shortly.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not submit report');
    }
  };

  const theme = useColorScheme();
  const isDark = theme === 'dark';

  const statusColors = {
    unresolved: {
      bg: isDark ? '#78350f' : '#fef3c7',
      text: isDark ? '#fef3c7' : '#b45309',
    },
    in_progress: {
      bg: isDark ? '#1e3a8a' : '#dbeafe',
      text: isDark ? '#dbeafe' : '#1d4ed8',
    },
    resolved: {
      bg: isDark ? '#064e3b' : '#d1fae5',
      text: isDark ? '#d1fae5' : '#047857',
    },
  };

  const statusLabel = {
    unresolved: 'Unresolved',
    in_progress: 'In Progress',
    resolved: 'Resolved',
  };

  return (
    <View 
      style={[
        styles.cardContainer,
        isDark && styles.cardContainerDark,
        showMenu ? { zIndex: 10, elevation: 10 } : { zIndex: 1 }
      ]}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity 
          onPress={handleProfilePress} 
          style={styles.headerLeft}
          activeOpacity={0.7}
        >
          <Image
            source={{ uri: post.author.avatarUrl || 'https://via.placeholder.com/150' }}
            style={styles.avatar}
          />
          <View style={styles.authorInfo}>
            <Text style={[styles.authorName, isDark && styles.authorNameDark]}>{post.author.displayName}</Text>
            <Text style={[styles.username, isDark && styles.usernameDark]}>@{post.author.username}</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.headerRight}>
          {/* Status Badge */}
          <View style={[styles.statusBadge, { backgroundColor: statusColors[post.status].bg }]}>
            <Text style={[styles.statusText, { color: statusColors[post.status].text }]}>
              {statusLabel[post.status]}
            </Text>
          </View>
          <TouchableOpacity 
            onPress={() => setShowMenu(!showMenu)} 
            style={styles.moreButton}
            accessibilityLabel="More actions"
            testID="more-actions-button"
          >
            <MoreHorizontal size={18} color={isDark ? '#cbd5e1' : '#64748b'} />
          </TouchableOpacity>

          {/* Floating actions menu */}
          {showMenu && (
            <View style={[styles.menuContainer, isDark && styles.menuContainerDark]}>
              {isOwnPost ? (
                <>
                  {post.status !== 'unresolved' && (
                    <TouchableOpacity 
                      onPress={() => handleUpdateStatus('unresolved')} 
                      style={styles.menuItem}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.bulletDot, styles.bulletAmber]} />
                      <Text style={[styles.menuText, isDark && styles.menuTextDark]}>Mark Unresolved</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity 
                    onPress={() => handleUpdateStatus('in_progress')} 
                    style={styles.menuItem}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.bulletDot, styles.bulletBlue]} />
                    <Text style={[styles.menuText, isDark && styles.menuTextDark]}>Mark In Progress</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    onPress={() => handleUpdateStatus('resolved')} 
                    style={styles.menuItem}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.bulletDot, styles.bulletEmerald]} />
                    <Text style={[styles.menuText, isDark && styles.menuTextDark]}>Mark Resolved</Text>
                  </TouchableOpacity>
                  
                  <View style={[styles.menuItemSeparator, isDark && styles.menuItemSeparatorDark]} />
                  
                  <TouchableOpacity 
                    onPress={handleDelete} 
                    style={styles.menuItem}
                    activeOpacity={0.7}
                  >
                    <View style={styles.iconWrapper}>
                      <Trash2 size={16} color="#ef4444" />
                    </View>
                    <Text style={[styles.menuText, styles.menuTextDanger]}>Delete Post</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity 
                    onPress={handleReportPost} 
                    style={styles.menuItem}
                    activeOpacity={0.7}
                  >
                    <View style={styles.iconWrapper}>
                      <Flag size={16} color={isDark ? '#cbd5e1' : '#64748b'} />
                    </View>
                    <Text style={[styles.menuText, isDark && styles.menuTextDark]}>Report</Text>
                  </TouchableOpacity>
                  
                  <View style={[styles.menuItemSeparator, isDark && styles.menuItemSeparatorDark]} />
                  
                  <TouchableOpacity 
                    onPress={handleBlockUser} 
                    style={styles.menuItem}
                    activeOpacity={0.7}
                  >
                    <View style={styles.iconWrapper}>
                      <ShieldAlert size={16} color="#ef4444" />
                    </View>
                    <Text style={[styles.menuText, styles.menuTextDanger]}>Block User</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
        </View>
      </View>

      {/* Location tag if attached */}
      {post.location && (
        <View style={styles.locationTag}>
          <MapPin size={13} color="#ea580c" />
          <Text style={[styles.locationText, isDark && styles.locationTextDark]}>
            {post.location.placeName || `${post.location.latitude.toFixed(4)}, ${post.location.longitude.toFixed(4)}`}
          </Text>
        </View>
      )}

      {/* Content Text */}
      {post.text && (
        <Text style={[styles.contentText, isDark && styles.contentTextDark]}>{post.text}</Text>
      )}

      {/* Media Image Gallery */}
      {post.media && post.media.length > 0 && (
        <Image
          source={{ uri: post.media[0].url }}
          style={[styles.postImage, isDark && styles.postImageDark]}
        />
      )}

      {/* Divider */}
      <View style={[styles.divider, isDark && styles.dividerDark]} />

      {/* Actions Toolbar */}
      <View style={styles.toolbar}>
        {/* Capsule 1: Upvote & Downvote */}
        <View style={[styles.capsule, isDark && styles.capsuleDark, { flexDirection: 'row', alignItems: 'center' }]}>
          <TouchableOpacity 
            onPress={handleUpvote} 
            style={styles.capsuleIconBtn}
            testID="upvote-button"
          >
            <ArrowUp size={16} color={isUpvoted ? '#ea580c' : (isDark ? '#cbd5e1' : '#0f172a')} strokeWidth={2.5} />
          </TouchableOpacity>
          <Text style={[
            styles.capsuleText, 
            isDark && styles.capsuleTextDark, 
            isUpvoted && { color: '#ea580c', fontWeight: '700' },
            isDownvoted && { color: '#ef4444', fontWeight: '700' }
          ]}>
            {getVoteScore()}
          </Text>
          <TouchableOpacity 
            onPress={handleDownvote} 
            style={styles.capsuleIconBtn}
            testID="downvote-button"
          >
            <ArrowDown size={16} color={isDownvoted ? '#ef4444' : (isDark ? '#cbd5e1' : '#0f172a')} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        {/* Capsule 2: Comments */}
        <TouchableOpacity 
          onPress={() => setIsCommentsVisible(true)} 
          style={[styles.capsule, isDark && styles.capsuleDark, { flexDirection: 'row', alignItems: 'center' }]}
        >
          <MessageCircle size={16} color={isDark ? '#cbd5e1' : '#0f172a'} />
          <Text style={[styles.capsuleText, isDark && styles.capsuleTextDark]}>{post.commentsCount}</Text>
        </TouchableOpacity>

        {/* Capsule 3: Repost */}
        <TouchableOpacity 
          onPress={handleRepost}
          style={[styles.capsule, isDark && styles.capsuleDark, { flexDirection: 'row', alignItems: 'center' }]}
          testID="repost-button"
        >
          <Repeat size={16} color={isReposted ? '#ea580c' : (isDark ? '#cbd5e1' : '#0f172a')} />
          {repostsCount > 0 && (
            <Text style={[
              styles.capsuleText, 
              isDark && styles.capsuleTextDark,
              isReposted && { color: '#ea580c', fontWeight: '700' }
            ]}>
              {repostsCount}
            </Text>
          )}
        </TouchableOpacity>

        {/* Capsule 4: Share */}
        <TouchableOpacity 
          onPress={handleShare}
          style={[styles.capsule, isDark && styles.capsuleDark, { flexDirection: 'row', alignItems: 'center' }]}
          testID="share-button"
        >
          <Forward size={16} color={isDark ? '#cbd5e1' : '#0f172a'} />
          <Text style={[styles.capsuleText, isDark && styles.capsuleTextDark, { fontWeight: '700' }]}>Share</Text>
        </TouchableOpacity>
      </View>

      <CommentsDrawer
        visible={isCommentsVisible}
        onClose={() => setIsCommentsVisible(false)}
        postId={post.id}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    marginBottom: 16,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardContainerDark: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e2e8f0',
  },
  authorInfo: {
    marginLeft: 10,
  },
  authorName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  authorNameDark: {
    color: '#f8fafc',
  },
  username: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  usernameDark: {
    color: '#94a3b8',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  moreButton: {
    padding: 6,
    marginLeft: 6,
  },
  locationTag: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  locationText: {
    fontSize: 12,
    color: '#64748b',
    marginLeft: 6,
    fontWeight: '500',
  },
  locationTextDark: {
    color: '#94a3b8',
  },
  contentText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
    marginBottom: 12,
  },
  contentTextDark: {
    color: '#cbd5e1',
  },
  postImage: {
    width: '100%',
    height: 220,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#f1f5f9',
  },
  postImageDark: {
    backgroundColor: '#334155',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginBottom: 12,
  },
  dividerDark: {
    backgroundColor: '#334155',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  capsule: {
    backgroundColor: '#eef2f6',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  capsuleDark: {
    backgroundColor: '#334155',
  },
  capsuleText: {
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '600',
    marginHorizontal: 8,
  },
  capsuleTextDark: {
    color: '#cbd5e1',
  },
  capsuleIconBtn: {
    padding: 2,
  },
  menuContainer: {
    position: 'absolute',
    right: 0,
    top: 32,
    zIndex: 100,
    width: 172,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
  },
  menuContainerDark: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  menuItemSeparator: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 4,
  },
  menuItemSeparatorDark: {
    backgroundColor: '#334155',
  },
  bulletDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  bulletAmber: {
    backgroundColor: '#f59e0b',
  },
  bulletBlue: {
    backgroundColor: '#3b82f6',
  },
  bulletEmerald: {
    backgroundColor: '#10b981',
  },
  iconWrapper: {
    marginRight: 8,
  },
  menuText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  menuTextDark: {
    color: '#f8fafc',
  },
  menuTextDanger: {
    color: '#ef4444',
  },
});

