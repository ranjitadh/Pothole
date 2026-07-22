export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  createdAt: string;
  isFollowed?: boolean;
}

export interface PostWithDetails {
  id: string;
  userId: string;
  text: string | null;
  visibility: 'public' | 'private' | 'followers';
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  isEdited: boolean;
  createdAt: string;
  author: UserProfile;
  media: PostMedia[];
  location: LocationInfo | null;
  hashtags: string[];
  isLiked: boolean;
  isSaved: boolean;
  status: 'unresolved' | 'in_progress' | 'resolved';
}

export interface PostMedia {
  id: string;
  url: string;
  type: 'image' | 'video';
  width: number | null;
  height: number | null;
  thumbnailUrl: string | null;
}

export interface LocationInfo {
  id: string;
  latitude: number;
  longitude: number;
  placeName: string | null;
  country: string | null;
  city: string | null;
  googlePlaceId: string | null;
}

export interface CommentWithDetails {
  id: string;
  postId: string;
  userId: string;
  text: string;
  isEdited: boolean;
  createdAt: string;
  author: UserProfile;
  parentId?: string | null;
  replies?: CommentWithDetails[];
}

export interface NotificationWithActor {
  id: string;
  userId: string;
  type: 'like' | 'comment' | 'follow';
  postId: string | null;
  commentId: string | null;
  read: boolean;
  createdAt: string;
  actor: UserProfile;
}

export interface PaginatedResponse<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface ApiError {
  message: string;
  code: string;
  status: number;
}

export interface ApiResponse<T> {
  data: T | null;
  error: ApiError | null;
}
