// ============================================================
// src/routes/artists.js
// FIX: explicit foreign key hints for tracks→artists joins
// ============================================================
const express = require("express");
const router = express.Router();
const {
  requireAuth,
  optionalAuth,
  requireMinRole,
} = require("../middleware/auth");
const { validateBody, validateParams, z } = require("../middleware/validation");
const { supabaseAdmin } = require("../utils/supabase");

const artistCreateSchema = z.object({
  name: z.string().min(1).max(100),
  bio: z.string().max(500).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  avatar_url: z.string().max(250).optional().nullable(),
  header_image_url: z.string().max(250).optional().nullable(),
});

const artistUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  avatar_url: z.string().max(250).optional().nullable(),
  header_image_url: z.string().max(250).optional().nullable(),
});

const artistIdParamSchema = z.object({
  id: z.string().uuid(),
});

const slugify = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

router.post(
  "/",
  requireAuth,
  requireMinRole("creator"),
  validateBody(artistCreateSchema),
  async (req, res) => {
    const { name, bio, country, avatar_url, header_image_url } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: "Artist name is required" });
    }

    const cleanName = String(name).trim();
    const artistIdSuffix = Math.random().toString(36).slice(2, 8);
    const slug = `${slugify(cleanName)}-${artistIdSuffix}`;

    const { data, error } = await supabaseAdmin
      .from("artists")
      .insert({
        user_id: req.userId,
        name: cleanName,
        slug,
        bio: bio || null,
        country: country || null,
        avatar_url: avatar_url || null,
        header_image_url: header_image_url || null,
      })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });

    await supabaseAdmin
      .from("users")
      .update({ is_artist: true, role: req.isAdmin ? "admin" : "creator" })
      .eq("id", req.userId);

    res.status(201).json({ data });
  },
);

// GET /api/artists/:id
router.get(
  "/:id",
  optionalAuth,
  validateParams(artistIdParamSchema),
  async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from("artists")
      .select(
        `
      *,
      albums!albums_artist_id_fkey ( id, title, cover_art_url, type, release_date, is_published )
    `,
      )
      .eq("id", req.params.id)
      .is("deleted_at", null)
      .single();

    if (error || !data)
      return res.status(404).json({ error: "Artist not found" });

    const [{ data: primaryTracks }, { data: linkedRows }] = await Promise.all([
      supabaseAdmin
        .from("tracks")
        .select(
          `
        id, title, duration_ms, play_count, like_count, cover_art_url,
        albums!tracks_album_id_fkey ( cover_art_url )
      `,
        )
        .eq("artist_id", req.params.id)
        .eq("status", "published")
        .order("play_count", { ascending: false })
        .limit(10),
      supabaseAdmin
        .from("track_artists")
        .select(
          `
        role,
        tracks (
          id, title, duration_ms, play_count, like_count, cover_art_url, status,
          albums!tracks_album_id_fkey ( cover_art_url )
        )
      `,
        )
        .eq("artist_id", req.params.id),
    ]);

    const trackMap = new Map();
    (primaryTracks || []).forEach((track) => trackMap.set(track.id, track));
    (linkedRows || []).forEach((row) => {
      if (row.tracks?.status === "published") {
        trackMap.set(row.tracks.id, row.tracks);
      }
    });

    const tracks = Array.from(trackMap.values())
      .sort((a, b) => (b.play_count || 0) - (a.play_count || 0))
      .slice(0, 10);

    res.json({ data: { ...data, top_tracks: tracks } });
  },
);

router.patch(
  "/:id",
  requireAuth,
  requireMinRole("creator"),
  validateParams(artistIdParamSchema),
  validateBody(artistUpdateSchema),
  async (req, res) => {
    const { name, bio, country, avatar_url, header_image_url } = req.body;

    const { data: artist, error: artistErr } = await supabaseAdmin
      .from("artists")
      .select("id, user_id")
      .eq("id", req.params.id)
      .single();

    if (artistErr || !artist)
      return res.status(404).json({ error: "Artist not found" });
    if (!req.isAdmin && artist.user_id !== req.userId)
      return res
        .status(403)
        .json({ error: "You can only edit your own artist" });

    const updates = {};
    if (name !== undefined) {
      const cleanName = String(name).trim();
      if (!cleanName)
        return res.status(400).json({ error: "Artist name is required" });
      updates.name = cleanName;
      updates.slug =
        cleanName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") +
        "-" +
        artist.id.slice(0, 6);
    }
    if (bio !== undefined) updates.bio = bio || null;
    if (country !== undefined) updates.country = country || null;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url || null;
    if (header_image_url !== undefined)
      updates.header_image_url = header_image_url || null;

    const { data, error } = await supabaseAdmin
      .from("artists")
      .update(updates)
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json({ data });
  },
);

router.delete(
  "/:id",
  requireAuth,
  requireMinRole("creator"),
  validateParams(artistIdParamSchema),
  async (req, res) => {
    const { data: artist, error: artistErr } = await supabaseAdmin
      .from("artists")
      .select("id, user_id")
      .eq("id", req.params.id)
      .single();

    if (artistErr || !artist)
      return res.status(404).json({ error: "Artist not found" });
    if (!req.isAdmin && artist.user_id !== req.userId)
      return res
        .status(403)
        .json({ error: "You can only delete your own artist" });

    // Soft-delete the artist and cascade soft-delete their tracks
    const deletedAt = new Date().toISOString();
    const { error: artistUpdateErr } = await supabaseAdmin
      .from("artists")
      .update({ deleted_at: deletedAt })
      .eq("id", req.params.id);

    if (artistUpdateErr)
      return res.status(400).json({ error: artistUpdateErr.message });

    // Soft-delete primary tracks for this artist
    const { error: trackUpdateErr } = await supabaseAdmin
      .from("tracks")
      .update({ status: "deleted", deleted_at: deletedAt })
      .eq("artist_id", req.params.id);

    if (trackUpdateErr)
      console.warn(
        "Failed to cascade soft-delete tracks for artist",
        trackUpdateErr.message,
      );

    const { data: remainingArtists } = await supabaseAdmin
      .from("artists")
      .select("id")
      .eq("user_id", artist.user_id)
      .is("deleted_at", null)
      .limit(1);

    if (!req.isAdmin || artist.user_id !== req.userId) {
      await supabaseAdmin
        .from("users")
        .update({
          is_artist: (remainingArtists || []).length > 0,
          role: (remainingArtists || []).length > 0 ? "creator" : "listener",
        })
        .eq("id", artist.user_id)
        .neq("role", "admin");
    }

    res.json({ success: true, deleted_at: deletedAt });
  },
);

// POST /api/artists/:id/follow
router.post(
  "/:id/follow",
  requireAuth,
  validateParams(artistIdParamSchema),
  async (req, res) => {
    const { error } = await supabaseAdmin.from("user_follows").insert({
      follower_id: req.userId,
      following_id: req.params.id,
      following_type: "artist",
    });
    if (error && error.code === "23505")
      return res.status(409).json({ error: "Already following" });
    if (error) return res.status(400).json({ error: error.message });
    res.json({ success: true });
  },
);

// DELETE /api/artists/:id/follow
router.delete(
  "/:id/follow",
  requireAuth,
  validateParams(artistIdParamSchema),
  async (req, res) => {
    await supabaseAdmin
      .from("user_follows")
      .delete()
      .eq("follower_id", req.userId)
      .eq("following_id", req.params.id)
      .eq("following_type", "artist");
    res.json({ success: true });
  },
);

module.exports = router;
