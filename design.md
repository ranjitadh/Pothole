# Pothole Watcher - Design Documentation

## Brand Identity
- **App Name:** Pothole Watcher
- **Primary Color:** `#ea580c` (Orange-600) — used for CTAs, active tabs, badges, accents
- **Category:** Civic infrastructure / Community reporting
- **Tone:** Clean, utilitarian, community-focused

---

## Color System

### Light Mode
| Token | Hex | Usage |
|---|---|---|
| Background | `#ffffff` | Screen background |
| Surface | `#f8fafc` (slate-50) | Secondary backgrounds |
| Card | `#ffffff` | Card backgrounds |
| Text Primary | `#0f172a` (slate-900) | Headings, body text |
| Text Secondary | `#64748b` (slate-500) | Subtitles, timestamps |
| Muted | `#94a3b8` (slate-400) | Placeholder text |
| Border | `#e2e8f0` (slate-200) | Dividers, card borders |
| Primary | `#ea580c` | Buttons, links, active states |
| Danger | `#ef4444` | Delete, error states |

### Dark Mode
| Token | Hex | Usage |
|---|---|---|
| Background | `#0f172a` (slate-900) | Screen background |
| Surface | `#1e293b` (slate-800) | Card backgrounds |
| Text Primary | `#f8fafc` (slate-50) | Headings, body text |
| Text Secondary | `#94a3b8` (slate-400) | Subtitles, timestamps |
| Border | `#334155` (slate-700) | Dividers, card borders |

### Status Badge Colors
| Status | Background | Text | Meaning |
|---|---|---|---|
| Unresolved | `#fef3c7` | `#b45309` | Reported, not yet addressed |
| In Progress | `#dbeafe` | `#1d4ed8` | Being investigated |
| Resolved | `#d1fae5` | `#047857` | Fixed |

---

## Typography
- **Primary font:** System default (San Francisco on iOS, Roboto on Android)
- **Monospace font:** SpaceMono-Regular (`assets/fonts/SpaceMono-Regular.ttf`) — used in `MonoText` component
- **Text styles:** Defined per-component via `StyleSheet.create`; no global type scale

---

## Layout System

### Floating Tab Bar (`app/(tabs)/_layout.tsx`)
- **Position:** Absolute bottom, centered horizontally
- **Shape:** Pill/capsule with `borderTopLeftRadius: 24`, `borderTopRightRadius: 24`
- **Shadow:** `shadowColor: '#000'`, elevation 8, opacity 0.1, radius 12
- **Height:** Dynamic based on content + safe area
- **Background:** `#ffffff` (light) / `#1e293b` (dark)
- **Active color:** `#ea580c`
- **Inactive color:** `#64748b` (light) / `#94a3b8` (dark)

### Center Create Button
- Raised circular button (44x44) above tab bar
- Background: `#ea580c`, white Plus icon
- Slightly elevated with shadow

### Screen Padding
- Horizontal: 16px standard
- Vertical: Varies per screen (typically 16-24px)

---

## Component Design Patterns

### PostCard (`components/PostCard.tsx`)
The primary content display component. Structure:

```
┌─────────────────────────────────────┐
│ [Avatar] Name @username    [Badge]  │  ← Header row
│ [Status] Unresolved/In Progress/... │
│─────────────────────────────────────│
│ 📍 Place Name, City                 │  ← Location tag (if present)
│─────────────────────────────────────│
│ Description text of the pothole...  │  ← Body text
│─────────────────────────────────────│
│ [──────── Image ────────]           │  ← Media (if present)
│─────────────────────────────────────│
│ ▲ 42  ▼  │ 💬 12  │ 🔄 3  │ ↗     │  ← Action toolbar
└─────────────────────────────────────┘
```

**Toolbar buttons:** Capsule/pill-shaped with icon + count, horizontal scroll
**Context menu (⋯):** Floating dropdown positioned relative to trigger
- Own posts: Mark status (3 options), Delete
- Other posts: Report (with reason list), Block User

### CommentsDrawer (`components/CommentsDrawer.tsx`)
- **Presentation:** React Native Modal with bottom-sheet styling
- **Max height:** 70% of screen
- **Nested replies:** Recursive `CommentItem` with left border indentation
- **Input:** Fixed at bottom with keyboard-avoiding behavior
- **Reply indicator:** Shows "@username" when replying to a comment

### PinpointLocationModal (`components/PinpointLocationModal.tsx`)
- **Presentation:** Full-screen React Native Modal
- **Map:** `react-native-maps` MapView with draggable marker
- **Search bar:** Top of modal, forward geocoding via expo-location
- **Locate Me:** Current GPS position button
- **Default coords:** 27.6710, 85.3240 (Kathmandu/Lalitpur, Nepal)
- **Confirm button:** Bottom, returns `{ latitude, longitude, placeName }`

### Auth Screens
- **Login:** Email + password + Google OAuth button + forgot password link + sign up link
- **Register:** Username + display name + email + password
- **Forgot Password:** Email input + reset button
- All use full-screen white background with centered card layout

### Profile Screen (`app/(tabs)/profile.tsx`)
```
┌─────────────────────────────┐
│ [──────── Cover ──────────] │  ← Cover photo (tap to edit)
│      [Avatar]               │  ← Circular avatar (tap to edit)
│      Display Name           │
│      @username              │
│      Bio text here...       │  ← Tap to edit
│                             │
│  📝 12  👥 342  👤 56      │  ← Stats: Reports/Followers/Following
│                             │
│  ── Settings ──────────     │
│  🔔 Push Notifications  [↔] │
│  📍 Location Services   [↔] │  ← Toggle switches
│  🌙 Dark Mode           [↔] │
│                             │
│  ── Account ───────────     │
│  🔑 Change Password         │  ← Expandable form
│                             │
│  ── Danger Zone ───────     │
│  🗑️ Delete Account          │  ← Red, with confirmation
│  🚪 Sign Out                │  ← With confirmation dialog
└─────────────────────────────┘
```

---

## Interaction Patterns

### Pull-to-Refresh
- Used on Feed screen (`index.tsx`)
- Standard `RefreshControl` with orange tint

### Infinite Scroll
- Feed loads 10 posts per page
- Triggers at 50% scroll threshold
- Shows loading spinner at bottom

### Search
- 350ms debounce on input
- Three sub-tabs: Users / Posts / Hashtags
- Empty state with search illustration

### Voting
- Upvote: Server-side (Supabase `likes` table), optimistic update
- Downvote: Local-only (Zustand + AsyncStorage), toggles with upvote
- Vote score = upvotes - local_downvotes (client-calculated)

### Modals
- CommentsDrawer: Bottom-sheet style
- LocationPicker: Full-screen overlay
- BioEdit: Alert-style prompt
- Delete/SignOut: Confirmation dialog (Alert.alert)

---

## Icons (lucide-react-native)
| Icon | Usage |
|---|---|
| Home | Feed tab |
| Search | Search tab |
| Plus | Create tab |
| Bell | Notifications tab |
| User | Profile tab |
| Heart | Like (filled when liked) |
| MessageCircle | Comments |
| Bookmark | Save/unsave |
| MapPin | Location tag |
| ArrowUp / ArrowDown | Vote buttons |
| Repeat | Repost |
| Forward | Share |
| MoreHorizontal | Context menu trigger |
| Trash2 | Delete actions |
| Flag | Report |
| ShieldAlert | Block user |
| Camera / ImageIcon | Photo capture |
| Moon / Sun | Theme toggle |
| Eye / EyeOff | Password visibility |
| Globe | Public visibility |
| Send | Comment submit |
| Locate | Current location |
| X | Close/dismiss |
| Hash | Hashtags |

---

## Responsive Behavior
- **Orientation:** Portrait only (locked)
- **Tablet:** iOS `supportsTablet: true` but no tablet-specific layouts
- **Safe areas:** Handled via `react-native-safe-area-context`
- **Keyboard:** `KeyboardAvoidingView` in comments and auth screens

---

## Empty States
Each screen has a dedicated empty state:
- **Feed:** "No posts yet" illustration
- **Search:** Search prompt illustration
- **Notifications:** Bell icon with "No notifications yet"
- **Comments:** "No comments yet" message

---

## Error States
- Network errors: Toast/alert with retry option
- Permission denied: Explanation text
- Form validation: Inline error messages + alert dialogs
