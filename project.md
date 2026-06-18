# Soundwave Project Guide

This document explains the Soundwave project for developers, maintainers, and AI agents. It is meant to be the first file to read before changing code.

## 1. Project Summary

Soundwave is a music streaming platform inspired by apps like Spotify. It has:

- A React Native mobile app built with Expo.
- A Node.js/Express backend API.
- Supabase for authentication, Postgres database, row-level security, and file storage.
- Creator features for uploading and managing music.
- Admin features for user management, content moderation, roles, reports, and audit logs.

The repository currently has three top-level areas:

```text
soundwave/
  backend/   Express API, Supabase migrations, upload/streaming logic
  mobile/    Expo React Native client
  shared/    Empty placeholder for future shared code
```

## 2. Technology Stack

### Mobile

- Expo SDK 54
- React 19
- React Native 0.81
- TypeScript
- React Navigation
- Redux Toolkit
- Supabase JS client
- Expo Secure Store
- expo-av / expo-audio for audio playback
- Expo document/image picker packages for creator upload flows

Important note: `mobile/AGENTS.md` says Expo has changed and code changes should use the Expo v54 docs.

### Backend

- Node.js 18+
- Express
- Supabase JS client
- Multer for multipart uploads
- Helmet, CORS, Morgan, express-rate-limit
- Nodemon for development

### Database and Storage

- Supabase Auth
- Supabase Postgres
- Supabase Row Level Security
- Supabase Storage bucket named `audio`

Older documentation in `SETUP.md` mentions Cloudflare R2, but the implemented upload controller currently uses Supabase Storage.

## 3. Top-Level Files

### `SETUP.md`

Original setup guide. It explains Supabase project creation and database migrations. Some storage instructions are outdated because the code now uses Supabase Storage instead of Cloudflare R2.

### `project.md`

This file. Use it as the high-level project map.

## 4. Mobile App Structure

Main directory:

```text
mobile/
  App.tsx
  app.json
  index.ts
  package.json
  src/
    components/
    hooks/
    navigation/
    screens/
    services/
    store/
    types/
    utils/
```

### Mobile Entry Point

`mobile/App.tsx`:

- Imports gesture/random polyfills.
- Wraps the app in Redux `<Provider>`.
- Renders the central `Navigation` component.

### Navigation

`mobile/src/navigation/index.tsx` is one of the most important files.

It handles:

- Auth session restore from Supabase.
- Loading the user's profile from the `users` table.
- Blocking inactive accounts.
- Profile completion routing.
- Auth stack vs authenticated app stack.
- Main bottom tabs.
- Mini player.
- Full player overlay.
- Track playback entry point.

Main tab screens:

- `Home`
- `Search`
- `NowPlaying`
- `Library`
- `Profile`

Authenticated stack screens include:

- `BecomeArtist`
- `CreatorDashboard`
- `UploadTrack`
- `UploadAlbum`
- `UploadArtistPlaylist`
- `PlaylistDetail`
- `AlbumDetail`
- `ArtistProfile`
- `BrowseResults`
- Admin screens

Auth stack screens include:

- `Welcome`
- `Login`
- `Register`
- `PhoneLogin`
- `OtpVerify`

### Redux Store

`mobile/src/store/index.ts` registers:

- `auth`: user/session/loading/error state.
- `player`: current track, queue, playback state, position, duration, shuffle/repeat.
- `theme`: dark/light state.

Important files:

- `mobile/src/store/slices/authSlice.ts`
- `mobile/src/store/slices/playerSlice.ts`
- `mobile/src/store/slices/themeSlice.ts`

### Services

`mobile/src/services/supabase.ts`:

- Creates the Supabase client.
- Reads `EXPO_PUBLIC_SUPABASE_URL`.
- Reads `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- Uses SecureStore on native platforms.
- Lets Supabase use localStorage on web.

`mobile/src/services/api.ts`:

- Central backend API client.
- Reads `EXPO_PUBLIC_API_URL`.
- Adds Supabase JWT bearer token when available.
- Contains methods for tracks, streaming, likes, artists, albums, playlists, admin users, reports, recently played, and play completion.

`mobile/src/services/audioPlayer.ts`:

- Thin wrapper around `expo-av` `Audio.Sound`.
- Handles play, pause, resume, stop, seek, and current sound instance.

`mobile/src/services/playlistService.ts`:

- Handles playlist creation and related playlist operations.

`mobile/src/services/adminService.ts`:

- Admin-focused API/service helper.

### Hooks

`mobile/src/hooks/useNetworkStatus.ts`:

- Checks internet connectivity by making a HEAD request to `https://dns.google`.
- Times out after 3 seconds.
- Rechecks every 8 seconds.
- Returns `{ isOnline }`.

`mobile/src/hooks/usePlayer.ts`:

- Player-related hook.

`mobile/src/hooks/useToast.ts`:

- Toast UI state helper.

`mobile/src/hooks/useAppDispatch.ts`:

- Typed Redux dispatch and selector hooks.

### Screens

#### Auth Screens

Directory: `mobile/src/screens/auth/`

- `WelcomeScreen.tsx`
- `LoginScreen.tsx`
- `RegisterScreen.tsx`
- `PhoneLoginScreen.tsx`
- `OtpVerifyScreen.tsx`
- `ProfileCompletionScreen.tsx`

Supabase Auth handles signup/login. The app profile lives in the `users` table.

#### Home

File: `mobile/src/screens/home/HomeScreen.tsx`

Home loads sections such as:

- Recently played
- New releases
- New albums
- Popular artists
- Artist spotlight
- Browse genres
- Bollywood
- Bengali music
- Indian indie
- Trending

It uses a mix of backend API calls and direct Supabase queries.

#### Search

File: `mobile/src/screens/search/SearchScreen.tsx`

Searches:

- Published tracks by title.
- Artists by name.

It currently queries Supabase directly.

#### Browse Results

File: `mobile/src/screens/browse/BrowseResultsScreen.tsx`

Displays full lists for:

- Genres
- Trending
- Indie
- Bengali
- Bollywood
- Albums
- Artists
- New releases/default tracks

It supports responsive web grid layouts and mobile list/grid layouts.

#### Library

File: `mobile/src/screens/library/LibraryScreen.tsx`

Shows:

- User playlists
- Albums for the user's artist profile
- Artists with published tracks

Allows creating playlists. Long press deletes playlists except "Liked Songs".

#### Player

Directory: `mobile/src/screens/player/`

- `PlayerScreen.tsx`
- `QueueScreen.tsx`

The player overlay is controlled from navigation, not a separate modal route.

#### Profile

File: `mobile/src/screens/profile/ProfileScreen.tsx`

Shows:

- Profile name/contact
- Role badge
- Subscription tier
- Creator/admin entry points
- Theme toggle
- Logout

Admin and creator menu items depend on role helpers in `mobile/src/utils/roles.ts`.

#### Creator Screens

Directory: `mobile/src/screens/creator/`

- `BecomeArtistScreen.tsx`
- `CreatorDashboardScreen.tsx`
- `UploadTrackScreen.tsx`
- `UploadAlbumScreen.tsx`
- `UploadArtistPlaylistScreen.tsx`

Creator users can create artist profiles and upload/manage music.

#### Admin Screens

Directory: `mobile/src/screens/admin/`

- `AdminDashboardScreen.tsx`
- `AdminUsersScreen.tsx`
- `AdminUserDetailScreen.tsx`
- `AdminEditUserProfileScreen.tsx`
- `AdminContentScreen.tsx`
- `AdminModerationScreen.tsx`
- `adminStyles.ts`

Admin users can manage platform users, content, roles, account statuses, and reports.

## 5. Backend Structure

Main directory:

```text
backend/
  package.json
  src/
    index.js
    controllers/
    middleware/
    routes/
    scripts/
    utils/
  supabase/
    migrations/
    seeds/
```

### Backend Entry Point

`backend/src/index.js`:

- Loads environment variables with `dotenv`.
- Creates Express app.
- Adds Helmet, CORS, rate limiting, JSON parsing, URL encoded parsing, Morgan logging.
- Registers API routes.
- Adds health check at `/health`.
- Adds 404 handler.
- Adds global error handler.
- Starts server on `process.env.PORT || 3000`.

Registered route groups:

```text
/api/auth
/api/tracks
/api/artists
/api/albums
/api/playlists
/api/users
/api/upload
/api/stream
```

### Supabase Backend Clients

`backend/src/utils/supabase.js` exports:

- `supabase`: anon-key client, respects RLS.
- `supabaseAdmin`: service-role client, bypasses RLS.

Backend code often uses `supabaseAdmin` for server-side operations.

Never expose the service role key to mobile/frontend code.

### Auth Middleware

`backend/src/middleware/auth.js` provides:

- `requireAuth`
- `optionalAuth`
- `requireRole`
- `requireMinRole`

`requireAuth`:

- Reads `Authorization: Bearer <token>`.
- Creates a Supabase client scoped to the user's JWT.
- Verifies the token using Supabase Auth.
- Loads the user's profile from `users`.
- Rejects inactive accounts.
- Loads optional `admin_roles`.
- Adds request fields like:
  - `req.user`
  - `req.userId`
  - `req.profile`
  - `req.adminRole`
  - `req.userRole`
  - `req.isAdmin`
  - `req.supabase`

Role priority:

```text
listener < creator < admin
```

## 6. Backend Routes

### Auth Routes

File: `backend/src/routes/auth.js`

Routes:

- `GET /api/auth/me`
- `PATCH /api/auth/me`
- `POST /api/auth/become-artist`

Supabase Auth handles actual sign up/login on the client. These backend routes handle app profile operations.

### Track Routes

File: `backend/src/routes/tracks.js`

Public or optional-auth routes:

- `GET /api/tracks`
- `GET /api/tracks/trending`
- `GET /api/tracks/new-releases`
- `GET /api/tracks/indie-indian`
- `GET /api/tracks/bengali`
- `GET /api/tracks/by-genre/:slug`
- `GET /api/tracks/:id`
- `GET /api/tracks/:id/similar`

Protected routes:

- `POST /api/tracks/:id/play`
- `POST /api/tracks/:id/like`
- `DELETE /api/tracks/:id/like`
- `PATCH /api/tracks/:id/status`
- `DELETE /api/tracks/:id`

Controller file:

- `backend/src/controllers/tracksController.js`

Track queries use explicit Supabase foreign key hints because multiple relationships exist between tracks and artists.

### Stream Route

File: `backend/src/routes/stream.js`

Route:

- `GET /api/stream/:trackId?quality=medium`

Requires auth. It:

- Checks user subscription tier.
- Limits free users to medium quality.
- Reads `track_files`.
- Returns the audio `file_url`.

### Upload Routes

File: `backend/src/routes/upload.js`

Controller:

- `backend/src/controllers/uploadController.js`

Routes:

- `POST /api/upload/preflight-album`
- `POST /api/upload/track`
- `GET /api/upload/status/:trackId`
- `POST /api/upload/artwork`

Current upload behavior:

- Uses Multer memory storage.
- Uploads audio/artwork to Supabase Storage bucket `audio`.
- Creates a `tracks` row.
- Creates a `track_files` row.
- Auto-publishes uploaded tracks immediately.
- Links track artists in `track_artists`.
- Links genres in `track_genres` when provided.
- Prevents duplicate track uploads based on normalized title, album, and artist signature.

Production note: comments mention future processing/transcoding workers, but current code streams the uploaded file directly.

### Artist Routes

File: `backend/src/routes/artists.js`

Routes include:

- `POST /api/artists`
- `GET /api/artists/:id`
- `PATCH /api/artists/:id`
- `DELETE /api/artists/:id`
- `POST /api/artists/:id/follow`
- `DELETE /api/artists/:id/follow`

Only creators/admins can create/edit/delete artist profiles. Non-admin users can only edit their own artist profiles.

### Album Routes

File: `backend/src/routes/albums.js`

Routes:

- `GET /api/albums/:id`
- `PATCH /api/albums/:id`
- `DELETE /api/albums/:id`

Only creators/admins can edit/delete. Non-admin users can only manage albums for their own artist.

### Playlist Routes

File: `backend/src/routes/playlists.js`

Routes:

- `GET /api/playlists/:id`
- `POST /api/playlists`
- `POST /api/playlists/:id/tracks`
- `DELETE /api/playlists/:id/tracks/:trackId`

Private playlists can only be read by their owner.

### User and Admin Routes

File: `backend/src/routes/users.js`

User routes:

- `GET /api/users/library`
- `POST /api/users/library`
- `DELETE /api/users/library/:itemType/:itemId`
- `GET /api/users/history`
- `GET /api/users/queue`
- `PUT /api/users/queue`
- `POST /api/users/reports`

Admin routes:

- `GET /api/users/admin/stats`
- `GET /api/users/admin/content`
- `GET /api/users/admin/users`
- `PATCH /api/users/admin/users/:id`
- `GET /api/users/admin/reports`
- `PATCH /api/users/admin/reports/:id`

Admin updates can change:

- app role
- admin role
- account status
- display/profile fields
- subscription tier

Admin actions are logged to `admin_audit_logs` when possible.

## 7. Database Schema

Main migration:

- `backend/supabase/migrations/001_initial_schema.sql`

Additional migrations add:

- RLS policies
- multiple artists per user/track
- track cover art URL
- phone auth profile fields
- roles and account status
- role-based RLS policies
- admin roles and reports
- admin audit logs

Important tables:

### Identity and Access

- `users`: app profile connected to `auth.users`.
- `admin_roles`: admin privilege layer.
- `reports`: user reports for content moderation.
- `admin_audit_logs`: audit trail for admin actions.

### Music Catalog

- `artists`
- `albums`
- `tracks`
- `track_files`
- `genres`
- `track_genres`
- `track_artists`

### User Library and Social

- `playlists`
- `playlist_tracks`
- `user_library`
- `user_follows`
- `track_likes`
- `listening_history`
- `user_queue`
- `notifications`

### Monetization/Future Features

- `subscriptions`
- `royalty_events`

### Important Database Functions and Triggers

The initial schema creates:

- `handle_updated_at`: keeps `updated_at` current.
- `handle_new_user`: creates `public.users` rows after Supabase Auth signup.
- `handle_play_count`: increments play count when `played_ms >= 30000`.
- `handle_like_count`: syncs `tracks.like_count`.
- `handle_artist_follower_count`: syncs `artists.follower_count`.

Later migrations add admin helper functions:

- `is_admin_user`
- `is_super_admin_user`

## 8. Main Data Flows

### Login Flow

1. User signs in through Supabase Auth from the mobile app.
2. Supabase returns a session.
3. Navigation restores the session.
4. App loads the matching row from `users`.
5. App normalizes role/admin fields.
6. If profile is incomplete, user goes to profile completion.
7. If account is inactive, user is signed out.
8. Otherwise the main app loads.

### Track Playback Flow

1. User taps a track in Home, Search, Browse, Album, Artist, or Playlist.
2. The app dispatches the selected track into Redux.
3. The app calls `api.getStreamUrl(track.id)`.
4. Backend verifies auth and subscription tier.
5. Backend returns `track_files.file_url`.
6. `audioPlayer.play(url)` starts playback.
7. Playback updates Redux position, duration, loading, and playing state.
8. App records the play using `POST /api/tracks/:id/play`.
9. On completion, app marks the play complete and tries to play the next queue item.

### Upload Track Flow

1. Creator selects/creates artist profile.
2. Creator uploads audio and optional artwork.
3. Mobile sends multipart request to `/api/upload/track`.
4. Backend verifies creator/admin role.
5. Backend verifies the artist belongs to the user unless admin.
6. Backend resolves artist credits.
7. Backend resolves or creates album when needed.
8. Backend checks for duplicate track.
9. Backend uploads file to Supabase Storage bucket `audio`.
10. Backend creates `tracks` row with status `processing`.
11. Backend creates `track_files` row using the uploaded file URL.
12. Backend auto-publishes the track.
13. Backend links artists and genres.

### Admin User Management Flow

1. Admin opens admin screens from Profile.
2. Mobile calls `/api/users/admin/...`.
3. Backend requires auth and admin role.
4. Admin can list users, update roles/status/profile fields, view stats, view content, and resolve reports.
5. Admin update actions are written to audit logs where possible.

## 9. Environment Variables

### Backend

Required:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

Common:

```text
PORT
NODE_ENV
FRONTEND_URL
MAX_UPLOAD_SIZE_MB
```

Legacy/outdated from older setup docs:

```text
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
```

These R2 variables are not used by the current upload controller.

### Mobile

Required:

```text
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
EXPO_PUBLIC_API_URL
```

## 10. Running the Project

### Backend

```bash
cd backend
npm install
npm run dev
```

Health check:

```bash
curl http://localhost:3000/health
```

Expected response shape:

```json
{
  "status": "ok",
  "version": "1.0.0",
  "timestamp": "..."
}
```

### Mobile

```bash
cd mobile
npm install
npm start
```

Then open with Expo for Android, iOS, or web.

Useful scripts:

```bash
npm start
npm run android
npm run ios
npm run web
```

## 11. Coding Guidelines for Future Agents

Before making changes:

1. Read this file.
2. Read the specific route/screen/service you are touching.
3. Check whether the behavior is backend-driven, Supabase-direct, or Redux-only.
4. Be careful with role checks. Admin/creator/listener behavior is central.
5. Do not expose `SUPABASE_SERVICE_ROLE_KEY` in mobile code.
6. Respect the current Expo SDK version.
7. Prefer existing utilities in `mobile/src/utils`.
8. Prefer existing services in `mobile/src/services`.
9. Keep Supabase foreign key hints when querying tables with multiple relationships.
10. If changing upload/storage, update both code and setup documentation.

## 12. Known Caveats and Drift

- `SETUP.md` still describes Cloudflare R2, but current code uploads to Supabase Storage bucket `audio`.
- Some source comments and UI text contain mojibake characters, likely from emoji or special characters saved with the wrong encoding.
- `shared/` is currently empty.
- The upload pipeline mentions future processing/transcoding, but current implementation auto-publishes and streams the uploaded file directly.
- Some mobile screens query Supabase directly while others use the Express API. When debugging data behavior, check both paths.
- `HomeScreen.tsx` contains a large commented older version above the active implementation.

## 13. Quick Mental Model

Soundwave has three main user types:

- Listener: listens, searches, likes, manages library/playlists.
- Creator: listener plus artist profiles and uploads.
- Admin: platform management, moderation, roles, reports, and content status.

The backend is the authority for protected operations such as streaming URLs, uploads, role/admin operations, play recording, and moderation.

The mobile app owns the user experience, navigation, audio playback, and local player state.

Supabase owns identity, database persistence, RLS, and storage.

