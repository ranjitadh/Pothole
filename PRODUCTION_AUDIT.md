# Production Certification Audit: Pothole Watcher

**Prepared by:** Senior Mobile, Release, Compliance, Security & Performance Engineer  
**Date:** July 25, 2026  
**Status:** In Progress (Audit Complete, Fixes Planned)

---

## 1. Project Overview & Meta Information
- **Application Name:** Pothole (Pothole Watcher)
- **Package Name:** `com.pothole.app`
- **Expo SDK Version:** `57.0.7` (React Native `0.86.0`)
- **Target Android SDK:** `36` (Complies with Google Play policy requiring $\ge 34$)
- **Minimum Android SDK:** `24`
- **Supported Orientation:** Portrait only

---

## 2. Configuration Audit

### 2.1 Expo Configuration (`app.json`)
- **Scheme:** `"pothole"`
- **Typed Routes:** Enabled (`"typedRoutes": true` under experiments)
- **Plugins Installed:**
  - `expo-router`
  - `expo-splash-screen`
  - `expo-secure-store`
  - `expo-location`
  - `expo-notifications`
  - `expo-image-picker`
  - `react-native-maps`
- **Issues Found:**
  - The `expo-notifications` plugin configuration points to `./assets/images/icon.png` (a full-color 393KB logo). This will render as a solid white block on Android devices due to notification icon requirements. It must be updated to use the monochrome silhouette icon `./assets/images/android-icon-monochrome.png`.
  - Android permissions in `app.json` explicitly request `android.permission.RECORD_AUDIO`. This is a violation of Google Play’s data minimization policy since the app contains no audio recording features. It must be removed.

### 2.2 Package Dependencies (`package.json`)
- **Framework compatibility check (`npx expo-doctor`):**
  - **Major mismatch:** `@types/jest` found `30.0.0`, expected `29.5.14`.
  - **Minor mismatch:** `react-native-screens` found `4.25.2`, expected `~4.26.0`.
  - **Patch mismatches:** Mismatches on `expo`, `expo-image-picker`, `expo-linking`, `expo-location`, `expo-router`, `expo-splash-screen`, and `expo-web-browser`.
- **Security Audit (`npm audit`):**
  - Found 33 vulnerabilities (11 moderate, 22 high) in devDependencies (mostly nested under `jest` and `@expo/config-plugins`). These are development/build-time issues and are safely handled by pinning versions through Expo's doctor where applicable.

### 2.3 EAS Build & Submit Configuration (`eas.json`)
- **Keystore / Submission Credentials:** Configured to submit using `./google-services-key.json` targeting the `"internal"` track.
- **Environment variables:** Built-in environment variables are properly mapped for `production` profile, matching `.env` variables:
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  - `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`
  - `EXPO_PUBLIC_APP_URL`
- **Git Ignore Protection:** `.env`, `.env*`, and `google-services-key.json` are correctly listed in `.gitignore`.

---

## 3. Native Android Audit

### 3.1 Android Manifest (`AndroidManifest.xml`)
- **Permissions:** Matches `app.json` but includes redundant legacy permissions like `RECORD_AUDIO`.
- **Google Maps API Key:** Embedded directly in the manifest as `com.google.android.geo.API_KEY` with value `AIzaSyCpWyUEinrDXj7mZmC_9EOrS8MIcQwyN5E`. Exposure of API keys in public repositories is a security issue. The key needs to be restricted on the Google Cloud Console to only accept requests from the SHA-1 fingerprint of the signing certificate of `com.pothole.app`.
- **Deep Linking Scheme:** Properly registers `pothole://` deep link filter.

### 3.2 Gradle & NDK Settings
- **Gradle Version:** Incompatible warning with Gradle 10, running on Gradle 9.3.1.
- **Build Tools:** SDK 36 (targetSdk 36, compileSdk 36).
- **NDK Build Blocker:** Gradle assembly failed with the error:
  `com.android.builder.errors.EvalIssueException: [CXX1101] NDK at /Users/ranjit/Library/Android/sdk/ndk/27.1.12297006 did not have a source.properties file`
  *Action taken:* Corrupt NDK directory removed; clean download triggered.

---

## 4. Visual Assets, Icons, and Splash Screens

### 4.1 Application Icons
- **Adaptive Icon Settings:**
  - Background: `#E6F4FE`
  - Foreground: `./assets/images/android-icon-foreground.png`
  - Background image: `./assets/images/android-icon-background.png`
  - Monochrome image: `./assets/images/android-icon-monochrome.png`
- **Status:** Android resources include compiled mipmaps under the required DPI folders. Will verify icon representation after build completes.

### 4.2 Splash Screen
- **Splash configuration:** Uses `./assets/images/splash-icon.png` on `#ffffff` background with `contain` resize mode.
- **Flicker/Flash Issue:** In `app/_layout.tsx`, the splash screen is hidden as soon as the font loader finishes, even if the database authentication state has not finished loading. This triggers a brief white blank screen or loading spinner before navigation.
- **Correction:** Modify `app/_layout.tsx` to hide the splash screen only when both fonts are loaded and the auth initialization state (`isLoading`) is false.

---

## 5. Security & Authentication Audit

### 5.1 Deep Linking Scheme Discrepancy
- In `app/(auth)/forgot-password.tsx` (and its Jest test), the redirect URI is configured as `potholereactnative://reset-password`.
- The actual deep link scheme is `pothole://`.
- **Impact:** Resetting passwords will send users to a link that cannot be opened by the application, causing reset password flows to fail.
- **Correction:** Change the deep link URL in the login/reset redirection to `pothole://reset-password`.

### 5.2 TypeScript Compilation Failures (Build Blockers)
- **Failure 1:** `app/profile/[username].tsx` mapping code is missing required properties for `PostWithDetails` type, specifically `isEdited`, `hashtags`, and contains mismatched types for `media` (expects `PostMedia` but maps database keys directly) and `location` (mismatched schema).
- **Failure 2:** `components/PostCard.tsx` contains a routing validation error:
  `Type '"/profile/[username]"' is not assignable to type ...` due to Expo Router typed route validation. Needs type coercion or dynamic typed routing mapping.

---

## 6. Audit Summary of Issues to Fix

| ID | Issue Description | Severity | Component | Status |
|----|-------------------|----------|-----------|--------|
| **1** | NDK source.properties error / build failure | Critical | Build / Gradle | Corrupted folder deleted; rebuild in progress |
| **2** | TypeScript Compiler Errors (Profile & PostCard) | Critical | Code / TypeScript | Plan formulated |
| **3** | Redirect URI mismatch (`potholereactnative://` vs `pothole://`) | High | Auth / Deep Linking | Plan formulated |
| **4** | Splash screen hides before Auth Store is loaded (White flash) | Medium | UX / Splash | Plan formulated |
| **5** | Redundant `RECORD_AUDIO` permission (Google Play compliance) | Medium | Google Play / Manifest | Plan formulated |
| **6** | Notification icon points to high-res color image (renders white block) | Medium | Notifications / Assets | Plan formulated |

---
