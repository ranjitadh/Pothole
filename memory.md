# Pothole Watcher - Project Memory

## Project Overview
**Pothole Watcher** is a mobile-first social reporting app where users can report potholes and road hazards by posting photos with GPS locations. The app enables community-driven infrastructure maintenance reporting with upvoting, commenting, status tracking, and user blocking.

- **Package name:** `com.pothole.app`
- **App name:** Pothole Watcher
- **Owner:** `ranjitadh`
- **EAS Project ID:** `f4579e84-439d-4b0a-b4c2-4c9e6068ac62`

---

## Tech Stack
| Layer | Technology | Version |
|---|---|---|
| Framework | Expo SDK | 57 |
| UI | React Native | 0.86.0 |
| React | React | 19.2.3 |
| Routing | Expo Router | ~57.0.7 |
| Backend | Supabase | JS v2.110.8 |
| Server State | TanStack React Query | v5 |
| Client State | Zustand | v5 |
| Styling | NativeWind (Tailwind) + StyleSheet | Hybrid |
| Icons | lucide-react-native | v1.25 |
| Maps | react-native-maps | 1.27.2 |
| Testing | Jest 29 + @testing-library/react-native 12 | - |
| Build | EAS Build (production app-bundle) | - |

---

## Key Architecture Decisions

### 1. Supabase as Full Backend
All backend logic runs on Supabase: auth, database (PostgreSQL), file storage, and server-side functions (RPCs). No separate backend server.

### 2. TanStack Query for Server State
All API data (posts, comments, notifications, search results) is managed via TanStack Query with cursor-based pagination, cache invalidation, and optimistic updates.

### 3. Zustand for Client State Only
Three Zustand stores handle purely client-side state:
- **auth-store:** User session + profile (initialized from Supabase auth listener)
- **theme-store:** Dark/light/system preference
- **vote-store:** Local downvote tracking (persisted to AsyncStorage)

### 4. Cursor-Based Pagination
Feed uses cursor-based infinite scroll (`useInfiniteQuery`) rather than offset-based pagination. Cursor is the `created_at` of the last item.

### 5. Hybrid Styling (NativeWind + StyleSheet)
NativeWind/Tailwind is configured but only adopted in `register.tsx` and `forgot-password.tsx`. All other screens use `StyleSheet.create`. Future development should pick one approach.

### 6. Local Downvotes vs Server-Side Upvotes
- **Upvotes** (likes) are stored in the `likes` table in Supabase (server-side).
- **Downvotes** are tracked locally via Zustand + AsyncStorage (not persisted to DB). This is a deliberate product decision — downvotes only affect the local user's view.

### 7. Blocking System
Blocked users' posts are filtered at the query level in `getFeedPosts()` — the client fetches the block list first, then excludes those user IDs from the post query.

---

## Environment Variables
```
EXPO_PUBLIC_SUPABASE_URL=https://ymfzcapzpghfvlzczdgf.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSyCpWyUEinrDXj7mZmC_9EOrS8MIcQwyN5E
EXPO_PUBLIC_APP_URL=https://pathhole-neon.vercel.app
```
Duplicate `NEXT_PUBLIC_*` vars exist for web/Next.js compatibility.

---

## Supabase Configuration
- **Auth token storage:** `expo-secure-store` on native, `localStorage` on web (custom adapter in `services/supabase.ts`)
- **Auth settings:** `autoRefreshToken: true`, `persistSession: true`, `detectSessionInUrl: false`
- **Storage bucket:** `post_media` (public read access)
- **Email confirmation:** Disabled (for development)

---

## Database Tables (Inferred)
| Table | Purpose |
|---|---|
| `profiles` | User profiles (extends auth.users) |
| `posts` | Pothole/hazard reports |
| `post_media` | Images attached to posts |
| `locations` | GPS coordinates + place names |
| `likes` | Post upvotes |
| `saved_posts` | Bookmarks |
| `comments` | Post comments (with nested replies) |
| `blocks` | User blocking relationships |
| `notifications` | In-app notifications |
| `reports` | Content reports |
| `hashtags` | Hashtag registry |

### RPC Functions
- `increment_post_shares(post_id)` — Atomic share count increment
- `delete_user_account()` — Server-side account deletion

---

## Navigation Structure
```
Root Stack
├── (auth)/           — Auth screens (headerless stack)
│   ├── login
│   ├── register
│   └── forgot-password
│
└── (tabs)/           — Main app (floating pill tab bar)
    ├── index          → Feed (Home)
    ├── explore        → Search
    ├── create         → Create Post (raised center button)
    ├── notifications  → Notifications
    └── profile        → Profile/Settings (headerless)
```

**Auth guard** in `app/_layout.tsx`: Redirects unauthenticated users to login, authenticated users away from auth screens.

---

## Testing
- **87+ tests** across 13 test files
- All Supabase calls mocked via `__mocks__/supabase.ts`
- Expo modules mocked individually in `__mocks__/`
- Run: `npm test` or `npm run test:watch`
- `@testing-library/react-native@12` required (v14 incompatible with Jest 29)
- `.npmrc` with `legacy-peer-deps=true` needed for EAS builds

---

## Known Issues / Technical Debt
1. **Hybrid styling:** Only 2 of ~12 screens use NativeWind; rest use StyleSheet. Should standardize.
2. **`@testing-library/react-native@12`** is deprecated; v13+ requires peer dep override or Jest upgrade.
3. **`@types/jest@30`** mismatch with Expo's expected `29.5.14` (minor warning in `expo doctor`).
4. Several Expo packages are 1 patch version behind latest SDK 57 releases.
5. `expo-go` warning on production builds — should switch to dev client for production development.
6. Profile screen (`profile.tsx`) is 946 lines — should be broken into smaller components.
7. Cover/Avatar upload flow in profile re-uploads on every save even if unchanged.

---

## Conventions
- **File naming:** kebab-case for files (`auth-store.ts`), PascalCase for components (`PostCard.tsx`)
- **Route groups:** `(auth)` and `(tabs)` for Expo Router groups
- **Services layer:** All Supabase calls go through `services/post.ts` (never called directly from components)
- **Types:** Centralized in `types/index.ts`
- **Colors:** Primary `#ea580c` (orange), defined in `constants/Colors.ts` and `tailwind.config.js`
- **Icons:** All from `lucide-react-native` (no other icon libraries)
