import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, Alert, StyleSheet, Share, Linking, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MessageCircle, MoreHorizontal, MapPin, Flag, ShieldAlert, Trash2, ArrowUp, ArrowDown, Repeat, Forward, X } from 'lucide-react-native';
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
  const insets = useSafeAreaInsets();

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

  const handleLocationPress = () => {
    if (post.location?.latitude != null && post.location?.longitude != null) {
      const url = `https://www.google.com/maps/search/?api=1&query=${post.location.latitude},${post.location.longitude}`;
      Linking.openURL(url).catch((err) => {
        console.warn('Failed to open Google Maps url:', err);
        Alert.alert('Error', 'Unable to open Google Maps.');
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

  const handlePostPress = () => {
    router.push({
      pathname: '/post/[id]' as any,
      params: { id: post.id }
    });
  };

  const renderMedia = () => {
    if (!post.media || post.media.length === 0) return null;
    
    const media = post.media;
    const count = media.length;

    if (count === 1) {
      return (
        <TouchableOpacity onPress={handlePostPress} activeOpacity={0.9} style={{ marginBottom: 12 }}>
          <Image
            source={{ uri: media[0].url }}
            style={[styles.postImage, isDark && styles.postImageDark]}
          />
        </TouchableOpacity>
      );
    }

    if (count === 2) {
      return (
        <TouchableOpacity onPress={handlePostPress} activeOpacity={0.9} style={[styles.collageContainer, { marginBottom: 12 }]}>
          <View style={styles.collageRow}>
            <Image source={{ uri: media[0].url }} style={styles.collageHalfImage} />
            <View style={{ width: 4 }} />
            <Image source={{ uri: media[1].url }} style={styles.collageHalfImage} />
          </View>
        </TouchableOpacity>
      );
    }

    if (count === 3) {
      return (
        <TouchableOpacity onPress={handlePostPress} activeOpacity={0.9} style={[styles.collageContainer, { marginBottom: 12 }]}>
          <View style={styles.collageRow}>
            <Image source={{ uri: media[0].url }} style={styles.collageMainImage} />
            <View style={{ width: 4 }} />
            <View style={styles.collageSideCol}>
              <Image source={{ uri: media[1].url }} style={styles.collageSideImage} />
              <View style={{ height: 4 }} />
              <Image source={{ uri: media[2].url }} style={styles.collageSideImage} />
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    // 4 or more images
    return (
      <TouchableOpacity onPress={handlePostPress} activeOpacity={0.9} style={[styles.collageContainer, { marginBottom: 12 }]}>
        <View style={styles.collageGrid}>
          <View style={styles.collageRow}>
            <Image source={{ uri: media[0].url }} style={styles.collageQuarterImage} />
            <View style={{ width: 4 }} />
            <Image source={{ uri: media[1].url }} style={styles.collageQuarterImage} />
          </View>
          <View style={{ height: 4 }} />
          <View style={styles.collageRow}>
            <Image source={{ uri: media[2].url }} style={styles.collageQuarterImage} />
            <View style={{ width: 4 }} />
            <View style={styles.collageQuarterImageContainer}>
              <Image source={{ uri: media[3].url }} style={styles.collageQuarterImage} />
              {count > 4 && (
                <View style={styles.collageOverlay}>
                  <Text style={styles.collageOverlayText}>+{count - 3}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
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

          {/* Bottom sheet actions menu */}
          <Modal
            visible={showMenu}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowMenu(false)}
          >
            <View style={styles.sheetOverlay}>
              <TouchableOpacity
                style={StyleSheet.absoluteFill}
                activeOpacity={1}
                onPress={() => setShowMenu(false)}
              />
              <View style={[
                styles.sheetContent,
                isDark && styles.sheetContentDark,
                { paddingBottom: Math.max(insets.bottom, 16) }
              ]}>
                <View style={styles.sheetHeaderIndicator} />
                <Text style={[styles.sheetTitle, isDark && styles.sheetTitleDark]}>Post Options</Text>
                
                {isOwnPost ? (
                  <>
                    {post.status !== 'unresolved' && (
                      <TouchableOpacity 
                        onPress={() => handleUpdateStatus('unresolved')} 
                        style={styles.sheetItem}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.bulletDot, styles.bulletAmber]} />
                        <Text style={[styles.sheetItemText, isDark && styles.textLight]}>Mark Unresolved</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity 
                      onPress={() => handleUpdateStatus('in_progress')} 
                      style={styles.sheetItem}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.bulletDot, styles.bulletBlue]} />
                      <Text style={[styles.sheetItemText, isDark && styles.textLight]}>Mark In Progress</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      onPress={() => handleUpdateStatus('resolved')} 
                      style={styles.sheetItem}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.bulletDot, styles.bulletEmerald]} />
                      <Text style={[styles.sheetItemText, isDark && styles.textLight]}>Mark Resolved</Text>
                    </TouchableOpacity>
                    
                    <View style={[styles.sheetSeparator, isDark && styles.sheetSeparatorDark]} />
                    
                    <TouchableOpacity 
                      onPress={handleDelete} 
                      style={styles.sheetItem}
                      activeOpacity={0.7}
                    >
                      <Trash2 size={18} color="#ef4444" style={{ marginRight: 12 }} />
                      <Text style={[styles.sheetItemText, styles.menuTextDanger]}>Delete Post</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity 
                      onPress={handleReportPost} 
                      style={styles.sheetItem}
                      activeOpacity={0.7}
                    >
                      <Flag size={18} color={isDark ? '#cbd5e1' : '#64748b'} style={{ marginRight: 12 }} />
                      <Text style={[styles.sheetItemText, isDark && styles.textLight]}>Report</Text>
                    </TouchableOpacity>
                    
                    <View style={[styles.sheetSeparator, isDark && styles.sheetSeparatorDark]} />
                    
                    <TouchableOpacity 
                      onPress={handleBlockUser} 
                      style={styles.sheetItem}
                      activeOpacity={0.7}
                    >
                      <ShieldAlert size={18} color="#ef4444" style={{ marginRight: 12 }} />
                      <Text style={[styles.sheetItemText, styles.menuTextDanger]}>Block User</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          </Modal>
        </View>
      </View>

      {/* Location tag if attached */}
      {post.location && (
        <TouchableOpacity 
          style={styles.locationTag} 
          onPress={handleLocationPress}
          activeOpacity={0.7}
        >
          <MapPin size={13} color="#ea580c" />
          <Text style={[styles.locationText, isDark && styles.locationTextDark]}>
            {post.location.placeName 
              ? `${post.location.placeName} (${post.location.latitude.toFixed(4)}, ${post.location.longitude.toFixed(4)})` 
              : `${post.location.latitude.toFixed(4)}, ${post.location.longitude.toFixed(4)}`}
          </Text>
        </TouchableOpacity>
      )}

      {/* Content Text */}
      {post.text && (
        <TouchableOpacity onPress={handlePostPress} activeOpacity={0.8} style={{ marginBottom: 12 }}>
          <Text style={[styles.contentText, isDark && styles.contentTextDark]}>{post.text}</Text>
        </TouchableOpacity>
      )}

      {/* Media Image Gallery/Collage */}
      {renderMedia()}

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
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  sheetContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  sheetContentDark: {
    backgroundColor: '#1e293b',
  },
  sheetHeaderIndicator: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#cbd5e1',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
    textAlign: 'center',
  },
  sheetTitleDark: {
    color: '#f8fafc',
  },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  sheetItemText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
  },
  sheetSeparator: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 4,
  },
  sheetSeparatorDark: {
    backgroundColor: '#334155',
  },
  textLight: {
    color: '#f8fafc',
  },
  bulletDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
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
  menuTextDanger: {
    color: '#ef4444',
  },
  collageContainer: {
    width: '100%',
    borderRadius: 8,
    overflow: 'hidden',
  },
  collageRow: {
    flexDirection: 'row',
    height: 200,
    width: '100%',
  },
  collageHalfImage: {
    flex: 1,
    height: '100%',
  },
  collageMainImage: {
    flex: 1.5,
    height: '100%',
  },
  collageSideCol: {
    flex: 1,
    height: '100%',
    flexDirection: 'column',
  },
  collageSideImage: {
    flex: 1,
    width: '100%',
  },
  collageGrid: {
    width: '100%',
    height: 240,
    flexDirection: 'column',
  },
  collageQuarterImage: {
    flex: 1,
    height: '100%',
  },
  collageQuarterImageContainer: {
    flex: 1,
    position: 'relative',
    height: '100%',
  },
  collageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  collageOverlayText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
  },
});

