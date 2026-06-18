// ============================================================
// SOUNDWAVE — Tracks Controller
// src/controllers/tracksController.js
//
// FIX: Added explicit foreign key hints to all Supabase queries
// that join tracks → artists. Supabase requires this when
// multiple relationships exist between two tables.
// Syntax: artists!tracks_artist_id_fkey(...)
// ============================================================

const { supabaseAdmin } = require("../utils/supabase");
const { logAdminAction } = require("../utils/adminAudit");

// ── GET /api/tracks ──────────────────────────────────────────
const listTracks = async (req, res) => {
  try {
    const {
      artist_id,
      search,
      limit = 20,
      offset = 0,
      sort = "published_at",
      order = "desc",
    } = req.query;

    let query = supabaseAdmin
      .from("tracks")
      .select(
        `
        id, title, duration_ms, explicit, play_count, like_count, cover_art_url,
        bpm, mood, energy, published_at,
        artists!tracks_artist_id_fkey ( id, name, slug, avatar_url, is_verified ),
        albums!tracks_album_id_fkey   ( id, title, cover_art_url, release_date, type ),
        track_artists (
          role,
          artists ( id, name, avatar_url )
        )
      `,
      )
      .eq("status", "published")
      .order(sort, { ascending: order === "asc" })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (artist_id) query = query.eq("artist_id", artist_id);
    if (search) query = query.ilike("title", `%${search}%`);

    const { data, error, count } = await query;
    if (error) throw error;

    res.json({ data, count, limit: Number(limit), offset: Number(offset) });
  } catch (err) {
    console.error("listTracks error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ── GET /api/tracks/trending ─────────────────────────────────
const getTrending = async (req, res) => {
  try {
    const sevenDaysAgo = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data, error } = await supabaseAdmin
      .from("listening_history")
      .select(
        `
        track_id,
        tracks (
          id, title, play_count, cover_art_url,
          artists!tracks_artist_id_fkey ( name, avatar_url ),
          albums!tracks_album_id_fkey   ( cover_art_url ),
          track_artists (
            role,
            artists ( id, name, avatar_url )
          )
        )
      `,
      )
      .gte("played_at", sevenDaysAgo)
      .gte("played_ms", 30000)
      .limit(50);

    if (error) throw error;

    const playMap = {};
    data.forEach(({ track_id, tracks }) => {
      if (!playMap[track_id]) playMap[track_id] = { track: tracks, plays: 0 };
      playMap[track_id].plays += 1;
    });

    const trending = Object.values(playMap)
      .sort((a, b) => b.plays - a.plays)
      .slice(0, 20)
      .map(({ track }) => track);

    res.json({ data: trending });
  } catch (err) {
    console.error("getTrending error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ── GET /api/tracks/new-releases ─────────────────────────────
const getNewReleases = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("tracks")
      .select(
        `
        id, title, duration_ms, explicit, published_at, cover_art_url,
        artists!tracks_artist_id_fkey ( id, name, slug, avatar_url ),
        albums!tracks_album_id_fkey   ( id, title, cover_art_url, type ),
        track_artists (
          role,
          artists ( id, name, avatar_url )
        )
      `,
      )
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(20);

    if (error) throw error;
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /api/tracks/:id ───────────────────────────────────────
const getTrack = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from("tracks")
      .select(
        `
        *,
        artists!tracks_artist_id_fkey ( id, name, slug, avatar_url, is_verified, follower_count ),
        albums!tracks_album_id_fkey   ( id, title, slug, cover_art_url, release_date, type ),
        track_files  ( id, quality, format, file_url, bitrate_kbps ),
        track_genres ( genres ( id, name, slug ) ),
        track_artists (
          role,
          artists ( id, name, avatar_url )
        )
      `,
      )
      .eq("id", id)
      .eq("status", "published")
      .single();

    if (error || !data)
      return res.status(404).json({ error: "Track not found" });

    let isLiked = false;
    if (req.userId) {
      const { data: like } = await supabaseAdmin
        .from("track_likes")
        .select("user_id")
        .eq("user_id", req.userId)
        .eq("track_id", id)
        .single();
      isLiked = !!like;
    }

    res.json({ data: { ...data, is_liked: isLiked } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /api/tracks/:id/similar ──────────────────────────────
const getSimilar = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: source, error: sourceErr } = await supabaseAdmin
      .from("tracks")
      .select("mood, energy, bpm, artist_id")
      .eq("id", id)
      .single();

    if (sourceErr || !source)
      return res.status(404).json({ error: "Track not found" });

    const { data, error } = await supabaseAdmin
      .from("tracks")
      .select(
        `
        id, title, duration_ms, play_count, cover_art_url,
        artists!tracks_artist_id_fkey ( id, name, avatar_url ),
        albums!tracks_album_id_fkey   ( cover_art_url ),
        track_artists (
          role,
          artists ( id, name, avatar_url )
        )
      `,
      )
      .eq("status", "published")
      .eq("mood", source.mood)
      .neq("id", id)
      .gte("energy", (source.energy || 0.5) - 0.2)
      .lte("energy", (source.energy || 0.5) + 0.2)
      .limit(10);

    if (error) throw error;
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── POST /api/tracks/:id/play ─────────────────────────────────
const recordPlay = async (req, res) => {
  try {
    const { id } = req.params;
    const { played_ms, completed, source, source_id } = req.body;

    const { error } = await supabaseAdmin.from("listening_history").insert({
      user_id: req.userId,
      track_id: id,
      played_ms: played_ms || 0,
      completed: completed || false,
      source: source || "queue",
      source_id: source_id || null,
    });

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── POST /api/tracks/:id/like ─────────────────────────────────
const likeTrack = async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from("track_likes")
      .insert({ user_id: req.userId, track_id: req.params.id });

    if (error && error.code === "23505") {
      return res.status(409).json({ error: "Already liked" });
    }
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── DELETE /api/tracks/:id/like ───────────────────────────────
const unlikeTrack = async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from("track_likes")
      .delete()
      .eq("user_id", req.userId)
      .eq("track_id", req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /api/tracks/indie-indian ─────────────────────────────
// Best of Indian Independent music from Jamendo
// DELETE /api/tracks/:id
const deleteOwnTrack = async (req, res) => {
  try {
    const trackId = req.params.id;

    const { data: track, error: trackError } = await supabaseAdmin
      .from("tracks")
      .select("id, artist_id, play_count, status")
      .eq("id", trackId)
      .single();

    if (trackError || !track) {
      return res.status(404).json({
        error: "Track not found",
        code: "NOT_FOUND",
      });
    }

    if (!req.isAdmin) {
      const { data: artist, error: artistError } = await supabaseAdmin
        .from("artists")
        .select("id")
        .eq("id", track.artist_id)
        .eq("user_id", req.userId)
        .single();

      if (artistError || !artist) {
        return res.status(403).json({
          error: "You can only delete your own tracks",
          code: "PERMISSION_DENIED",
        });
      }

      // Prevent deletion if track has plays
      if (track.play_count > 0) {
        // Return current server state so clients can show a conflict resolution UI
        return res.status(409).json({
          error: "Cannot delete tracks with plays",
          code: "TRACK_IN_USE",
          serverState: track,
        });
      }
    }

    // Soft-delete: mark deleted_at timestamp and status so we can recover/audit later
    const deletedAt = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("tracks")
      .update({ status: "deleted", deleted_at: deletedAt })
      .eq("id", trackId);

    if (error) throw error;
    console.log("deleteOwnTrack success", {
      trackId,
      userId: req.userId,
      isAdmin: req.isAdmin,
    });
    res.json({ success: true });
  } catch (err) {
    console.error("deleteOwnTrack error:", err);
    res.status(500).json({
      error: err.message,
      code: "INTERNAL_ERROR",
    });
  }
};

const deleteTrack = async (req, res) => {
  try {
    const trackId = req.params.id;

    const { data: track, error: trackError } = await supabaseAdmin
      .from("tracks")
      .select("id, play_count, status")
      .eq("id", trackId)
      .single();

    if (trackError || !track) {
      return res.status(404).json({
        error: "Track not found",
        code: "NOT_FOUND",
      });
    }

    // Admins can delete, but warn if track has plays
    if (track.play_count > 0 && track.status === "published") {
      return res.status(409).json({
        error: "Published track with plays cannot be deleted",
        code: "TRACK_IN_USE",
        serverState: track,
      });
    }

    // Soft-delete the track for audit/restore ability
    const deletedAt = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("tracks")
      .update({ status: "deleted", deleted_at: deletedAt })
      .eq("id", trackId);

    if (error) throw error;

    await logAdminAction({
      actorId: req.userId,
      action: "delete_track",
      oldValues: {
        trackId,
        status: track.status,
        play_count: track.play_count,
      },
      newValues: { trackId, deleted: true },
    });

    console.log("deleteTrack success", {
      trackId,
      userId: req.userId,
      isAdmin: req.isAdmin,
    });
    res.json({ success: true });
  } catch (err) {
    console.error("deleteTrack error:", err);
    res.status(500).json({
      error: err.message,
      code: "INTERNAL_ERROR",
    });
  }
};

const updateTrackStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const validStatuses = new Set([
      "processing",
      "review",
      "published",
      "rejected",
      "takedown",
    ]);

    if (!validStatuses.has(status)) {
      return res.status(400).json({
        error: "Invalid track status",
        code: "INVALID_INPUT",
      });
    }

    const { data: track, error: trackError } = await supabaseAdmin
      .from("tracks")
      .select("id")
      .eq("id", id)
      .single();

    if (trackError || !track) {
      return res.status(404).json({
        error: "Track not found",
        code: "NOT_FOUND",
      });
    }

    const { error } = await supabaseAdmin
      .from("tracks")
      .update({ status })
      .eq("id", id);

    if (error) throw error;

    await logAdminAction({
      actorId: req.userId,
      action: `update_track_status_${status}`,
      oldValues: { trackId: id, previousStatus: track.status },
      newValues: { trackId: id, status },
    });

    res.json({ success: true, status });
  } catch (err) {
    console.error("updateTrackStatus error:", err);
    res.status(500).json({
      error: err.message,
      code: "INTERNAL_ERROR",
    });
  }
};

const getIndieIndian = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("tracks")
      .select(
        `
        id, title, duration_ms, play_count, like_count, published_at, cover_art_url,
        artists!tracks_artist_id_fkey ( id, name, avatar_url ),
        albums!tracks_album_id_fkey   ( id, title, cover_art_url ),
        track_artists (
          role,
          artists ( id, name, avatar_url )
        )
      `,
      )
      .eq("status", "published")
      .eq("license_type", "creative_commons")
      .order("play_count", { ascending: false })
      .limit(20);

    if (error) throw error;
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /api/tracks/bengali ──────────────────────────────────
// Bengali music section
const getBengali = async (req, res) => {
  try {
    // Get genre ID for Bengali
    const { data: genre } = await supabaseAdmin
      .from("genres")
      .select("id")
      .eq("slug", "bengali")
      .single();

    if (!genre) {
      return res.json({ data: [] });
    }

    const { data, error } = await supabaseAdmin
      .from("track_genres")
      .select(
        `
        tracks (
          id, title, duration_ms, play_count, like_count, published_at, cover_art_url,
          artists!tracks_artist_id_fkey ( id, name, avatar_url ),
          albums!tracks_album_id_fkey   ( id, title, cover_art_url ),
          track_artists (
            role,
            artists ( id, name, avatar_url )
          )
        )
      `,
      )
      .eq("genre_id", genre.id)
      .limit(20);

    if (error) throw error;

    const tracks = data.map((d) => d.tracks).filter(Boolean);

    res.json({ data: tracks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /api/tracks/by-genre/:slug ───────────────────────────
const getByGenre = async (req, res) => {
  try {
    const { slug } = req.params;
    const { limit = 20 } = req.query;

    const { data: genre } = await supabaseAdmin
      .from("genres")
      .select("id, name")
      .eq("slug", slug)
      .single();

    if (!genre) {
      return res.status(404).json({ error: "Genre not found" });
    }

    const { data, error } = await supabaseAdmin
      .from("track_genres")
      .select(
        `
        tracks (
          id, title, duration_ms, play_count, like_count, cover_art_url,
          artists!tracks_artist_id_fkey ( id, name, avatar_url ),
          albums!tracks_album_id_fkey   ( id, title, cover_art_url ),
          track_artists (
            role,
            artists ( id, name, avatar_url )
          )
        )
      `,
      )
      .eq("genre_id", genre.id)
      .limit(Number(limit));

    if (error) throw error;

    const tracks = data.map((d) => d.tracks).filter(Boolean);
    res.json({ data: tracks, genre });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PATCH /api/tracks/:id - update track metadata (owner or admin)
const updateTrackMetadata = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      cover_art_url,
      bpm,
      mood,
      energy,
      explicit,
      album_id,
      track_number,
    } = req.body;

    const { data: track, error: trackErr } = await supabaseAdmin
      .from("tracks")
      .select(
        "id, artist_id, status, title, album_id, cover_art_url, bpm, mood, energy, explicit",
      )
      .eq("id", id)
      .single();

    if (trackErr || !track) {
      return res
        .status(404)
        .json({ error: "Track not found", code: "NOT_FOUND" });
    }

    if (!req.isAdmin) {
      const { data: artist } = await supabaseAdmin
        .from("artists")
        .select("id")
        .eq("id", track.artist_id)
        .eq("user_id", req.userId)
        .single();
      if (!artist) {
        return res
          .status(403)
          .json({ error: "Not your track", code: "PERMISSION_DENIED" });
      }
    }

    const updates = {};
    if (title !== undefined) updates.title = title;
    if (cover_art_url !== undefined) updates.cover_art_url = cover_art_url;
    if (bpm !== undefined) updates.bpm = bpm;
    if (mood !== undefined) updates.mood = mood;
    if (energy !== undefined) updates.energy = energy;
    if (explicit !== undefined) updates.explicit = explicit;
    if (album_id !== undefined) updates.album_id = album_id;
    if (track_number !== undefined) updates.track_number = track_number;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No valid updates provided" });
    }

    const { data: updated, error } = await supabaseAdmin
      .from("tracks")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        const { data: serverData } = await supabaseAdmin
          .from("tracks")
          .select(
            `id, title, album_id, artist_id, status, cover_art_url, bpm, mood, energy, explicit, track_number, play_count`,
          )
          .eq("id", id)
          .single();

        return res.status(409).json({
          error: error.message,
          code: "CONFLICT",
          serverState: serverData || null,
        });
      }
      return res.status(400).json({ error: error.message });
    }

    res.json({ data: updated });
  } catch (err) {
    console.error("updateTrackMetadata error:", err);
    res.status(500).json({ error: err.message, code: "INTERNAL_ERROR" });
  }
};

module.exports = {
  listTracks,
  getTrending,
  getNewReleases,
  getIndieIndian,
  getBengali,
  getByGenre,
  getTrack,
  getSimilar,
  recordPlay,
  likeTrack,
  unlikeTrack,
  deleteOwnTrack,
  deleteTrack,
  updateTrackStatus,
  updateTrackMetadata,
};
