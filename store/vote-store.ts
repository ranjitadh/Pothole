import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface VoteState {
  downvotedPostIds: string[];
  upvotedCommentIds: string[];
  downvotedCommentIds: string[];
  
  // Post Votes Actions
  togglePostDownvote: (postId: string) => void;
  removePostDownvote: (postId: string) => void;
  
  // Comment Votes Actions
  toggleCommentUpvote: (commentId: string) => void;
  toggleCommentDownvote: (commentId: string) => void;
  isCommentUpvoted: (commentId: string) => boolean;
  isCommentDownvoted: (commentId: string) => boolean;
}

export const useVoteStore = create<VoteState>()(
  persist(
    (set, get) => ({
      downvotedPostIds: [],
      upvotedCommentIds: [],
      downvotedCommentIds: [],
      
      togglePostDownvote: (postId) => {
        const { downvotedPostIds } = get();
        if (downvotedPostIds.includes(postId)) {
          set({ downvotedPostIds: downvotedPostIds.filter(id => id !== postId) });
        } else {
          set({ downvotedPostIds: [...downvotedPostIds, postId] });
        }
      },
      
      removePostDownvote: (postId) => {
        const { downvotedPostIds } = get();
        if (downvotedPostIds.includes(postId)) {
          set({ downvotedPostIds: downvotedPostIds.filter(id => id !== postId) });
        }
      },
      
      toggleCommentUpvote: (commentId) => {
        const { upvotedCommentIds, downvotedCommentIds } = get();
        if (upvotedCommentIds.includes(commentId)) {
          set({ upvotedCommentIds: upvotedCommentIds.filter(id => id !== commentId) });
        } else {
          set({
            upvotedCommentIds: [...upvotedCommentIds, commentId],
            downvotedCommentIds: downvotedCommentIds.filter(id => id !== commentId)
          });
        }
      },
      
      toggleCommentDownvote: (commentId) => {
        const { upvotedCommentIds, downvotedCommentIds } = get();
        if (downvotedCommentIds.includes(commentId)) {
          set({ downvotedCommentIds: downvotedCommentIds.filter(id => id !== commentId) });
        } else {
          set({
            downvotedCommentIds: [...downvotedCommentIds, commentId],
            upvotedCommentIds: upvotedCommentIds.filter(id => id !== commentId)
          });
        }
      },
      
      isCommentUpvoted: (commentId) => {
        return get().upvotedCommentIds.includes(commentId);
      },
      
      isCommentDownvoted: (commentId) => {
        return get().downvotedCommentIds.includes(commentId);
      },
    }),
    {
      name: 'vote-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
