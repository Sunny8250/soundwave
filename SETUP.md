# Soundwave — Supabase Setup Guide

Follow these steps exactly to get your database running in ~10 minutes.

---

## Step 1 — Create a Supabase Project

1. Go to https://supabase.com and sign up (free)
2. Click **New Project**
3. Fill in:
   - **Name:** soundwave
   - **Database Password:** generate a strong password and SAVE IT
   - **Region:** Southeast Asia (Singapore) — closest to India
4. Wait ~2 minutes for the project to spin up

---

## Step 2 — Run the Database Migrations

1. In your Supabase dashboard, click **SQL Editor** in the left sidebar
2. Click **New query**
3. Copy the ENTIRE contents of `migrations/001_initial_schema.sql`
4. Paste it into the SQL editor
5. Click **Run** (or Ctrl+Enter)
6. You should see: `Success. No rows returned`
7. Repeat for `migrations/002_rls_policies.sql`
8. Repeat for `seeds/001_genres.sql`

---

## Step 3 — Get Your API Keys

1. In Supabase dashboard, go to **Settings → API**
2. Copy these three values into your `.env` file:
   - **Project URL** → `SUPABASE_URL`
   - **anon / public key** → `SUPABASE_ANON_KEY`
   - **service_role / secret key** → `SUPABASE_SERVICE_ROLE_KEY`

> ⚠️ The service_role key bypasses ALL security. Never expose it in the mobile app
> or any frontend code. Only use it in your backend Node.js server.

---

## Step 4 — Set Up Cloudflare R2 (Audio Storage)

1. Go to https://cloudflare.com and sign up (free)
2. In the dashboard, go to **R2 Object Storage**
3. Click **Create bucket**
   - Name: `soundwave-audio`
   - Location: Automatic
4. Go to **R2 → Manage R2 API Tokens**
5. Click **Create API Token**
   - Permissions: Object Read & Write
   - Bucket: soundwave-audio
6. Copy the credentials into your `.env`:
   - Account ID → `R2_ACCOUNT_ID`
   - Access Key ID → `R2_ACCESS_KEY_ID`
   - Secret Access Key → `R2_SECRET_ACCESS_KEY`

---

## Step 5 — Install and Run the Backend

```bash
cd backend
npm install
cp .env.example .env
# Fill in your .env values from steps 3 and 4

npm run dev
```

You should see:
```
🎵 Soundwave API running on port 3000
   Environment: development
   Health check: http://localhost:3000/health
```

Test it:
```bash
curl http://localhost:3000/health
# → {"status":"ok","version":"1.0.0",...}
```

---

## Step 6 — Verify Your Tables

In Supabase dashboard → **Table Editor**, you should see all these tables:
- users
- artists
- albums
- tracks
- track_files
- genres (with 23 genre rows from the seed)
- track_genres
- track_artists
- playlists
- playlist_tracks
- user_library
- user_follows
- listening_history
- user_queue
- track_likes
- subscriptions
- royalty_events
- notifications

---

## Step 7 — Enable Realtime (for social features later)

1. Supabase Dashboard → **Database → Replication**
2. Enable replication for:
   - `listening_history` (friend activity feed)
   - `notifications` (live push)
   - `user_follows` (social graph updates)

---

## What's Next

With the database and backend running, the next step is:
1. Set up the React Native (Expo) mobile app
2. Connect it to Supabase Auth for login/signup
3. Build the music player screen

Run this to start the mobile project setup:
```bash
cd ../mobile
npx create-expo-app@latest . --template blank-typescript
npm install @supabase/supabase-js expo-secure-store
```
