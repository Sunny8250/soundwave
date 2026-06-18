// ============================================================
// SOUNDWAVE — Upload Controller (Supabase Storage version)
// src/controllers/uploadController.js
//
// Uses Supabase Storage instead of Cloudflare R2.
// No card or extra signup needed — works with your existing
// Supabase free tier (1GB storage included).
// ============================================================

const { v4: uuidv4 } = require("uuid");
const { supabaseAdmin } = require("../utils/supabase");

// Storage bucket name — you will create this in Supabase dashboard
const BUCKET = "audio";

const slugify = (value) =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const parseArtistNames = (artistNames) => {
  if (!artistNames || !String(artistNames).trim()) return [];

  return String(artistNames)
    .split(/,|&|feat\.|ft\.|featuring| x | × /gi)
    .map((name) => name.trim())
    .filter(Boolean)
    .filter((name, index, list) => {
      const lower = name.toLowerCase();
      return list.findIndex((item) => item.toLowerCase() === lower) === index;
    });
};

const normalizeDuplicateText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const getArtistSignature = (artistIds) =>
  [...new Set((artistIds || []).filter(Boolean))].sort().join("|");

const findArtistByName = async (artistName) => {
  const cleanName = String(artistName || "").trim();
  if (!cleanName) return null;

  const { data: existingArtists, error: existingErr } = await supabaseAdmin
    .from("artists")
    .select("id, name, slug")
    .ilike("name", cleanName)
    .limit(1);

  if (existingErr) throw existingErr;
  return existingArtists?.[0] || null;
};

const getOrCreateArtistByName = async (artistName, userId) => {
  const cleanName = String(artistName || "").trim();
  if (!cleanName) return null;

  const existingArtist = await findArtistByName(cleanName);
  if (existingArtist) return existingArtist;

  const baseSlug = slugify(cleanName) || "artist";
  const { data: newArtist, error } = await supabaseAdmin
    .from("artists")
    .insert({
      user_id: userId,
      name: cleanName,
      slug: `${baseSlug}-${uuidv4().slice(0, 6)}`,
      is_verified: false,
    })
    .select("id, name, slug")
    .single();

  if (error) throw error;
  return newArtist;
};

const getAlbumTrackCount = async (albumId) => {
  const { count, error } = await supabaseAdmin
    .from("tracks")
    .select("id", { count: "exact", head: true })
    .eq("album_id", albumId);

  if (error) throw error;
  return count || 0;
};

const syncAlbumTrackCount = async (
  albumId,
  artworkUrl,
  shouldUpdateCover = false,
) => {
  if (!albumId) return;

  try {
    const totalTracks = await getAlbumTrackCount(albumId);
    const updates = { total_tracks: totalTracks };

    if (shouldUpdateCover && artworkUrl) {
      updates.cover_art_url = artworkUrl;
    }

    const { error } = await supabaseAdmin
      .from("albums")
      .update(updates)
      .eq("id", albumId);

    if (error) throw error;
  } catch (err) {
    console.error("Album track count sync error:", err);
  }
};

const findDuplicateTrack = async ({ title, albumId, artistProfiles }) => {
  const cleanTitle = String(title || "").trim();
  const targetTitle = normalizeDuplicateText(cleanTitle);
  const targetArtists = getArtistSignature(
    artistProfiles.map((item) => item.id),
  );

  if (!targetTitle || !targetArtists) return null;

  let query = supabaseAdmin
    .from("tracks")
    .select(
      `
      id, title, album_id, artist_id, status,
      track_artists ( artist_id )
    `,
    )
    .in("status", ["processing", "published"])
    .ilike("title", cleanTitle)
    .limit(25);

  query = albumId ? query.eq("album_id", albumId) : query.is("album_id", null);

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).find((track) => {
    if (normalizeDuplicateText(track.title) !== targetTitle) return false;

    const linkedArtistIds = (track.track_artists || [])
      .map((credit) => credit.artist_id)
      .filter(Boolean);
    const existingArtists = linkedArtistIds.length
      ? linkedArtistIds
      : [track.artist_id];

    return getArtistSignature(existingArtists) === targetArtists;
  });
};

// ── POST /api/upload/track ────────────────────────────────────
const resolveOwnedArtist = async (userId, artistId, isAdmin = false) => {
  let artistQuery = supabaseAdmin
    .from("artists")
    .select("id, name, slug, user_id");

  if (!isAdmin || !artistId) {
    artistQuery = artistQuery.eq("user_id", userId);
  }

  if (artistId) {
    artistQuery = artistQuery.eq("id", artistId);
  }

  const { data: artists, error } = await artistQuery;
  return { artist: artists?.[0] || null, error };
};

const findExistingAlbumForUpload = async (albumId, albumName) => {
  if (albumId) {
    const { data: album, error } = await supabaseAdmin
      .from("albums")
      .select("id, title, cover_art_url")
      .eq("id", albumId)
      .single();

    if (error) throw error;
    return album;
  }

  const cleanAlbumName = String(albumName || "").trim();
  if (!cleanAlbumName) return null;

  const { data: albums, error } = await supabaseAdmin
    .from("albums")
    .select("id, title, cover_art_url")
    .ilike("title", cleanAlbumName)
    .limit(1);

  if (error) throw error;
  return albums?.[0] || null;
};

const preflightAlbumUpload = async (req, res) => {
  try {
    const { album_id, album_name, artist_id, tracks = [] } = req.body || {};

    if (!Array.isArray(tracks) || tracks.length === 0) {
      return res.status(400).json({ error: "No tracks provided" });
    }

    const { artist, error: artistErr } = await resolveOwnedArtist(
      req.userId,
      artist_id,
      req.isAdmin,
    );

    if (artistErr || !artist) {
      return res.status(403).json({
        error: "You can only upload tracks for an artist you own",
      });
    }

    const existingAlbum = await findExistingAlbumForUpload(
      album_id,
      album_name,
    );
    const cleanAlbumName = String(album_name || "").trim();
    const shouldCheckByAlbum =
      !!existingAlbum?.id || (!album_id && !cleanAlbumName);
    const duplicates = [];
    const ok = [];

    for (const item of tracks) {
      const title = String(item?.title || "").trim();
      const clientId = item?.client_id || item?.id || null;

      if (!title) {
        duplicates.push({
          client_id: clientId,
          title: title || "Untitled track",
          error: "Track title is required",
        });
        continue;
      }

      if (!shouldCheckByAlbum) {
        ok.push({ client_id: clientId, title });
        continue;
      }

      const parsedArtistNames = parseArtistNames(item?.artist_names);
      const artistProfiles =
        parsedArtistNames.length > 0
          ? (
              await Promise.all(
                parsedArtistNames.map((name) => findArtistByName(name)),
              )
            ).filter(Boolean)
          : [artist];

      if (parsedArtistNames.length > 0 && artistProfiles.length === 0) {
        ok.push({ client_id: clientId, title });
        continue;
      }

      const duplicateTrack = await findDuplicateTrack({
        title,
        albumId: existingAlbum?.id || null,
        artistProfiles,
      });

      if (duplicateTrack) {
        duplicates.push({
          client_id: clientId,
          title,
          duplicate_track_id: duplicateTrack.id,
          error:
            "This song already exists with the same title, artists, and album.",
        });
      } else {
        ok.push({ client_id: clientId, title });
      }
    }

    res.json({
      success: true,
      data: {
        album_id: existingAlbum?.id || null,
        duplicates,
        ok,
      },
    });
  } catch (err) {
    console.error("preflightAlbumUpload error:", err);
    res.status(500).json({ error: err.message });
  }
};

const uploadTrack = async (req, res) => {
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: "No audio file provided" });
  }

  const {
    title,
    album_id,
    album_name,
    artist_id,
    track_number,
    explicit,
    genre_ids,
    artwork_url,
    artist_names,
  } = req.body;

  if (!title || title.trim().length === 0) {
    return res.status(400).json({ error: "Track title is required" });
  }

  try {
    // 1. Verify the requesting user owns the target artist
    let artistQuery = supabaseAdmin
      .from("artists")
      .select("id, name, slug, user_id");

    if (!req.isAdmin || !artist_id) {
      artistQuery = artistQuery.eq("user_id", req.userId);
    }

    if (artist_id) {
      artistQuery = artistQuery.eq("id", artist_id);
    }

    const { data: artists, error: artistErr } = await artistQuery;
    const artist = artists?.[0];

    if (artistErr || !artist) {
      return res.status(403).json({
        error: "You can only upload tracks for an artist you own",
      });
    }

    // 2. Resolve track artists. If names are omitted, fall back to the
    // selected owned artist so existing upload flows keep working.
    const parsedArtistNames = parseArtistNames(artist_names);
    const artistProfiles =
      parsedArtistNames.length > 0
        ? (
            await Promise.all(
              parsedArtistNames.map((name) =>
                getOrCreateArtistByName(name, req.userId),
              ),
            )
          ).filter(Boolean)
        : [artist];

    // 3. Resolve album by selected album ID or typed album/film name.
    let finalAlbumId = album_id || null;
    let shouldUpdateAlbumCover = false;

    if (!finalAlbumId && album_name?.trim()) {
      const cleanAlbumName = album_name.trim();

      // FIXED: scope album lookup to this artist to prevent cross-artist collision
      const { data: existingAlbums, error: existingAlbumErr } =
        await supabaseAdmin
          .from("albums")
          .select("id, title, cover_art_url")
          .ilike("title", cleanAlbumName)
          .eq("artist_id", artist.id)
          .limit(1);

      if (existingAlbumErr) throw existingAlbumErr;

      const existingAlbum = existingAlbums?.[0];

      if (existingAlbum) {
        finalAlbumId = existingAlbum.id;
        shouldUpdateAlbumCover = !!artwork_url && !existingAlbum.cover_art_url;
      } else {
        const albumSlug = `${slugify(cleanAlbumName) || "album"}-${uuidv4().slice(0, 6)}`;

        const { data: newAlbum, error: albumErr } = await supabaseAdmin
          .from("albums")
          .insert({
            artist_id: artist.id,
            title: cleanAlbumName,
            slug: albumSlug,
            type: "album",
            cover_art_url: artwork_url || null,
            is_published: true,
            release_date: new Date().toISOString().split("T")[0],
            total_tracks: 0,
          })
          .select("id")
          .single();

        if (albumErr) throw albumErr;
        finalAlbumId = newAlbum?.id || null;
      }
    }

    const duplicateTrack = await findDuplicateTrack({
      title,
      albumId: finalAlbumId,
      artistProfiles,
    });

    if (duplicateTrack) {
      return res.status(409).json({
        error:
          "This song already exists with the same title, artists, and album. Duplicate uploads are not allowed.",
        duplicate_track_id: duplicateTrack.id,
      });
    }

    // 4. Generate a unique file path
    const trackId = uuidv4();
    const fileExt = file.originalname.split(".").pop().toLowerCase();
    const rawFilePath = `raw/${artist.id}/${trackId}.${fileExt}`;

    // 5. Upload to Supabase Storage
    const { error: uploadErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(rawFilePath, file.buffer, {
        contentType: file.mimetype,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadErr) {
      console.error("Storage upload error:", uploadErr);
      return res
        .status(500)
        .json({ error: `Storage upload failed: ${uploadErr.message}` });
    }

    // 6. Get the public URL for this file
    const { data: urlData } = supabaseAdmin.storage
      .from(BUCKET)
      .getPublicUrl(rawFilePath);

    const publicUrl = urlData?.publicUrl;

    let resolvedTrackNumber = track_number ? parseInt(track_number) : null;

    if (finalAlbumId && !resolvedTrackNumber) {
      resolvedTrackNumber = (await getAlbumTrackCount(finalAlbumId)) + 1;
    }

    // Album songs inherit artwork from albums.cover_art_url. Standalone tracks
    // can still keep their own cover art.
    const trackCoverArtUrl = finalAlbumId ? null : artwork_url || null;

    // 7. Create the track record in DB with status='processing'
    const { data: track, error: insertErr } = await supabaseAdmin
      .from("tracks")
      .insert({
        id: trackId,
        artist_id: artist.id,
        album_id: finalAlbumId,
        title: title.trim(),
        track_number: resolvedTrackNumber,
        cover_art_url: trackCoverArtUrl,
        explicit: explicit === "true" || explicit === true,
        status: "processing",
        raw_file_path: rawFilePath,
        license_type: "owned",
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    await syncAlbumTrackCount(
      finalAlbumId,
      artwork_url,
      shouldUpdateAlbumCover,
    );

    // 8. Also create a track_files entry with the raw file URL
    // so it can be streamed immediately (before transcoding is set up)
    // 7. Create track_files entry and auto-publish
    // Since we don't have a transcoding worker yet, we publish directly
    // using the uploaded file as the streaming source
    await supabaseAdmin.from("track_files").insert({
      track_id: trackId,
      quality: "medium",
      format: fileExt === "mp3" ? "mp3" : "aac",
      file_url: publicUrl,
      bitrate_kbps: 128,
    });

    // Auto-publish the track immediately
    // In production this would wait for transcoding to complete
    const { error: publishErr } = await supabaseAdmin
      .from("tracks")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
      })
      .eq("id", trackId);

    if (publishErr) {
      console.error("Auto-publish error:", publishErr);
    }

    // 9. Link every artist to the track.
    if (artistProfiles.length > 0) {
      const trackArtistRows = artistProfiles.map((trackArtist, index) => ({
        track_id: trackId,
        artist_id: trackArtist.id,
        role: index === 0 ? "primary" : "featured",
      }));

      const { error: trackArtistsErr } = await supabaseAdmin
        .from("track_artists")
        .upsert(trackArtistRows, {
          onConflict: "track_id,artist_id,role",
          ignoreDuplicates: true,
        });

      if (trackArtistsErr) throw trackArtistsErr;
    }

    // 10. If genre IDs provided, insert track_genres
    if (genre_ids) {
      const parsed =
        typeof genre_ids === "string" ? JSON.parse(genre_ids) : genre_ids;
      if (Array.isArray(parsed) && parsed.length > 0) {
        const genreRows = parsed.map((genre_id) => ({
          track_id: trackId,
          genre_id,
        }));
        await supabaseAdmin.from("track_genres").insert(genreRows);
      }
    }

    res.status(201).json({
      success: true,
      data: {
        track_id: track.id,
        title: track.title,
        album_id: finalAlbumId,
        status: publishErr ? track.status : "published",
        artists: artistProfiles.map((item) => ({
          id: item.id,
          name: item.name,
        })),
        file_url: publicUrl,
        message: "Upload successful. Your track is being processed.",
      },
    });
  } catch (err) {
    console.error("uploadTrack error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ── GET /api/upload/status/:trackId ──────────────────────────
const getUploadStatus = async (req, res) => {
  try {
    const { trackId } = req.params;

    const { data: artist } = await supabaseAdmin
      .from("artists")
      .select("id")
      .eq("user_id", req.userId)
      .single();

    if (!artist) {
      return res.status(403).json({ error: "Not an artist account" });
    }

    const { data: track, error } = await supabaseAdmin
      .from("tracks")
      .select("id, title, status, processing_error, duration_ms, waveform_data")
      .eq("id", trackId)
      .eq("artist_id", artist.id)
      .single();

    if (error || !track) {
      return res.status(404).json({ error: "Track not found" });
    }

    res.json({ data: track });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── POST /api/upload/artwork ──────────────────────────
const uploadArtwork = async (req, res) => {
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: "No artwork file provided" });
  }

  // Validate file is an image
  const allowedMimes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedMimes.includes(file.mimetype)) {
    return res
      .status(400)
      .json({ error: "Only JPEG, PNG, or WebP images allowed" });
  }

  try {
    // Verify the requesting user owns the target artist
    let artistQuery = supabaseAdmin.from("artists").select("id, user_id");

    if (!req.isAdmin || !req.body.artist_id) {
      artistQuery = artistQuery.eq("user_id", req.userId);
    }

    if (req.body.artist_id) {
      artistQuery = artistQuery.eq("id", req.body.artist_id);
    }

    const { data: artists, error: artistErr } = await artistQuery;
    const artist = artists?.[0];

    if (artistErr || !artist) {
      return res.status(403).json({
        error: "You must have an artist profile to upload artwork",
      });
    }

    // Generate unique path
    const fileExt = file.originalname.split(".").pop().toLowerCase();
    const artworkPath = `artwork/${artist.id}/${Date.now()}.${fileExt}`;

    // Upload to Supabase Storage using admin client (bypasses RLS)
    const { error: uploadErr } = await supabaseAdmin.storage
      .from("audio")
      .upload(artworkPath, file.buffer, {
        contentType: file.mimetype,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadErr) {
      console.error("Artwork storage error:", uploadErr);
      return res
        .status(500)
        .json({ error: `Artwork upload failed: ${uploadErr.message}` });
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from("audio")
      .getPublicUrl(artworkPath);

    const artworkUrl = urlData?.publicUrl;

    res.json({
      success: true,
      artworkUrl,
    });
  } catch (err) {
    console.error("uploadArtwork error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ── POST /api/upload/bulk ─────────────────────────────────────
// Accepts multipart form with multiple audio files + JSON metadata array
// Each track is processed sequentially. Returns per-track success/error.
const uploadBulk = async (req, res) => {
  const files = req.files; // array from multer .array('files')

  if (!files || files.length === 0) {
    return res.status(400).json({ error: "No audio files provided" });
  }

  // Metadata is sent as JSON string: tracks=[{title,artist_names,album_name,...}]
  let tracksMetadata = [];
  try {
    tracksMetadata = JSON.parse(req.body.tracks || "[]");
  } catch {
    return res.status(400).json({ error: "Invalid tracks metadata JSON" });
  }

  if (tracksMetadata.length !== files.length) {
    return res.status(400).json({
      error: `Metadata count (${tracksMetadata.length}) does not match file count (${files.length})`,
    });
  }

  // Verify the requesting user owns an artist profile
  const { data: artists, error: artistErr } = await supabaseAdmin
    .from("artists")
    .select("id, name, slug, user_id")
    .eq("user_id", req.userId);

  if (artistErr || !artists?.length) {
    return res.status(403).json({
      error: "You must have an artist profile to upload tracks",
    });
  }

  const primaryArtist = artists[0];
  const results = [];

  // Process each track sequentially to avoid overwhelming storage
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const meta = tracksMetadata[i];

    try {
      const {
        title,
        artist_names,
        album_name,
        track_number,
        explicit,
        genre_ids,
        artwork_url,
      } = meta;

      if (!title?.trim()) {
        results.push({
          index: i,
          success: false,
          title: title || `Track ${i + 1}`,
          error: "Title is required",
        });
        continue;
      }

      // Resolve artists
      const parsedArtistNames = parseArtistNames(artist_names || "");
      const artistProfiles =
        parsedArtistNames.length > 0
          ? (
              await Promise.all(
                parsedArtistNames.map((name) =>
                  getOrCreateArtistByName(name, req.userId),
                ),
              )
            ).filter(Boolean)
          : [primaryArtist];

      // Resolve album — scoped to primary artist to prevent cross-artist collision
      let finalAlbumId = null;
      if (album_name?.trim()) {
        const cleanAlbumName = album_name.trim();

        const { data: existingAlbums } = await supabaseAdmin
          .from("albums")
          .select("id, cover_art_url")
          .ilike("title", cleanAlbumName)
          .eq("artist_id", primaryArtist.id)
          .limit(1);

        if (existingAlbums?.[0]) {
          finalAlbumId = existingAlbums[0].id;
          // Update cover if missing
          if (artwork_url && !existingAlbums[0].cover_art_url) {
            await supabaseAdmin
              .from("albums")
              .update({ cover_art_url: artwork_url })
              .eq("id", finalAlbumId);
          }
        } else {
          const albumSlug = `${slugify(cleanAlbumName) || "album"}-${uuidv4().slice(0, 6)}`;
          const { data: newAlbum } = await supabaseAdmin
            .from("albums")
            .insert({
              artist_id: primaryArtist.id,
              title: cleanAlbumName,
              slug: albumSlug,
              type: "album",
              cover_art_url: artwork_url || null,
              is_published: true,
              release_date: new Date().toISOString().split("T")[0],
              total_tracks: 0,
            })
            .select("id")
            .single();
          finalAlbumId = newAlbum?.id || null;
        }
      }

      // Check duplicate
      const duplicate = await findDuplicateTrack({
        title,
        albumId: finalAlbumId,
        artistProfiles,
      });

      if (duplicate) {
        results.push({
          index: i,
          success: false,
          title,
          error: "Duplicate — this track already exists",
          duplicate_track_id: duplicate.id,
        });
        continue;
      }

      // Upload file
      const trackId = uuidv4();
      const fileExt = file.originalname.split(".").pop().toLowerCase();
      const rawFilePath = `raw/${primaryArtist.id}/${trackId}.${fileExt}`;

      const { error: uploadErr } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(rawFilePath, file.buffer, {
          contentType: file.mimetype,
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadErr) {
        results.push({
          index: i,
          success: false,
          title,
          error: uploadErr.message,
        });
        continue;
      }

      const { data: urlData } = supabaseAdmin.storage
        .from(BUCKET)
        .getPublicUrl(rawFilePath);

      const publicUrl = urlData?.publicUrl;

      // Resolve track number
      let resolvedTrackNumber = track_number ? parseInt(track_number) : null;
      if (finalAlbumId && !resolvedTrackNumber) {
        resolvedTrackNumber = (await getAlbumTrackCount(finalAlbumId)) + 1;
      }

      // Create track record
      const { data: track, error: insertErr } = await supabaseAdmin
        .from("tracks")
        .insert({
          id: trackId,
          artist_id: primaryArtist.id,
          album_id: finalAlbumId,
          title: title.trim(),
          track_number: resolvedTrackNumber,
          cover_art_url: finalAlbumId ? null : artwork_url || null,
          explicit: explicit === true || explicit === "true",
          status: "processing",
          raw_file_path: rawFilePath,
          license_type: "owned",
        })
        .select()
        .single();

      if (insertErr) {
        results.push({
          index: i,
          success: false,
          title,
          error: insertErr.message,
        });
        continue;
      }

      // Create track_files entry
      await supabaseAdmin.from("track_files").insert({
        track_id: trackId,
        quality: "medium",
        format: fileExt === "mp3" ? "mp3" : "aac",
        file_url: publicUrl,
        bitrate_kbps: 128,
      });

      // Link artists
      if (artistProfiles.length > 0) {
        await supabaseAdmin.from("track_artists").upsert(
          artistProfiles.map((a, idx) => ({
            track_id: trackId,
            artist_id: a.id,
            role: idx === 0 ? "primary" : "featured",
          })),
          { onConflict: "track_id,artist_id,role", ignoreDuplicates: true },
        );
      }

      // Genre links
      if (genre_ids) {
        const parsed =
          typeof genre_ids === "string" ? JSON.parse(genre_ids) : genre_ids;
        if (Array.isArray(parsed) && parsed.length > 0) {
          await supabaseAdmin
            .from("track_genres")
            .insert(
              parsed.map((gid) => ({ track_id: trackId, genre_id: gid })),
            );
        }
      }

      // Auto-publish
      await supabaseAdmin
        .from("tracks")
        .update({ status: "published", published_at: new Date().toISOString() })
        .eq("id", trackId);

      // Sync album track count
      await syncAlbumTrackCount(finalAlbumId, artwork_url, false);

      results.push({
        index: i,
        success: true,
        title,
        track_id: trackId,
        artists: artistProfiles.map((a) => ({ id: a.id, name: a.name })),
        album_id: finalAlbumId,
      });
    } catch (err) {
      console.error(`Bulk upload error at index ${i}:`, err);
      results.push({
        index: i,
        success: false,
        title: meta.title || `Track ${i + 1}`,
        error: err.message,
      });
    }
  }

  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  res.status(207).json({
    success: true,
    summary: { total: files.length, succeeded, failed },
    results,
  });
};

module.exports = {
  preflightAlbumUpload,
  uploadTrack,
  uploadBulk,
  getUploadStatus,
  uploadArtwork,
};
