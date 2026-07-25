import React, { useState, useRef } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, FlatList, Image, ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Keyboard } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getComments, createComment, deleteComment } from '../services/post';
import { useAuthStore } from '../store/auth-store';
import { useVoteStore } from '../store/vote-store';
import { useColorScheme } from './useColorScheme';
import { X, CornerDownRight, ArrowUp, ArrowDown, Send } from 'lucide-react-native';
import type { CommentWithDetails } from '../types';

interface CommentsDrawerProps {
  visible: boolean;
  onClose: () => void;
  postId: string;
}

export function CommentsDrawer({ visible, onClose, postId }: CommentsDrawerProps) {
  const theme = useColorScheme();
  const isDark = theme === 'dark';
  const queryClient = useQueryClient();
  const { profile } = useAuthStore();
  const { isCommentUpvoted, isCommentDownvoted, toggleCommentUpvote, toggleCommentDownvote } = useVoteStore();

  const [text, setText] = useState('');
  const [replyTarget, setReplyTarget] = useState<{ id: string; username: string } | null>(null);
  const inputRef = useRef<TextInput>(null);

  // Fetch comments
  const { data: flatComments = [], isLoading } = useQuery({
    queryKey: ['comments', postId],
    queryFn: () => getComments(postId),
    enabled: visible,
  });

  // Create comment mutation
  const createCommentMutation = useMutation({
    mutationFn: ({ text, parentId }: { text: string; parentId: string | null }) => 
      createComment(postId, text, parentId),
    onSuccess: () => {
      setText('');
      setReplyTarget(null);
      Keyboard.dismiss();
      queryClient.invalidateQueries({ queryKey: ['comments', postId] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });

  const handleSend = () => {
    if (!text.trim()) return;
    createCommentMutation.mutate({
      text: text.trim(),
      parentId: replyTarget ? replyTarget.id : null,
    });
  };

  const handleReplyPress = (comment: CommentWithDetails) => {
    setReplyTarget({ id: comment.id, username: comment.author.username });
    inputRef.current?.focus();
  };

  // Helper to build comment tree
  const buildCommentTree = (comments: CommentWithDetails[]) => {
    const commentMap: { [key: string]: CommentWithDetails & { replies: CommentWithDetails[] } } = {};
    const roots: (CommentWithDetails & { replies: CommentWithDetails[] })[] = [];

    comments.forEach((c) => {
      commentMap[c.id] = { ...c, replies: [] };
    });

    comments.forEach((c) => {
      const mapped = commentMap[c.id];
      if (c.parentId && commentMap[c.parentId]) {
        commentMap[c.parentId].replies.push(mapped);
      } else {
        roots.push(mapped);
      }
    });

    return roots;
  };

  const commentTree = buildCommentTree(flatComments);

  const getInitials = (displayName: string) => {
    const parts = displayName.split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return (displayName[0] || 'U').toUpperCase();
  };

  const CommentItem = ({ comment, isReply = false }: { comment: CommentWithDetails & { replies?: CommentWithDetails[] }; isReply?: boolean }) => {
    const upvoted = isCommentUpvoted(comment.id);
    const downvoted = isCommentDownvoted(comment.id);
    
    // Base score is mock 1, adjusted by user vote state
    const voteScore = (upvoted ? 1 : 0) - (downvoted ? 1 : 0);

    return (
      <View style={[styles.commentContainer, isReply && styles.nestedComment]}>
        <View style={styles.commentHeader}>
          {comment.author.avatarUrl ? (
            <Image source={{ uri: comment.author.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, isDark && styles.avatarPlaceholderDark]}>
              <Text style={styles.avatarPlaceholderText}>{getInitials(comment.author.displayName)}</Text>
            </View>
          )}

          <View style={styles.metaContainer}>
            <Text style={[styles.displayName, isDark && styles.textLight]}>{comment.author.displayName}</Text>
            <Text style={styles.username}>@{comment.author.username}</Text>
          </View>

          <Text style={styles.timeText}>
            {new Date(comment.createdAt).toLocaleDateString()}
          </Text>
        </View>

        <Text style={[styles.commentText, isDark && styles.textLight]}>{comment.text}</Text>

        <View style={styles.commentActions}>
          <View style={styles.voteControls}>
            <TouchableOpacity onPress={() => toggleCommentUpvote(comment.id)} style={styles.voteBtn}>
              <ArrowUp size={16} color={upvoted ? '#ea580c' : '#94a3b8'} strokeWidth={upvoted ? 3 : 2} />
            </TouchableOpacity>
            <Text style={[
              styles.voteScoreText,
              upvoted && { color: '#ea580c', fontWeight: '700' },
              downvoted && { color: '#ef4444', fontWeight: '700' }
            ]}>
              {voteScore}
            </Text>
            <TouchableOpacity onPress={() => toggleCommentDownvote(comment.id)} style={styles.voteBtn}>
              <ArrowDown size={16} color={downvoted ? '#ef4444' : '#94a3b8'} strokeWidth={downvoted ? 3 : 2} />
            </TouchableOpacity>
          </View>

          {!isReply && (
            <TouchableOpacity onPress={() => handleReplyPress(comment)} style={styles.replyBtn}>
              <CornerDownRight size={14} color="#ea580c" />
              <Text style={styles.replyBtnText}>Reply</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Recursive rendering of replies */}
        {comment.replies && comment.replies.map((reply) => (
          <CommentItem key={reply.id} comment={reply} isReply={true} />
        ))}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={[styles.modalContent, isDark && styles.modalContentDark]}>
          
          {/* Header */}
          <View style={[styles.header, isDark && styles.headerDark]}>
            <Text style={[styles.headerTitle, isDark && styles.textLight]}>
              Comments ({flatComments.length})
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={isDark ? '#f8fafc' : '#64748b'} />
            </TouchableOpacity>
          </View>

          {/* List */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#ea580c" />
            </View>
          ) : (
            <FlatList
              data={commentTree}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => <CommentItem comment={item} />}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No comments yet.</Text>
                  <Text style={styles.emptySubtext}>Share your thoughts on this road hazard!</Text>
                </View>
              }
            />
          )}

          {/* Keyboard avoiding send bar */}
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
          >
            {replyTarget && (
              <View style={[styles.replyIndicator, isDark && styles.replyIndicatorDark]}>
                <Text style={styles.replyIndicatorText}>Replying to @{replyTarget.username}</Text>
                <TouchableOpacity onPress={() => setReplyTarget(null)}>
                  <X size={14} color="#ef4444" />
                </TouchableOpacity>
              </View>
            )}

            <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
              <TextInput
                ref={inputRef}
                style={[
                  styles.input,
                  isDark && styles.inputDark,
                  { color: isDark ? '#f8fafc' : '#0f172a' }
                ]}
                placeholder={replyTarget ? `Reply to @${replyTarget.username}...` : "Add a comment..."}
                placeholderTextColor="#94a3b8"
                value={text}
                onChangeText={setText}
                multiline
              />
              <TouchableOpacity 
                onPress={handleSend}
                disabled={!text.trim() || createCommentMutation.isPending}
                style={styles.sendBtn}
              >
                {createCommentMutation.isPending ? (
                  <ActivityIndicator size="small" color="#ea580c" />
                ) : (
                  <Send size={18} color={text.trim() ? '#ea580c' : '#94a3b8'} />
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    height: '80%',
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalContentDark: {
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerDark: {
    borderBottomColor: '#1e293b',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  closeBtn: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  commentContainer: {
    marginBottom: 16,
    width: '100%',
  },
  nestedComment: {
    marginLeft: 16,
    paddingLeft: 12,
    borderLeftWidth: 1.5,
    borderLeftColor: '#e2e8f0',
    marginTop: 12,
    marginBottom: 4,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e2e8f0',
  },
  avatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  avatarPlaceholderDark: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
  },
  avatarPlaceholderText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
  },
  metaContainer: {
    marginLeft: 8,
    flexDirection: 'column',
    justifyContent: 'center',
  },
  displayName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  username: {
    fontSize: 11,
    color: '#94a3b8',
  },
  timeText: {
    fontSize: 11,
    color: '#94a3b8',
    marginLeft: 'auto',
  },
  commentText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
    paddingLeft: 36,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingLeft: 36,
  },
  voteControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 16,
  },
  voteBtn: {
    padding: 4,
  },
  voteScoreText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    paddingHorizontal: 4,
  },
  replyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  replyBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ea580c',
    marginLeft: 4,
  },
  replyIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff7ed',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#ffedd5',
  },
  replyIndicatorDark: {
    backgroundColor: '#1e293b',
    borderTopColor: '#334155',
  },
  replyIndicatorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ea580c',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  inputContainerDark: {
    backgroundColor: '#0f172a',
    borderTopColor: '#1e293b',
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
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#94a3b8',
  },
  textLight: {
    color: '#f8fafc',
  },
});
