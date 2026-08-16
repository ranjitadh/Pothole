import { useVoteStore } from '../../store/vote-store';

describe('Vote Store', () => {
  beforeEach(() => {
    useVoteStore.setState({
      downvotedPostIds: [],
      upvotedCommentIds: [],
      downvotedCommentIds: [],
    });
  });

  it('has initial empty arrays', () => {
    const state = useVoteStore.getState();
    expect(state.downvotedPostIds).toEqual([]);
    expect(state.upvotedCommentIds).toEqual([]);
    expect(state.downvotedCommentIds).toEqual([]);
  });

  it('toggles post downvote on and off', () => {
    const { togglePostDownvote } = useVoteStore.getState();

    // Toggle on
    togglePostDownvote('post-1');
    expect(useVoteStore.getState().downvotedPostIds).toEqual(['post-1']);

    // Toggle off
    togglePostDownvote('post-1');
    expect(useVoteStore.getState().downvotedPostIds).toEqual([]);
  });

  it('removes post downvote', () => {
    useVoteStore.setState({ downvotedPostIds: ['post-1', 'post-2'] });
    const { removePostDownvote } = useVoteStore.getState();

    removePostDownvote('post-1');
    expect(useVoteStore.getState().downvotedPostIds).toEqual(['post-2']);

    // Call remove on a non-existent post id
    removePostDownvote('post-99');
    expect(useVoteStore.getState().downvotedPostIds).toEqual(['post-2']);
  });

  it('toggles comment upvote and removes downvote if present', () => {
    const { toggleCommentUpvote } = useVoteStore.getState();

    // Set initial downvote
    useVoteStore.setState({ downvotedCommentIds: ['comment-1'] });

    // Upvote comment-1 (should add to upvoted and remove from downvoted)
    toggleCommentUpvote('comment-1');
    expect(useVoteStore.getState().upvotedCommentIds).toEqual(['comment-1']);
    expect(useVoteStore.getState().downvotedCommentIds).toEqual([]);
    expect(useVoteStore.getState().isCommentUpvoted('comment-1')).toBe(true);
    expect(useVoteStore.getState().isCommentDownvoted('comment-1')).toBe(false);

    // Upvote comment-1 again (should remove upvote)
    useVoteStore.getState().toggleCommentUpvote('comment-1');
    expect(useVoteStore.getState().upvotedCommentIds).toEqual([]);
    expect(useVoteStore.getState().isCommentUpvoted('comment-1')).toBe(false);
  });

  it('toggles comment downvote and removes upvote if present', () => {
    const { toggleCommentDownvote } = useVoteStore.getState();

    // Set initial upvote
    useVoteStore.setState({ upvotedCommentIds: ['comment-1'] });

    // Downvote comment-1 (should add to downvoted and remove from upvoted)
    toggleCommentDownvote('comment-1');
    expect(useVoteStore.getState().downvotedCommentIds).toEqual(['comment-1']);
    expect(useVoteStore.getState().upvotedCommentIds).toEqual([]);
    expect(useVoteStore.getState().isCommentDownvoted('comment-1')).toBe(true);
    expect(useVoteStore.getState().isCommentUpvoted('comment-1')).toBe(false);

    // Downvote comment-1 again (should remove downvote)
    useVoteStore.getState().toggleCommentDownvote('comment-1');
    expect(useVoteStore.getState().downvotedCommentIds).toEqual([]);
    expect(useVoteStore.getState().isCommentDownvoted('comment-1')).toBe(false);
  });
});
