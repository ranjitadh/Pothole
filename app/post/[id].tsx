import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, ActivityIndicator, Alert, StyleSheet, TextInput, Dimensions, KeyboardAvoidingView, Platform, Keyboard, Linking } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, MapPin, MessageCircle, Send, ArrowUp, ArrowDown, Repeat, Forward, ShieldAlert, Trash2, Flag, CornerDownRight, X } from 'lucide-react-native';
import { useAuthStore } from '../../store/auth-store';
import { useVoteStore } from '../../store/vote-store';
import { useColorScheme } from '../../components/useColorScheme';
import { getPostById, getComments, createComment, deleteComment, likePost, unlikePost, savePost, unsavePost, deletePost, blockUser, reportPost, repostPost } from '../../services/post';
import type { PostWithDetails, CommentWithDetails } from '../../types';
import { supabase } from '../../services/supabase';

const { width: screenWidth } = Dimensions.get('window');

export default function PostDetailScreen() {
  const { id: postId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { profile, user } = useAuthStore();
  const theme = useColorScheme();
  const isDark = theme === 'dark';
  const insets = useSafeAreaInsets();
  
  const [commentText, setCommentText] = useState('');
  const [replyTarget, setReplyTarget] = useState<{ id: string; username: string } | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  
  const commentInputRef = useRef<TextInput | null>(null);
  const scrollViewRef = useRef<ScrollView | null>(null);

  const { data: post, isLoading: isPostLoading, error: postError } = useQuery({
    queryKey: ['post', postId],
    queryFn: () => getPostById(postId),
    enabled: !!postId,
  });

  const { data: comments = [], isLoading: isCommentsLoading } = useQuery({
    queryKey: ['comments', postId],
    queryFn: () => getComments(postId),
    enabled: !!postId,
  });

  const { isCommentUpvoted, isCommentDownvoted, toggleCommentUpvote, toggleCommentDownvote } = useVoteStore();

  // Map likes and saves local state based on query data
  const [isUpvoted, setIsUpvoted] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [repostsCount, setRepostsCount] = useState(0);
  const [isReposted, setIsReposted] = useState(false);

  useEffect(() => {
    if (post) {
      setIsUpvoted(post.isLiked);
      setIsSaved(post.isSaved);
      setRepostsCount(post.sharesCount || 0);
    }
  }, [post]);

  const { downvotedPostIds, togglePostDownvote } = useVoteStore();
  const isDownvoted = post ? downvotedPostIds.includes(post.id) : false;

  const isOwnPost = post ? (user?.id === post.userId) : false;

  const createCommentMutation = useMutation({
    mutationFn: (text: string) => createComment(postId, text, replyTarget?.id),
    onSuccess: () => {
      setCommentText('');
      setReplyTarget(null);
      Keyboard.dismiss();
      queryClient.invalidateQueries({ queryKey: ['comments', postId] });
      queryClient.invalidateQueries({ queryKey: ['post', postId] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Could not post comment');
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: deleteComment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', postId] });
      queryClient.invalidateQueries({ queryKey: ['post', postId] });
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Could not delete comment');
    },
  });

  const handleSendComment = () => {
    if (!commentText.trim()) return;
    createCommentMutation.mutate(commentText.trim());
  };

  const handleReplyPress = (comment: CommentWithDetails) => {
    setReplyTarget({ id: comment.id, username: comment.author.username });
    if (commentInputRef.current) {
      commentInputRef.current.focus();
    }
  };

  const handleDeleteComment = (commentId: string) => {
    Alert.alert('Delete Comment', 'Are you sure you want to delete this comment?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteCommentMutation.mutate(commentId) },
    ]);
  };

  const handleUpvote = async () => {
    if (!post) return;
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
      queryClient.invalidateQueries({ queryKey: ['post', postId] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    } catch (err) {
      setIsUpvoted(post.isLiked);
    }
  };

  const handleDownvote = async () => {
    if (!post) return;
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
      queryClient.invalidateQueries({ queryKey: ['post', postId] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    } catch (err) {
      // Revert locally if error
    }
  };

  const handleLocationPress = () => {
    if (post?.location?.latitude != null && post?.location?.longitude != null) {
      const url = `https://www.google.com/maps/search/?api=1&query=${post.location.latitude},${post.location.longitude}`;
      Linking.openURL(url).catch((err) => {
        console.warn('Failed to open Google Maps url:', err);
        Alert.alert('Error', 'Unable to open Google Maps.');
      });
    }
  };

  const handleRepost = () => {
    if (!post) return;
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
              queryClient.invalidateQueries({ queryKey: ['post', postId] });
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
    if (!post) return;
    try {
      const appLink = 'https://play.google.com/store/apps/details?id=com.pothole.app';
      await Forward.share({
        message: `Check out this road hazard report on Pothole app: ${appLink}\n\n"${post.text || 'Pothole alert!'}"`,
      });
    } catch (error: any) {
      // Manual share logic if needed or print error
    }
  };

  const handleDeletePost = async () => {
    if (!post) return;
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
            router.back();
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Could not delete post');
          }
        },
      },
    ]);
  };

  const handleBlockUser = async () => {
    if (!post) return;
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
            router.back();
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Could not block user');
          }
        },
      },
    ]);
  };

  const getVoteScore = () => {
    if (!post) return 0;
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

  if (isPostLoading) {
    return (
      <View style={[styles.loadingContainer, isDark && styles.containerDark]}>
        <ActivityIndicator size="large" color="#ea580c" />
      </View>
    );
  }

  if (postError || !post) {
    return (
      <View style={[styles.errorContainer, isDark && styles.containerDark]}>
        <Text style={[styles.errorText, isDark && styles.textLight]}>Error loading report details or post deleted.</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Build comments tree
  const buildCommentsTree = (list: CommentWithDetails[]) => {
    const map = new Map<string, CommentWithDetails & { replies: CommentWithDetails[] }>();
    const roots: CommentWithDetails[] = [];

    list.forEach((c) => {
      map.set(c.id, { ...c, replies: [] });
    });

    list.forEach((c) => {
      const mapped = map.get(c.id)!;
      if (c.parentId && map.has(c.parentId)) {
        map.get(c.parentId)!.replies.push(mapped);
      } else {
        roots.push(mapped);
      }
    });

    // Flatten tree to render replies inline with left indent
    const flattened: { comment: CommentWithDetails; level: number }[] = [];
    const traverse = (node: CommentWithDetails & { replies: CommentWithDetails[] }, level: number) => {
      flattened.push({ comment: node, level });
      node.replies.forEach((child: any) => traverse(child, level + 1));
    };

    roots.forEach((root: any) => traverse(root, 0));
    return flattened;
  };

  const flatCommentsList = buildCommentsTree(comments);

  const handleImageScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / screenWidth);
    setActiveImageIndex(index);
  };

  const statusColors = {
    unresolved: { bg: isDark ? '#78350f' : '#fef3c7', text: isDark ? '#fef3c7' : '#b45309' },
    in_progress: { bg: isDark ? '#1e3a8a' : '#dbeafe', text: isDark ? '#dbeafe' : '#1d4ed8' },
    resolved: { bg: isDark ? '#064e3b' : '#d1fae5', text: isDark ? '#d1fae5' : '#047857' },
  };

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={[styles.header, isDark && styles.headerDark]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <ArrowLeft size={22} color={isDark ? '#f8fafc' : '#0f172a'} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isDark && styles.textLight]}>Report Detail</Text>
        <View style={styles.headerRightSpace}>
          {isOwnPost ? (
            <TouchableOpacity onPress={handleDeletePost} style={styles.deletePostBtn}>
              <Trash2 size={20} color="#ef4444" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={handleBlockUser} style={styles.deletePostBtn}>
              <ShieldAlert size={20} color="#cbd5e1" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView 
          ref={scrollViewRef}
          style={styles.scroll} 
          contentContainerStyle={styles.scrollContent}
        >
          {/* Author Header Card */}
          <View style={styles.authorCard}>
            <Image 
              source={{ uri: post.author.avatarUrl || 'https://via.placeholder.com/150' }} 
              style={styles.avatar} 
            />
            <View style={styles.authorInfo}>
              <Text style={[styles.authorDisplayName, isDark && styles.textLight]}>{post.author.displayName}</Text>
              <Text style={[styles.authorUsername, isDark && styles.textMuted]}>@{post.author.username}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusColors[post.status].bg }]}>
              <Text style={[styles.statusText, { color: statusColors[post.status].text }]}>
                {post.status.toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Location Tag */}
          {post.location && (
            <TouchableOpacity style={[styles.locationTag, isDark && styles.locationTagDark]} onPress={handleLocationPress}>
              <MapPin size={16} color="#ea580c" />
              <Text style={styles.locationText} numberOfLines={2}>
                {post.location.placeName || `${post.location.latitude.toFixed(4)}, ${post.location.longitude.toFixed(4)}`}
              </Text>
            </TouchableOpacity>
          )}

          {/* Description Text */}
          {post.text && (
            <Text style={[styles.description, isDark && styles.textLight]}>{post.text}</Text>
          )}

          {/* Swipeable Multi-Image Viewer */}
          {post.media && post.media.length > 0 && (
            <View style={styles.mediaContainer}>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={handleImageScroll}
                scrollEventThrottle={16}
                style={styles.imageScroll}
              >
                {post.media.map((img) => (
                  <Image 
                    key={img.id} 
                    source={{ uri: img.url }} 
                    style={styles.postImage} 
                    resizeMode="cover"
                  />
                ))}
              </ScrollView>
              
              {/* Pagination Dots */}
              {post.media.length > 1 && (
                <View style={styles.dotsContainer}>
                  {post.media.map((_, idx) => (
                    <View 
                      key={idx} 
                      style={[
                        styles.dot, 
                        activeImageIndex === idx ? styles.activeDot : styles.inactiveDot
                      ]} 
                    />
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Toolbar Actions */}
          <View style={[styles.toolbar, isDark && styles.toolbarDark]}>
            <View style={[styles.toolbarCapsule, isDark && styles.toolbarCapsuleDark]}>
              <TouchableOpacity onPress={handleUpvote} style={styles.voteBtn}>
                <ArrowUp size={18} color={isUpvoted ? '#ea580c' : (isDark ? '#cbd5e1' : '#0f172a')} strokeWidth={2.5} />
              </TouchableOpacity>
              <Text style={[styles.scoreText, isDark && styles.textLight, isUpvoted && { color: '#ea580c' }]}>
                {getVoteScore()}
              </Text>
              <TouchableOpacity onPress={handleDownvote} style={styles.voteBtn}>
                <ArrowDown size={18} color={isDownvoted ? '#ef4444' : (isDark ? '#cbd5e1' : '#0f172a')} strokeWidth={2.5} />
              </TouchableOpacity>
            </View>

            <View style={[styles.toolbarCapsule, isDark && styles.toolbarCapsuleDark]}>
              <MessageCircle size={18} color={isDark ? '#cbd5e1' : '#0f172a'} />
              <Text style={[styles.toolbarCount, isDark && styles.textLight]}>{comments.length}</Text>
            </View>

            <TouchableOpacity 
              onPress={handleRepost}
              style={[styles.toolbarCapsule, isDark && styles.toolbarCapsuleDark]}
            >
              <Repeat size={18} color={isReposted ? '#ea580c' : (isDark ? '#cbd5e1' : '#0f172a')} />
              {repostsCount > 0 && <Text style={[styles.toolbarCount, isDark && styles.textLight]}>{repostsCount}</Text>}
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={handleShare}
              style={[styles.toolbarCapsule, isDark && styles.toolbarCapsuleDark]}
            >
              <Forward size={18} color={isDark ? '#cbd5e1' : '#0f172a'} />
              <Text style={[styles.toolbarCount, isDark && styles.textLight]}>Share</Text>
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={[styles.divider, isDark && styles.dividerDark]} />

          {/* Inline Comments Header */}
          <Text style={[styles.commentsHeaderTitle, isDark && styles.textLight]}>
            Comments ({comments.length})
          </Text>

          {/* Comments List */}
          {isCommentsLoading ? (
            <ActivityIndicator size="small" color="#ea580c" style={{ marginTop: 24 }} />
          ) : flatCommentsList.length === 0 ? (
            <View style={styles.noCommentsContainer}>
              <Text style={[styles.noCommentsText, isDark && styles.textMuted]}>No comments yet.</Text>
              <Text style={[styles.noCommentsSubtext, isDark && styles.textMuted]}>Be the first to share your thoughts!</Text>
            </View>
          ) : (
            flatCommentsList.map(({ comment, level }) => {
              const isOwnComment = user?.id === comment.userId;
              const isUp = isCommentUpvoted(comment.id);
              const isDown = isCommentDownvoted(comment.id);
              
              const commentScore = () => {
                let score = comment.likesCount || 0;
                if (isUp) score += 1;
                if (isDown) score -= 1;
                return score;
              };

              return (
                <View 
                  key={comment.id} 
                  style={[
                    styles.commentItem, 
                    isDark && styles.commentItemDark,
                    { marginLeft: Math.min(level * 24, 72) }
                  ]}
                >
                  {level > 0 && (
                    <View style={styles.replyBranchLine}>
                      <CornerDownRight size={12} color="#ea580c" />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    {/* Comment Header */}
                    <View style={styles.commentHeader}>
                      <Image 
                        source={{ uri: comment.author.avatarUrl || 'https://via.placeholder.com/150' }} 
                        style={styles.commentAvatar} 
                      />
                      <View style={styles.commentAuthorInfo}>
                        <Text style={[styles.commentAuthorName, isDark && styles.textLight]}>{comment.author.displayName}</Text>
                        <Text style={[styles.commentUsername, isDark && styles.textMuted]}>@{comment.author.username}</Text>
                      </View>
                      
                      {isOwnComment && (
                        <TouchableOpacity onPress={() => handleDeleteComment(comment.id)} style={styles.commentActionBtn}>
                          <Trash2 size={13} color="#ef4444" />
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Comment Body */}
                    <Text style={[styles.commentBody, isDark && styles.textLight]}>{comment.text}</Text>

                    {/* Comment Actions */}
                    <View style={styles.commentActions}>
                      <View style={styles.commentVoteGroup}>
                        <TouchableOpacity onPress={() => toggleCommentUpvote(comment.id)} style={styles.commentVoteBtn}>
                          <ArrowUp size={13} color={isUp ? '#ea580c' : '#64748b'} />
                        </TouchableOpacity>
                        <Text style={styles.commentScoreText}>{commentScore()}</Text>
                        <TouchableOpacity onPress={() => toggleCommentDownvote(comment.id)} style={styles.commentVoteBtn}>
                          <ArrowDown size={13} color={isDown ? '#ef4444' : '#64748b'} />
                        </TouchableOpacity>
                      </View>

                      <TouchableOpacity onPress={() => handleReplyPress(comment)} style={styles.commentReplyBtn}>
                        <Text style={styles.commentReplyText}>Reply</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        {/* Sticky Comment Input Bar */}
        <View style={[styles.stickyInputWrapper, isDark && styles.stickyInputWrapperDark]}>
          {replyTarget && (
            <View style={[styles.replyTargetBar, isDark && styles.replyTargetBarDark]}>
              <Text style={styles.replyTargetText} numberOfLines={1}>Replying to @{replyTarget.username}</Text>
              <TouchableOpacity onPress={() => setReplyTarget(null)}>
                <X size={14} color="#ef4444" />
              </TouchableOpacity>
            </View>
          )}

          <View style={[
            styles.inputRow, 
            { paddingBottom: Math.max(insets.bottom, 12) }
          ]}>
            <TextInput
              ref={commentInputRef}
              style={[
                styles.input,
                isDark && styles.inputDark,
                { color: isDark ? '#f8fafc' : '#0f172a' }
              ]}
              placeholder={replyTarget ? `Reply to @${replyTarget.username}...` : "Add a comment..."}
              placeholderTextColor="#94a3b8"
              value={commentText}
              onChangeText={setCommentText}
              multiline
            />
            <TouchableOpacity 
              onPress={handleSendComment}
              disabled={!commentText.trim() || createCommentMutation.isPending}
              style={styles.sendBtn}
            >
              {createCommentMutation.isPending ? (
                <ActivityIndicator size="small" color="#ea580c" />
              ) : (
                <Send size={18} color={commentText.trim() ? '#ea580c' : '#94a3b8'} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 16,
  },
  backButton: {
    backgroundColor: '#ea580c',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  backButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerDark: {
    borderBottomColor: '#1e293b',
  },
  headerBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  headerRightSpace: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deletePostBtn: {
    padding: 4,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  authorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f1f5f9',
  },
  authorInfo: {
    flex: 1,
    marginLeft: 12,
  },
  authorDisplayName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  authorUsername: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 1,
  },
  statusBadge: {
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  locationTag: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    backgroundColor: '#fff7ed',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  locationTagDark: {
    backgroundColor: '#1e293b',
  },
  locationText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ea580c',
    marginLeft: 6,
    flex: 1,
  },
  description: {
    fontSize: 16,
    color: '#334155',
    lineHeight: 24,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  mediaContainer: {
    position: 'relative',
    width: '100%',
    height: 300,
    marginBottom: 16,
  },
  imageScroll: {
    width: '100%',
    height: '100%',
  },
  postImage: {
    width: screenWidth,
    height: '100%',
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 3,
  },
  activeDot: {
    backgroundColor: '#ea580c',
    width: 14,
  },
  inactiveDot: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  toolbarCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  toolbarCapsuleDark: {
    backgroundColor: '#1e293b',
  },
  voteBtn: {
    padding: 2,
  },
  scoreText: {
    fontSize: 13,
    fontWeight: '700',
    marginHorizontal: 8,
  },
  toolbarCount: {
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6,
    color: '#334155',
  },
  divider: {
    height: 8,
    backgroundColor: '#f1f5f9',
    width: '100%',
    marginBottom: 16,
  },
  dividerDark: {
    backgroundColor: '#1e293b',
  },
  commentsHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  noCommentsContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  noCommentsText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
  },
  noCommentsSubtext: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  commentItem: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  commentItemDark: {
    borderBottomColor: '#1e293b',
  },
  replyBranchLine: {
    width: 24,
    alignItems: 'center',
    paddingTop: 4,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  commentAuthorInfo: {
    marginLeft: 10,
    flex: 1,
  },
  commentAuthorName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  commentUsername: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 1,
  },
  commentActionBtn: {
    padding: 4,
  },
  commentBody: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
    paddingLeft: 42,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingLeft: 42,
  },
  commentVoteGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 16,
  },
  commentVoteBtn: {
    padding: 2,
  },
  commentScoreText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    paddingHorizontal: 4,
  },
  commentReplyBtn: {
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  commentReplyText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ea580c',
  },
  stickyInputWrapper: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  stickyInputWrapperDark: {
    backgroundColor: '#0f172a',
    borderTopColor: '#1e293b',
  },
  replyTargetBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff7ed',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  replyTargetBarDark: {
    backgroundColor: '#1e293b',
  },
  replyTargetText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ea580c',
    flex: 1,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 80,
    fontSize: 14,
    backgroundColor: '#f8fafc',
  },
  inputDark: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
  },
  sendBtn: {
    padding: 8,
    marginLeft: 8,
  },
  textLight: {
    color: '#f8fafc',
  },
  textMuted: {
    color: '#94a3b8',
  },
});
