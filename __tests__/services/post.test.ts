import {
  getFeedPosts,
  getExplorePosts,
  likePost,
  unlikePost,
  savePost,
  unsavePost,
  createPost,
  deletePost,
  blockUser,
  updatePostStatus,
  reportPost,
  searchUsers,
  searchPosts,
  searchHashtags,
  getComments,
  createComment,
  deleteComment,
  repostPost,
  uploadPhoto,
  getPostById,
} from '../../services/post';

jest.mock('../../services/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
    },
    from: jest.fn(),
    rpc: jest.fn().mockResolvedValue({ error: null }),
    storage: {
      from: jest.fn().mockReturnValue({
        upload: jest.fn().mockResolvedValue({ data: { path: 'test.jpg' }, error: null }),
        getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/photo.jpg' } }),
        remove: jest.fn().mockResolvedValue({ error: null }),
      }),
    },
  },
}));

import { supabase } from '../../services/supabase';

const mockSupabase = supabase as any;

describe('Post Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    global.fetch = jest.fn().mockResolvedValue({
      blob: jest.fn().mockResolvedValue(new Blob([])),
    });
  });

  describe('getFeedPosts', () => {
    it('returns empty when user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
      const res = await getFeedPosts();
      expect(res.data).toEqual([]);
      expect(res.hasMore).toBe(false);
    });

    it('fetches feed posts with blocks and likes/saves', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'blocks') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: [{ blocked_id: 'b1' }], error: null }),
            }),
          };
        }
        if (table === 'posts') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                not: jest.fn().mockReturnValue({
                  order: jest.fn().mockReturnValue({
                    limit: jest.fn().mockResolvedValue({
                      data: [
                        {
                          id: 'p1',
                          user_id: 'u2',
                          text: 'Feed pothole',
                          visibility: 'public',
                          likes_count: 3,
                          comments_count: 1,
                          shares_count: 0,
                          is_edited: false,
                          created_at: '2024-06-01',
                          status: 'unresolved',
                          author: { id: 'u2', username: 'john', display_name: 'John', avatar_url: null, followers_count: 0, following_count: 0, posts_count: 0, created_at: '2024-01-01' },
                          media: [{ id: 'm1', url: 'https://example.com/img.jpg', type: 'image', width: 10, height: 10, thumbnail_url: null }],
                          location: { id: 'l1', latitude: 27.7, longitude: 85.3, place_name: 'Street', country: 'NP', city: 'KTM', google_place_id: null },
                        },
                      ],
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              in: jest.fn().mockResolvedValue({ data: [{ post_id: 'p1' }], error: null }),
            }),
          }),
        };
      });

      const res = await getFeedPosts();
      expect(res.data.length).toBe(1);
      expect(res.data[0].isLiked).toBe(true);
    });

    it('throws error when query fails', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'blocks') {
          return { select: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ data: [], error: null }) }) };
        }
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({ data: null, error: { message: 'Feed error' } }),
              }),
            }),
          }),
        };
      });

      await expect(getFeedPosts()).rejects.toThrow('Feed error');
    });
  });

  describe('getExplorePosts', () => {
    it('fetches explore posts with cursor', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'posts') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  limit: jest.fn().mockReturnValue({
                    lt: jest.fn().mockResolvedValue({
                      data: [
                        {
                          id: 'p1',
                          user_id: 'u2',
                          text: 'Explore post',
                          visibility: 'public',
                          likes_count: 0,
                          comments_count: 0,
                          shares_count: 0,
                          is_edited: false,
                          created_at: '2024-06-01',
                          status: 'unresolved',
                          author: { id: 'u2', username: 'john', display_name: 'John', avatar_url: null, followers_count: 0, following_count: 0, posts_count: 0, created_at: '2024-01-01' },
                          media: [],
                          location: null,
                        },
                      ],
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        return { select: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ in: jest.fn().mockResolvedValue({ data: [], error: null }) }) }) };
      });

      const res = await getExplorePosts('cursor-1');
      expect(res.data.length).toBe(1);
    });

    it('throws error when explore fails', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({ data: null, error: { message: 'Explore error' } }),
            }),
          }),
        }),
      });

      await expect(getExplorePosts()).rejects.toThrow('Explore error');
    });
  });

  describe('likes and saves', () => {
    it('likePost inserts when not liked', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
        insert: jest.fn().mockResolvedValue({ error: null }),
      });

      const res = await likePost('p1');
      expect(res.liked).toBe(true);
    });

    it('unlikePost deletes like', async () => {
      mockSupabase.from.mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
          }),
        }),
      });

      const res = await unlikePost('p1');
      expect(res.liked).toBe(false);
    });

    it('savePost inserts when not saved', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
        insert: jest.fn().mockResolvedValue({ error: null }),
      });

      const res = await savePost('p1');
      expect(res.saved).toBe(true);
    });

    it('unsavePost deletes save', async () => {
      mockSupabase.from.mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
          }),
        }),
      });

      const res = await unsavePost('p1');
      expect(res.saved).toBe(false);
    });
  });

  describe('createPost & deletePost & updatePostStatus', () => {
    it('creates post with location and media', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'locations') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'loc-1' }, error: null }),
              }),
            }),
          };
        }
        if (table === 'posts') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: { id: 'new-post-id' }, error: null }),
              }),
            }),
          };
        }
        if (table === 'post_media') {
          return { insert: jest.fn().mockResolvedValue({ error: null }) };
        }
        return {};
      });

      const post = await createPost({
        text: 'New pothole',
        location: { latitude: 27.7, longitude: 85.3, placeName: 'City Center' },
        media: [{ url: 'https://example.com/pothole.jpg', type: 'image' }],
      });

      expect(post.id).toBe('new-post-id');
    });

    it('deletes post and media files', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'post_media') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [{ url: 'https://example.supabase.co/storage/v1/object/public/posts/user-1/photo.jpg' }],
                error: null,
              }),
            }),
          };
        }
        return {
          delete: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
          }),
        };
      });

      const res = await deletePost('p1');
      expect(res.success).toBe(true);
    });

    it('updates post status', async () => {
      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      });

      const res = await updatePostStatus('p1', 'resolved');
      expect(res.success).toBe(true);
    });
  });

  describe('search functions', () => {
    it('searches users with clean query', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          or: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ data: [{ id: 'u1', username: 'ranjit' }], error: null }),
          }),
        }),
      });

      const users = await searchUsers('@ranjit');
      expect(users.length).toBe(1);
    });

    it('searches posts with matching locations and text', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'locations') {
          return {
            select: jest.fn().mockReturnValue({
              or: jest.fn().mockResolvedValue({ data: [{ id: 'loc1' }], error: null }),
            }),
          };
        }
        if (table === 'posts') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                or: jest.fn().mockReturnValue({
                  order: jest.fn().mockReturnValue({
                    limit: jest.fn().mockResolvedValue({
                      data: [
                        {
                          id: 'p1',
                          user_id: 'u2',
                          text: 'Main Road pothole',
                          visibility: 'public',
                          likes_count: 0,
                          comments_count: 0,
                          shares_count: 0,
                          is_edited: false,
                          created_at: '2024-01-01',
                          author: { id: 'u2', username: 'j', display_name: 'J', avatar_url: null, followers_count: 0, following_count: 0, posts_count: 0, created_at: '2024-01-01' },
                          media: [],
                          location: null,
                        },
                      ],
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        return { select: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ in: jest.fn().mockResolvedValue({ data: [], error: null }) }) }) };
      });

      const posts = await searchPosts('Main Road');
      expect(posts.length).toBe(1);
    });

    it('searches hashtags', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          ilike: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ data: [{ id: 'h1', name: 'pothole', posts_count: 5 }], error: null }),
          }),
        }),
      });

      const tags = await searchHashtags('#pothole');
      expect(tags.length).toBe(1);
    });
  });

  describe('comments, repost, and photo upload', () => {
    it('getComments returns formatted list', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: [
                {
                  id: 'c1',
                  post_id: 'p1',
                  user_id: 'u1',
                  text: 'Test comment',
                  is_edited: false,
                  created_at: '2024-01-01',
                  parent_id: null,
                  author: { id: 'u1', username: 'me', display_name: 'Me', avatar_url: null, followers_count: 0, following_count: 0, posts_count: 0, created_at: '2024-01-01' },
                },
              ],
              error: null,
            }),
          }),
        }),
      });

      const comments = await getComments('p1');
      expect(comments.length).toBe(1);
    });

    it('createComment inserts new comment', async () => {
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'c1',
                post_id: 'p1',
                user_id: 'user-1',
                text: 'Comment text',
                is_edited: false,
                created_at: '2024-01-01',
                parent_id: null,
                author: { id: 'user-1', username: 'me', display_name: 'Me', avatar_url: null },
              },
              error: null,
            }),
          }),
        }),
      });

      const comment = await createComment('p1', 'Comment text');
      expect(comment.id).toBe('c1');
    });

    it('deleteComment removes comment', async () => {
      mockSupabase.from.mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      });

      const ok = await deleteComment('c1');
      expect(ok).toBe(true);
    });

    it('repostPost fallback to manual increment when RPC fails', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({ error: { message: 'No RPC' } });
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: { shares_count: 4 }, error: null }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      });

      const ok = await repostPost('p1');
      expect(ok).toBe(true);
    });

    it('uploads photo and returns public URL', async () => {
      const url = await uploadPhoto('file:///test.jpg');
      expect(url).toBe('https://example.com/photo.jpg');
    });
  });
});
