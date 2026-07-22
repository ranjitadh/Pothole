jest.mock('../../services/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
    },
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

import { supabase } from '../../services/supabase';
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
} from '../../services/post';

const mockSupabase = supabase as any;

describe('Post Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
  });

  describe('getFeedPosts', () => {
    it('returns empty data when no user', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

      const result = await getFeedPosts();
      expect(result.data).toEqual([]);
      expect(result.hasMore).toBe(false);
    });

    it('returns formatted posts with pagination', async () => {
      const mockPosts = [
        {
          id: 'post-1',
          user_id: 'user-1',
          text: 'Big pothole on Main St',
          visibility: 'public',
          likes_count: 5,
          comments_count: 2,
          shares_count: 1,
          is_edited: false,
          created_at: '2024-06-01T00:00:00Z',
          status: 'unresolved',
          author: { id: 'user-1', username: 'testuser', display_name: 'Test User', avatar_url: null, followers_count: 5, following_count: 3, posts_count: 2, created_at: '2024-01-01' },
          media: [{ id: 'm1', url: 'https://example.com/img.jpg', type: 'image', width: null, height: null, thumbnail_url: null }],
          location: { id: 'loc1', latitude: 27.7172, longitude: 85.324, place_name: 'Main St', country: 'Nepal', city: 'Kathmandu', google_place_id: null },
        },
      ];

      const mockBlockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: [], error: null }),
      });

      const mockPostSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          not: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({ data: mockPosts, error: null }),
            }),
          }),
          order: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ data: mockPosts, error: null }),
          }),
        }),
        order: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: mockPosts, error: null }),
        }),
      });

      const mockLikeSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          in: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      });

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'blocks') return { select: mockBlockSelect };
        if (table === 'posts') return { select: mockPostSelect };
        if (table === 'likes' || table === 'saved_posts') return { select: mockLikeSelect };
        return { select: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ data: [], error: null }) }) };
      });

      const result = await getFeedPosts();
      expect(result.data.length).toBe(1);
      expect(result.data[0].text).toBe('Big pothole on Main St');
      expect(result.data[0].author.displayName).toBe('Test User');
      expect(result.data[0].location?.placeName).toBe('Main St');
    });
  });

  describe('getExplorePosts', () => {
    it('returns formatted posts for map view', async () => {
      const mockPosts = [
        {
          id: 'post-1',
          user_id: 'user-1',
          text: 'Dangerous road',
          visibility: 'public',
          likes_count: 3,
          comments_count: 1,
          shares_count: 0,
          is_edited: false,
          created_at: '2024-06-01T00:00:00Z',
          status: 'unresolved',
          author: { id: 'user-1', username: 'testuser', display_name: 'Test User', avatar_url: null, followers_count: 5, following_count: 3, posts_count: 2, created_at: '2024-01-01' },
          media: [],
          location: { id: 'loc1', latitude: 27.7172, longitude: 85.324, place_name: null, country: null, city: null, google_place_id: null },
        },
      ];

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'posts') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue({ data: mockPosts, error: null }),
                }),
              }),
            }),
          };
        }
        return { select: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ in: jest.fn().mockResolvedValue({ data: [], error: null }) }) }) };
      });

      const result = await getExplorePosts();
      expect(result.data.length).toBe(1);
      expect(result.data[0].location?.latitude).toBe(27.7172);
    });
  });

  describe('likePost', () => {
    it('creates a like', async () => {
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

      const result = await likePost('post-1');
      expect(result.liked).toBe(true);
    });

    it('returns existing like without inserting again', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'existing-like' }, error: null }),
            }),
          }),
        }),
      });

      const result = await likePost('post-1');
      expect(result.liked).toBe(true);
    });

    it('throws when unauthorized', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

      await expect(likePost('post-1')).rejects.toThrow('Unauthorized');
    });
  });

  describe('unlikePost', () => {
    it('removes a like', async () => {
      mockSupabase.from.mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
          }),
        }),
      });

      const result = await unlikePost('post-1');
      expect(result.liked).toBe(false);
    });
  });

  describe('savePost', () => {
    it('creates a save', async () => {
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

      const result = await savePost('post-1');
      expect(result.saved).toBe(true);
    });
  });

  describe('unsavePost', () => {
    it('removes a save', async () => {
      mockSupabase.from.mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
          }),
        }),
      });

      const result = await unsavePost('post-1');
      expect(result.saved).toBe(false);
    });
  });

  describe('createPost', () => {
    it('creates a post with text only', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'posts') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: { id: 'new-post' }, error: null }),
              }),
            }),
          };
        }
        return {};
      });

      const result = await createPost({ text: 'New pothole report', visibility: 'public' });
      expect(result.id).toBe('new-post');
    });

    it('creates a post with location', async () => {
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
                single: jest.fn().mockResolvedValue({ data: { id: 'new-post' }, error: null }),
              }),
            }),
          };
        }
        return {};
      });

      const result = await createPost({
        text: 'Hazard on road',
        location: { latitude: 27.7172, longitude: 85.324, placeName: 'Main St' },
      });
      expect(result.id).toBe('new-post');
    });

    it('throws when unauthorized', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

      await expect(createPost({ text: 'Test' })).rejects.toThrow('Unauthorized');
    });
  });

  describe('deletePost', () => {
    it('deletes a post', async () => {
      mockSupabase.from.mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      });

      const result = await deletePost('post-1');
      expect(result.success).toBe(true);
    });
  });

  describe('blockUser', () => {
    it('blocks a user', async () => {
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({ error: null }),
      });

      const result = await blockUser('user-2');
      expect(result.success).toBe(true);
    });

    it('throws when unauthorized', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

      await expect(blockUser('user-2')).rejects.toThrow('Unauthorized');
    });
  });
});
