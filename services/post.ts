import { supabase } from './supabase';
import type { PostWithDetails, CommentWithDetails } from '../types';

export async function getFeedPosts(cursor?: string, limit = 10) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: [], nextCursor: null, hasMore: false };

  // Fetch block relations to filter out blocked users' posts
  const [blockedData, blockerData] = await Promise.all([
    supabase.from('blocks').select('blocked_id').eq('blocker_id', user.id),
    supabase.from('blocks').select('blocker_id').eq('blocked_id', user.id),
  ]);
  const blockedIds = [
    ...(blockedData.data?.map((b: any) => b.blocked_id) || []),
    ...(blockerData.data?.map((b: any) => b.blocker_id) || []),
  ];

  let query = supabase
    .from('posts')
    .select(`
      *,
      author:profiles!posts_user_id_fkey(id, username, display_name, avatar_url, followers_count, following_count, posts_count, created_at),
      media:post_media(*),
      location:locations(*)
    `)
    .eq('visibility', 'public');

  if (blockedIds.length > 0) {
    query = query.not('user_id', 'in', `(${blockedIds.join(',')})`);
  }

  query = query
    .order('created_at', { ascending: false })
    .limit(limit + 1);

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data: posts, error } = await query;
  if (error) throw new Error(error.message);

  const rawPosts = (posts ?? []) as any[];
  const hasMore = rawPosts.length > limit;
  const trimmed = hasMore ? rawPosts.slice(0, limit) : rawPosts;

  const postIds = trimmed.map((p: any) => p.id);
  let likedPostIds = new Set<string>();
  let savedPostIds = new Set<string>();

  if (postIds.length > 0) {
    const [likesResult, savesResult] = await Promise.all([
      supabase.from('likes').select('post_id').eq('user_id', user.id).in('post_id', postIds),
      supabase.from('saved_posts').select('post_id').eq('user_id', user.id).in('post_id', postIds),
    ]);
    likedPostIds = new Set((likesResult.data ?? []).map((l: any) => l.post_id));
    savedPostIds = new Set((savesResult.data ?? []).map((s: any) => s.post_id));
  }

  const formatted: PostWithDetails[] = trimmed.map((post: any) => ({
    id: post.id,
    userId: post.user_id,
    text: post.text,
    visibility: post.visibility,
    likesCount: post.likes_count,
    commentsCount: post.comments_count,
    sharesCount: post.shares_count,
    isEdited: post.is_edited,
    createdAt: post.created_at,
    author: {
      id: post.author.id,
      username: post.author.username,
      displayName: post.author.display_name,
      bio: null,
      avatarUrl: post.author.avatar_url,
      coverUrl: null,
      followersCount: post.author.followers_count,
      followingCount: post.author.following_count,
      postsCount: post.author.posts_count,
      createdAt: post.author.created_at,
    },
    media: (post.media ?? []).map((m: any) => ({
      id: m.id,
      url: m.url,
      type: m.type,
      width: m.width,
      height: m.height,
      thumbnailUrl: m.thumbnail_url,
    })),
    location: post.location
      ? {
          id: post.location.id,
          latitude: post.location.latitude,
          longitude: post.location.longitude,
          placeName: post.location.place_name,
          country: post.location.country,
          city: post.location.city,
          googlePlaceId: post.location.google_place_id,
        }
      : null,
    hashtags: [],
    isLiked: likedPostIds.has(post.id),
    isSaved: savedPostIds.has(post.id),
    status: post.status || 'unresolved',
  }));

  return {
    data: formatted,
    nextCursor: trimmed.length > 0 ? trimmed[trimmed.length - 1].created_at : null,
    hasMore,
  };
}

export async function getExplorePosts(cursor?: string, limit = 100) {
  const { data: { user } } = await supabase.auth.getUser();

  let query = supabase
    .from('posts')
    .select(`
      *,
      author:profiles!posts_user_id_fkey(id, username, display_name, avatar_url, followers_count, following_count, posts_count, created_at),
      media:post_media(*),
      location:locations(*)
    `)
    .eq('visibility', 'public')
    .order('created_at', { ascending: false })
    .limit(limit + 1);

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data: posts, error } = await query;
  if (error) throw new Error(error.message);

  const rawPosts = (posts ?? []) as any[];
  const hasMore = rawPosts.length > limit;
  const trimmed = hasMore ? rawPosts.slice(0, limit) : rawPosts;

  const postIds = trimmed.map((p: any) => p.id);
  let likedPostIds = new Set<string>();
  let savedPostIds = new Set<string>();

  if (user && postIds.length > 0) {
    const [likesResult, savesResult] = await Promise.all([
      supabase.from('likes').select('post_id').eq('user_id', user.id).in('post_id', postIds),
      supabase.from('saved_posts').select('post_id').eq('user_id', user.id).in('post_id', postIds),
    ]);
    likedPostIds = new Set((likesResult.data ?? []).map((l: any) => l.post_id));
    savedPostIds = new Set((savesResult.data ?? []).map((s: any) => s.post_id));
  }

  const formatted: PostWithDetails[] = trimmed.map((post: any) => ({
    id: post.id,
    userId: post.user_id,
    text: post.text,
    visibility: post.visibility,
    likesCount: post.likes_count,
    commentsCount: post.comments_count,
    sharesCount: post.shares_count,
    isEdited: post.is_edited,
    createdAt: post.created_at,
    author: {
      id: post.author.id,
      username: post.author.username,
      displayName: post.author.display_name,
      bio: null,
      avatarUrl: post.author.avatar_url,
      coverUrl: null,
      followersCount: post.author.followers_count,
      followingCount: post.author.following_count,
      postsCount: post.author.posts_count,
      createdAt: post.author.created_at,
    },
    media: (post.media ?? []).map((m: any) => ({
      id: m.id,
      url: m.url,
      type: m.type,
      width: m.width,
      height: m.height,
      thumbnailUrl: m.thumbnail_url,
    })),
    location: post.location
      ? {
          id: post.location.id,
          latitude: post.location.latitude,
          longitude: post.location.longitude,
          placeName: post.location.place_name,
          country: post.location.country,
          city: post.location.city,
          googlePlaceId: post.location.google_place_id,
        }
      : null,
    hashtags: [],
    isLiked: likedPostIds.has(post.id),
    isSaved: savedPostIds.has(post.id),
    status: post.status || 'unresolved',
  }));

  return {
    data: formatted,
    nextCursor: trimmed.length > 0 ? trimmed[trimmed.length - 1].created_at : null,
    hasMore,
  };
}

export async function likePost(postId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: existing } = await supabase
    .from('likes')
    .select('id')
    .eq('user_id', user.id)
    .eq('post_id', postId)
    .maybeSingle();

  if (existing) return { liked: true };

  const { error } = await supabase.from('likes').insert({
    user_id: user.id,
    post_id: postId,
  });

  if (error) throw new Error(error.message);
  return { liked: true };
}

export async function unlikePost(postId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { error } = await supabase
    .from('likes')
    .delete()
    .eq('user_id', user.id)
    .eq('post_id', postId);

  if (error) throw new Error(error.message);
  return { liked: false };
}

export async function savePost(postId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: existing } = await supabase
    .from('saved_posts')
    .select('id')
    .eq('user_id', user.id)
    .eq('post_id', postId)
    .maybeSingle();

  if (existing) return { saved: true };

  const { error } = await supabase.from('saved_posts').insert({
    user_id: user.id,
    post_id: postId,
  });

  if (error) throw new Error(error.message);
  return { saved: true };
}

export async function unsavePost(postId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { error } = await supabase
    .from('saved_posts')
    .delete()
    .eq('user_id', user.id)
    .eq('post_id', postId);

  if (error) throw new Error(error.message);
  return { saved: false };
}

export async function createPost(data: {
  text?: string;
  visibility?: 'public' | 'private' | 'followers';
  media?: { url: string; type: 'image' | 'video'; width?: number; height?: number; thumbnailUrl?: string }[];
  location?: { latitude: number; longitude: number; placeName?: string; country?: string; city?: string; googlePlaceId?: string };
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  let locationId: string | null = null;

  if (data.location) {
    const { data: rawLocation, error: locError } = await supabase
      .from('locations')
      .insert({
        latitude: data.location.latitude,
        longitude: data.location.longitude,
        place_name: data.location.placeName || null,
        country: data.location.country || null,
        city: data.location.city || null,
        google_place_id: data.location.googlePlaceId || null,
      })
      .select('id')
      .maybeSingle();

    if (!locError && rawLocation) {
      locationId = (rawLocation as any).id;
    }
  }

  const { data: post, error } = await supabase
    .from('posts')
    .insert({
      user_id: user.id,
      text: data.text ?? null,
      visibility: data.visibility ?? 'public',
      location_id: locationId,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  if (data.media && data.media.length > 0) {
    const mediaRecords = data.media.map((m) => ({
      post_id: post.id,
      url: m.url,
      type: m.type,
      width: m.width ?? null,
      height: m.height ?? null,
      thumbnail_url: m.thumbnailUrl ?? null,
    }));

    const { error: mediaError } = await supabase.from('post_media').insert(mediaRecords);
    if (mediaError) throw new Error(mediaError.message);
  }

  return post;
}

export async function deletePost(postId: string) {
  // Retrieve media rows to delete storage files before deleting database row
  const { data: mediaRows } = await supabase
    .from('post_media')
    .select('url')
    .eq('post_id', postId);

  if (mediaRows && mediaRows.length > 0) {
    const paths = mediaRows.map((m: any) => {
      const url = m.url as string;
      const match = url.match(/\/storage\/v1\/object\/(?:public|authenticated)\/([^/]+)\/(.+)$/);
      return match ? { bucket: match[1], path: match[2] } : null;
    }).filter(Boolean) as { bucket: string; path: string }[];

    for (const { bucket, path } of paths) {
      try {
        await supabase.storage.from(bucket).remove([path]);
      } catch (err) {
        console.warn(`Failed to delete storage file: ${bucket}/${path}`, err);
      }
    }
  }

  const { error } = await supabase.from('posts').delete().eq('id', postId);
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function blockUser(blockedId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { error } = await supabase.from('blocks').insert({
    blocker_id: user.id,
    blocked_id: blockedId,
  });

  if (error) throw new Error(error.message);
  return { success: true };
}

export async function updatePostStatus(postId: string, status: 'unresolved' | 'in_progress' | 'resolved') {
  const { error } = await supabase
    .from('posts')
    .update({ status })
    .eq('id', postId);

  if (error) throw new Error(error.message);
  return { success: true };
}

export async function reportPost(
  postId: string,
  reason: 'spam' | 'hate_speech' | 'harassment' | 'nudity' | 'violence' | 'other',
  description?: string
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { error } = await supabase.from('reports').insert({
    reporter_id: user.id,
    post_id: postId,
    reason,
    description: description || null,
  });

  if (error) throw new Error(error.message);
  return { success: true };
}

export async function searchUsers(queryText: string) {
  let cleanQuery = queryText.trim();
  if (cleanQuery.startsWith('@')) {
    cleanQuery = cleanQuery.substring(1);
  }
  if (!cleanQuery) return [];

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, followers_count')
    .or(`username.ilike.%${cleanQuery}%,display_name.ilike.%${cleanQuery}%`)
    .limit(30);

  if (error) throw new Error(error.message);
  return data || [];
}

export async function searchPosts(queryText: string) {
  const cleanQuery = queryText.trim();
  if (!cleanQuery) return [];

  const { data: { user } } = await supabase.auth.getUser();

  // 1. Search locations matching place_name, city, country
  const { data: locs } = await supabase
    .from('locations')
    .select('id')
    .or(`place_name.ilike.%${cleanQuery}%,city.ilike.%${cleanQuery}%,country.ilike.%${cleanQuery}%`);

  const locIds = locs ? locs.map((l: any) => l.id) : [];

  // 2. Query posts matching description/text OR location IDs
  let query = supabase
    .from('posts')
    .select(`
      *,
      author:profiles!posts_user_id_fkey(id, username, display_name, avatar_url, followers_count, following_count, posts_count, created_at),
      media:post_media(*),
      location:locations(*)
    `)
    .eq('visibility', 'public');

  if (locIds.length > 0) {
    query = query.or(`text.ilike.%${cleanQuery}%,location_id.in.(${locIds.join(',')})`);
  } else {
    query = query.ilike('text', `%${cleanQuery}%`);
  }

  query = query.order('created_at', { ascending: false }).limit(30);

  const { data: posts, error } = await query;
  if (error) throw new Error(error.message);

  const trimmed = posts ?? [];
  if (trimmed.length === 0) return [];

  let likedPostIds = new Set<string>();
  let savedPostIds = new Set<string>();

  if (user) {
    const postIds = trimmed.map((p: any) => p.id);
    const [likesRes, savesRes] = await Promise.all([
      supabase.from('likes').select('post_id').eq('user_id', user.id).in('post_id', postIds),
      supabase.from('saved_posts').select('post_id').eq('user_id', user.id).in('post_id', postIds),
    ]);
    likedPostIds = new Set((likesRes.data ?? []).map((l: any) => l.post_id));
    savedPostIds = new Set((savesRes.data ?? []).map((s: any) => s.post_id));
  }

  return trimmed.map((post: any) => ({
    id: post.id,
    userId: post.user_id,
    text: post.text,
    visibility: post.visibility,
    likesCount: post.likes_count,
    commentsCount: post.comments_count,
    sharesCount: post.shares_count,
    isEdited: post.is_edited,
    createdAt: post.created_at,
    author: {
      id: post.author.id,
      username: post.author.username,
      displayName: post.author.display_name,
      bio: null,
      avatarUrl: post.author.avatar_url,
      coverUrl: null,
      followersCount: post.author.followers_count,
      followingCount: post.author.following_count,
      postsCount: post.author.posts_count,
      createdAt: post.author.created_at,
    },
    media: (post.media ?? []).map((m: any) => ({
      id: m.id,
      url: m.url,
      type: m.type,
      width: m.width,
      height: m.height,
      thumbnailUrl: m.thumbnail_url,
    })),
    location: post.location
      ? {
          id: post.location.id,
          latitude: post.location.latitude,
          longitude: post.location.longitude,
          placeName: post.location.place_name,
          country: post.location.country,
          city: post.location.city,
          googlePlaceId: post.location.google_place_id,
        }
      : null,
    hashtags: [],
    isLiked: likedPostIds.has(post.id),
    isSaved: savedPostIds.has(post.id),
    status: post.status || 'unresolved',
  })) as PostWithDetails[];
}

export async function searchHashtags(queryText: string) {
  let cleanQuery = queryText.trim();
  if (cleanQuery.startsWith('#')) {
    cleanQuery = cleanQuery.substring(1);
  }
  if (!cleanQuery) return [];

  const { data, error } = await supabase
    .from('hashtags')
    .select('id, name, posts_count')
    .ilike('name', `%${cleanQuery}%`)
    .limit(30);

  if (error) throw new Error(error.message);
  return data || [];
}

export async function getComments(postId: string) {
  const { data, error } = await supabase
    .from('comments')
    .select(`
      *,
      author:profiles!comments_user_id_fkey(id, username, display_name, avatar_url, followers_count, following_count, posts_count, created_at)
    `)
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);

  const rawComments = (data ?? []) as any[];
  
  return rawComments.map((c: any) => ({
    id: c.id,
    postId: c.post_id,
    userId: c.user_id,
    text: c.text,
    isEdited: c.is_edited || false,
    createdAt: c.created_at,
    parentId: c.parent_id || null,
    author: {
      id: c.author.id,
      username: c.author.username,
      displayName: c.author.display_name,
      bio: null,
      avatarUrl: c.author.avatar_url,
      coverUrl: null,
      followersCount: c.author.followers_count || 0,
      followingCount: c.author.following_count || 0,
      postsCount: c.author.posts_count || 0,
      createdAt: c.author.created_at,
    },
  })) as CommentWithDetails[];
}

export async function createComment(postId: string, text: string, parentId?: string | null) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required');

  const { data, error } = await supabase
    .from('comments')
    .insert({
      post_id: postId,
      user_id: user.id,
      text: text,
      parent_id: parentId || null,
    })
    .select(`
      *,
      author:profiles!comments_user_id_fkey(id, username, display_name, avatar_url, followers_count, following_count, posts_count, created_at)
    `)
    .single();

  if (error) throw new Error(error.message);

  const c = data as any;
  return {
    id: c.id,
    postId: c.post_id,
    userId: c.user_id,
    text: c.text,
    isEdited: c.is_edited || false,
    createdAt: c.created_at,
    parentId: c.parent_id || null,
    author: {
      id: c.author.id,
      username: c.author.username,
      displayName: c.author.display_name,
      bio: null,
      avatarUrl: c.author.avatar_url,
      coverUrl: null,
      followersCount: c.author.followers_count || 0,
      followingCount: c.author.following_count || 0,
      postsCount: c.author.posts_count || 0,
      createdAt: c.author.created_at,
    },
  } as CommentWithDetails;
}

export async function deleteComment(commentId: string) {
  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', commentId);

  if (error) throw new Error(error.message);
  return true;
}

export async function repostPost(postId: string) {
  const { error } = await supabase.rpc('increment_post_shares', { post_id: postId });
  if (error) {
    // Fallback to manual update
    const { data: post, error: getError } = await supabase
      .from('posts')
      .select('shares_count')
      .eq('id', postId)
      .single();
    if (getError) throw getError;
    
    const { error: updateError } = await supabase
      .from('posts')
      .update({ shares_count: (post.shares_count || 0) + 1 })
      .eq('id', postId);
    if (updateError) throw updateError;
  }
  return true;
}

export async function uploadPhoto(uri: string, bucket = 'posts') {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const response = await fetch(uri);
  const blob = await response.blob();
  
  const filename = uri.split('/').pop() || `${Date.now()}.jpg`;
  const fileExt = filename.split('.').pop() || 'jpg';
  const filePath = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filePath, blob, {
      contentType: `image/${fileExt === 'png' ? 'png' : 'jpeg'}`,
    });

  if (error) throw new Error(error.message);

  const { data: publicUrlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(filePath);

  return publicUrlData.publicUrl;
}

export async function getPostById(postId: string): Promise<PostWithDetails> {
  const { data: { user } } = await supabase.auth.getUser();
  
  const { data: post, error } = await supabase
    .from('posts')
    .select(`
      *,
      author:profiles!posts_user_id_fkey(id, username, display_name, avatar_url, followers_count, following_count, posts_count, created_at),
      media:post_media(*),
      location:locations(*)
    `)
    .eq('id', postId)
    .single();

  if (error) throw new Error(error.message);
  if (!post) throw new Error('Post not found');

  let isLiked = false;
  let isSaved = false;

  if (user) {
    const [likeRes, saveRes] = await Promise.all([
      supabase.from('likes').select('post_id').eq('user_id', user.id).eq('post_id', postId).maybeSingle(),
      supabase.from('saved_posts').select('post_id').eq('user_id', user.id).eq('post_id', postId).maybeSingle(),
    ]);
    isLiked = !!likeRes.data;
    isSaved = !!saveRes.data;
  }

  return {
    id: post.id,
    userId: post.user_id,
    text: post.text,
    visibility: post.visibility,
    likesCount: post.likes_count,
    commentsCount: post.comments_count,
    sharesCount: post.shares_count,
    isEdited: post.is_edited,
    createdAt: post.created_at,
    author: {
      id: post.author.id,
      username: post.author.username,
      displayName: post.author.display_name,
      bio: null,
      avatarUrl: post.author.avatar_url,
      coverUrl: null,
      followersCount: post.author.followers_count,
      followingCount: post.author.following_count,
      postsCount: post.author.posts_count,
      createdAt: post.author.created_at,
    },
    media: (post.media ?? []).map((m: any) => ({
      id: m.id,
      url: m.url,
      type: m.type,
      width: m.width,
      height: m.height,
      thumbnailUrl: m.thumbnail_url,
    })),
    location: post.location
      ? {
          id: post.location.id,
          latitude: post.location.latitude,
          longitude: post.location.longitude,
          placeName: post.location.place_name,
          country: post.location.country,
          city: post.location.city,
          googlePlaceId: post.location.google_place_id,
        }
      : null,
    hashtags: [],
    isLiked,
    isSaved,
    status: post.status || 'unresolved',
  };
}

