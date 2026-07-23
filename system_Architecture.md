# Pothole Watcher - System Architecture

## High-Level Architecture

```
┌──────────────────────────────────────────────────┐
│                   MOBILE CLIENT                   │
│  Expo SDK 57 + React Native 0.86 + Expo Router   │
│                                                   │
│  ┌──────────┐  ┌──────────┐  ┌────────────────┐  │
│  │  Screens  │  │ Components│  │ Services Layer │  │
│  │  (Routes) │──│ (UI)      │──│ (API calls)    │  │
│  └──────────┘  └──────────┘  └───────┬────────┘  │
│                                      │            │
│  ┌──────────────────────────────────┐│            │
│  │         State Management         ││            │
│  │  TanStack Query (server state)   ││            │
│  │  Zustand (client state)          ││            │
│  └──────────────────────────────────┘│            │
└──────────────────────────────────────┼────────────┘
                                       │ HTTPS
                                       ▼
┌──────────────────────────────────────────────────┐
│                   SUPABASE                        │
│  ┌──────────┐  ┌──────────┐  ┌────────────────┐  │
│  │   Auth    │  │PostgreSQL│  │    Storage      │  │
│  │  (JWT)    │  │  (DB)    │  │ (post_media)   │  │
│  └──────────┘  └──────────┘  └────────────────┘  │
│                                                   │
│  ┌──────────────────────────────────────────────┐ │
│  │  RPCs: increment_post_shares,                │ │
│  │        delete_user_account                   │ │
│  └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

---

## Client Architecture

### Layer 1: Screens (Routes)
Expo Router file-based routing. Each screen is a self-contained page.

```
app/
├── _layout.tsx              ← Root: QueryClientProvider + Auth Guard
├── (auth)/
│   ├── _layout.tsx          ← Stack navigator (headerless)
│   ├── login.tsx            ← Email/password + Google OAuth
│   ├── register.tsx         ← Username + display name + email + password
│   └── forgot-password.tsx  ← Password reset email
└── (tabs)/
    ├── _layout.tsx          ← Custom floating tab bar
    ├── index.tsx            ← Feed (infinite scroll)
    ├── explore.tsx          ← Unified search (users/posts/hashtags)
    ├── create.tsx           ← Post creation form
    ├── notifications.tsx    ← Notification feed
    └── profile.tsx          ← Profile + settings + account
```

### Layer 2: Components
Reusable UI components consumed by screens.

| Component | Purpose | Used By |
|---|---|---|
| `PostCard` | Full post display with voting, actions, context menu | Feed, Explore |
| `CommentsDrawer` | Bottom-sheet comments with nested replies | PostCard |
| `PinpointLocationModal` | Full-screen map location picker | Create |
| `Themed` | Theme-aware View/Text wrappers | Throughout |

### Layer 3: Services
All Supabase API calls are centralized here. Screens never call Supabase directly.

```
services/
├── supabase.ts          ← Client initialization + auth config
├── post.ts              ← Posts, comments, search, likes, saves, upload
└── notifications.ts     ← Push notification registration
```

### Layer 4: State Management

#### Server State (TanStack Query)
```
QueryClient (app/_layout.tsx)
│
├── Query: ['feed']              → getFeedPosts()     (infinite)
├── Query: ['explore']           → getExplorePosts()  (infinite)
├── Query: ['notifications']     → notifications table
├── Query: ['comments', postId]  → getComments(postId)
│
├── Mutation: likePost / unlikePost     → invalidates ['feed']
├── Mutation: createComment             → invalidates ['comments']
├── Mutation: createPost                → invalidates ['feed']
└── Mutation: updatePostStatus          → invalidates ['feed']
```

#### Client State (Zustand)
```
auth-store.ts
├── state:  user, profile, isLoading, isAuthenticated
├── init:   Gets session + profile on app start
├── listen: onAuthStateChange (SIGNED_IN/OUT/TOKEN_REFRESHED)
└── persist: expo-secure-store (native) / localStorage (web)

theme-store.ts
├── state:  themeMode ('light' | 'dark' | 'system')
└── persist: AsyncStorage

vote-store.ts
├── state:  downvotedPostIds, upvotedCommentIds, downvotedCommentIds
├── persist: AsyncStorage (zustand/persist middleware)
└── purpose: Local-only vote tracking (not synced to server)
```

---

## Data Flow

### Post Creation Flow
```
User fills form (text + photo + location)
  │
  ├─ [1] uploadPhoto(uri)
  │       → POST to Supabase Storage bucket 'post_media'
  │       → Returns public URL
  │
  ├─ [2] createPost({ text, media, location })
  │       → INSERT into 'locations' table (if location provided)
  │       → INSERT into 'posts' table
  │       → INSERT into 'post_media' table (if media provided)
  │
  └─ [3] QueryClient.invalidateQueries(['feed'])
          → Feed re-fetches to show new post
```

### Post Feed Loading Flow
```
Screen mounts → useInfiniteQuery(['feed'])
  │
  ├─ [1] getFeedPosts(cursor?)
  │       → Fetch current user's blocks (exclude blocked users)
  │       → SELECT posts WHERE user_id NOT IN blocked_ids
  │       → JOIN profiles, post_media, locations
  │       → Check if current user liked/saved each post
  │       → Return first 10 posts + nextCursor
  │
  ├─ [2] User scrolls to 50% threshold
  │       → Trigger fetchNextPage()
  │       → getFeedPosts(lastCursor)
  │
  └─ [3] Data renders in PostCard components
```

### Authentication Flow
```
App Start → auth-store.initialize()
  │
  ├─ [1] supabase.auth.getSession()
  │       → Returns existing session or null
  │
  ├─ [2] If session exists → fetch profile from 'profiles' table
  │
  ├─ [3] supabase.auth.onAuthStateChange()
  │       → Listens for SIGNED_IN, TOKEN_REFRESHED, SIGNED_OUT
  │
  └─ [4] Auth Guard (app/_layout.tsx)
          → No user + not on auth screen → redirect to login
          → Has user + on auth screen → redirect to tabs
```

### Vote Flow
```
User taps Upvote on PostCard
  │
  ├─ [Server] likePost(postId)
  │           → Check if like exists (idempotent)
  │           → INSERT into 'likes' table
  │           → Increment likes_count
  │
  └─ [Optimistic] Update UI immediately

User taps Downvote on PostCard
  │
  └─ [Local Only] vote-store.togglePostDownvote(postId)
                  → Add/remove from downvotedPostIds
                  → Persisted to AsyncStorage
                  → Score = likes_count - downvote_count (local)
```

### Comment System Flow
```
User taps Comment icon on PostCard
  │
  ├─ [1] CommentsDrawer opens (Modal)
  │       → useQuery(['comments', postId]) → getComments(postId)
  │
  ├─ [2] Flat comment list → Build nested tree (parent_id mapping)
  │
  ├─ [3] User types comment → useMutation(createComment)
  │       → INSERT into 'comments' table (with optional parent_id)
  │
  └─ [4] QueryClient.invalidateQueries(['comments', postId])
          → Comments re-fetch
```

---

## Database Schema

### Entity Relationship
```
profiles (1) ──── (N) posts
profiles (1) ──── (N) comments
profiles (1) ──── (N) likes
profiles (1) ──── (N) saved_posts
profiles (1) ──── (N) notifications (as user_id)
profiles (1) ──── (N) notifications (as actor_id)
profiles (1) ──── (N) blocks (as blocker_id)
profiles (1) ──── (N) blocks (as blocked_id)

posts (1) ──── (N) post_media
posts (1) ──── (N) comments
posts (1) ──── (N) likes
posts (1) ──── (N) saved_posts
posts (1) ──── (N) reports
posts (0..1) ── (1) locations

comments (self-referencing) ── parent_id → comments.id
```

### Table Details

#### `profiles`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | References auth.users |
| username | text | Unique, searchable |
| display_name | text | Searchable |
| bio | text? | Max ~160 chars shown |
| avatar_url | text? | Supabase Storage URL |
| cover_url | text? | Supabase Storage URL |
| followers_count | int | Denormalized count |
| following_count | int | Denormalized count |
| posts_count | int | Denormalized count |
| created_at | timestamptz | |

#### `posts`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → profiles | Author |
| text | text? | Post description |
| visibility | enum | 'public' \| 'private' \| 'followers' |
| location_id | uuid FK → locations | |
| likes_count | int | Denormalized |
| comments_count | int | Denormalized |
| shares_count | int | Denormalized, incremented via RPC |
| is_edited | bool | |
| status | enum | 'unresolved' \| 'in_progress' \| 'resolved' |
| created_at | timestamptz | Used as pagination cursor |

#### `post_media`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| post_id | uuid FK → posts | |
| url | text | Supabase Storage public URL |
| type | text | 'image' \| 'video' |
| width | int? | |
| height | int? | |
| thumbnail_url | text? | |

#### `locations`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| latitude | float | |
| longitude | float | |
| place_name | text? | Reverse geocoded name |
| country | text? | |
| city | text? | |
| google_place_id | text? | |

#### `likes`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → profiles | |
| post_id | uuid FK → posts | Unique(user_id, post_id) |

#### `saved_posts`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → profiles | |
| post_id | uuid FK → posts | Unique(user_id, post_id) |

#### `comments`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| post_id | uuid FK → posts | |
| user_id | uuid FK → profiles | |
| text | text | |
| is_edited | bool | |
| parent_id | uuid? FK → comments | For nested replies |
| created_at | timestamptz | |

#### `blocks`
| Column | Type | Notes |
|---|---|---|
| blocker_id | uuid FK → profiles | |
| blocked_id | uuid FK → profiles | |

#### `notifications`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → profiles | Recipient |
| actor_id | uuid FK → profiles | Who triggered it |
| type | enum | 'like' \| 'comment' \| 'follow' |
| post_id | uuid? | Reference to post |
| comment_id | uuid? | Reference to comment |
| read | bool | |
| created_at | timestamptz | |

#### `reports`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| reporter_id | uuid FK → profiles | |
| post_id | uuid FK → posts | |
| reason | enum | 'spam' \| 'hate_speech' \| 'harassment' \| 'nudity' \| 'violence' \| 'other' |
| description | text? | Optional details |

#### `hashtags`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | text | Searchable |
| posts_count | int | Denormalized |

---

## Storage

### Supabase Storage
- **Bucket:** `post_media`
- **Access:** Public read
- **Upload:** Via `uploadPhoto()` in `services/post.ts`
- **Flow:** Client uploads file → Supabase returns public URL → URL stored in `post_media` table

---

## Server-Side Functions (RPCs)

| Function | Input | Purpose |
|---|---|---|
| `increment_post_shares` | post_id | Atomic increment of shares_count (prevents race conditions) |
| `delete_user_account` | (none) | Deletes user and all associated data |

---

## API Layer Detail (`services/post.ts`)

| Function | Method | Description |
|---|---|---|
| `getFeedPosts(cursor?, limit?)` | SELECT | Paginated feed, filters blocked users |
| `getExplorePosts(cursor?, limit?)` | SELECT | Paginated explore (no block filter) |
| `likePost(postId)` | INSERT | Idempotent like |
| `unlikePost(postId)` | DELETE | Remove like |
| `savePost(postId)` | INSERT | Idempotent bookmark |
| `unsavePost(postId)` | DELETE | Remove bookmark |
| `createPost(data)` | INSERT | Creates post + location + media |
| `deletePost(postId)` | DELETE | Hard delete |
| `updatePostStatus(postId, status)` | UPDATE | Change status |
| `blockUser(blockedId)` | INSERT | Block a user |
| `reportPost(postId, reason, desc?)` | INSERT | Report content |
| `searchUsers(query)` | SELECT | ILIKE on username/display_name |
| `searchPosts(query)` | SELECT | ILIKE on post text |
| `searchHashtags(query)` | SELECT | ILIKE on hashtag name |
| `getComments(postId)` | SELECT | Comments with author join |
| `createComment(postId, text, parentId?)` | INSERT | Comment or reply |
| `deleteComment(commentId)` | DELETE | Hard delete |
| `repostPost(postId)` | RPC | Increment shares via RPC |
| `uploadPhoto(uri)` | STORAGE | Upload to post_media bucket |

---

## Build & Deployment

### Build Pipeline
```
Local Code → EAS Build (cloud)
  │
  ├─ [1] npm ci (with .npmrc legacy-peer-deps)
  ├─ [2] expo doctor (warnings only, non-blocking)
  ├─ [3] expo prebuild (generates android/ directory)
  ├─ [4] Metro bundle (JS)
  ├─ [5] Gradle build (native Android)
  └─ [6] Output: .aab (Android App Bundle)
```

### EAS Profiles
| Profile | Distribution | Build Type | Use Case |
|---|---|---|---|
| development | internal | APK | Dev testing with Expo Go / dev client |
| preview | internal | APK | Internal testing (QA, stakeholders) |
| production | store | App Bundle | Google Play Store submission |

### Deployment Flow
```
EAS Build (.aab) → Google Play Console → Internal Track → Production Track → User devices
```

---

## Testing Architecture

### Test Stack
- **Runner:** Jest 29 + jest-expo preset
- **Assertions:** @testing-library/react-native 12 + jest-native matchers
- **Mocks:** Manual mocks in `__mocks__/` for all Expo/native modules

### Test Organization
```
__tests__/
├── app/(auth)/     → Screen-level tests (render, input, submit, navigation)
├── app/(tabs)/     → Screen-level tests (data loading, interactions)
├── components/     → Component tests (rendering, events, props)
├── services/       → Service tests (API calls, data formatting)
└── store/          → Store tests (state transitions, actions)
```

### Mocking Strategy
- **Supabase:** Full chainable query builder mock with `.select()`, `.insert()`, `.eq()`, etc.
- **Expo modules:** Individual mocks per module (router, location, image-picker, etc.)
- **React Navigation:** useRouter/useSegments mocked via expo-router mock
- **TanStack Query:** Real QueryClientProvider wraps tests (queries run against mocked services)
