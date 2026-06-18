// ============================================================
// SOUNDWAVE — Jamendo Sync Script
// backend/src/scripts/syncJamendo.js
//
// Pulls free licensed tracks from Jamendo API and inserts
// them into your Supabase database.
//
// Run with: node src/scripts/syncJamendo.js
// ============================================================

require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const JAMENDO_CLIENT_ID = process.env.JAMENDO_CLIENT_ID;
const JAMENDO_API = "https://api.jamendo.com/v3.0";

// ── Genres to sync ───────────────────────────────────────────
// Map Jamendo tags to your genre slugs
const GENRE_MAP = {
  bollywood: "bollywood",
  indian: "bollywood",
  hindi: "bollywood",
  // pop: "pop",
  // rock: "rock",
  // electronic: "electronic",
  // hiphop: "hip-hop",
  // jazz: "jazz",
  // classical: "classical",
  // folk: "folk",
  // ambient: "ambient",
  // reggae: "reggae",
  // metal: "metal",
  // lounge: "lo-fi",
  // indie: "indie",
};

// ── Helper: sleep ─────────────────────────────────────────────
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── Fetch tracks from Jamendo ─────────────────────────────────
async function fetchJamendoTracks(tags, offset = 0, limit = 50) {
  try {
    const params = new URLSearchParams({
      client_id: JAMENDO_CLIENT_ID,
      format: "json",
      limit: limit.toString(),
      offset: offset.toString(),
      tags: tags,
      audioformat: "mp32",
      include: "musicinfo",
      groupby: "artist_id",
    });

    const url = `${JAMENDO_API}/tracks/?${params}`;
    console.log(`  Fetching: ${url}`);

    // Add 10 second timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    const data = await res.json();

    if (data.headers?.status !== "success") {
      console.error("  Jamendo API error:", data.headers);
      return [];
    }

    console.log(`  Got ${data.results?.length || 0} tracks`);
    return data.results || [];
  } catch (err) {
    if (err.name === "AbortError") {
      console.error("  ❌ Request timed out after 10 seconds");
    } else {
      console.error("  ❌ Fetch error:", err.message);
    }
    return [];
  }
}

// ── Get or create a Jamendo system artist ─────────────────────
async function getOrCreateArtist(jamendoArtist) {
  const slug =
    jamendoArtist.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 50) +
    "-" +
    jamendoArtist.id;

  // Check if artist already exists
  const { data: existing } = await supabase
    .from("artists")
    .select("id")
    .eq("slug", slug)
    .single();

  if (existing) return existing.id;

  // Get the system user (first admin user)
  const systemUser = { id: "00000000-0000-0000-0000-000000000001" };
  // const { data: systemUser } = await supabase
  //   .from("users")
  //   .select("id")
  //   .limit(1)
  //   .single();

  // if (!systemUser) {
  //   console.error("No system user found");
  //   return null;
  // }

  // Create new artist
  const { data: newArtist, error } = await supabase
    .from("artists")
    .insert({
      user_id: null,
      name: jamendoArtist.name,
      slug: slug,
      avatar_url: jamendoArtist.image || null,
      is_verified: false,
    })
    .select("id")
    .single();

  if (error) {
    console.log(
      `  Artist insert error: ${error.message} for ${jamendoArtist.name}`,
    );
    const { data: retried } = await supabase
      .from("artists")
      .insert({
        user_id: null,
        name: jamendoArtist.name,
        slug: slug + "-" + Math.floor(Math.random() * 999),
        avatar_url: jamendoArtist.image || null,
        is_verified: false,
      })
      .select("id")
      .single();
    return retried?.id || null;
  }

  return newArtist?.id || null;
}

// ── Get or create album ───────────────────────────────────────
async function getOrCreateAlbum(artistId, jamendoTrack) {
  const albumName = jamendoTrack.album_name || "Singles";
  const slug = (albumName + "-" + jamendoTrack.album_id)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 80);

  const { data: existing } = await supabase
    .from("albums")
    .select("id")
    .eq("slug", slug)
    .single();

  if (existing) return existing.id;

  const { data: newAlbum, error } = await supabase
    .from("albums")
    .insert({
      artist_id: artistId,
      title: albumName,
      slug: slug,
      type: "album",
      cover_art_url: jamendoTrack.album_image || jamendoTrack.image || null,
      release_date: jamendoTrack.releasedate || null,
      is_published: true,
    })
    .select("id")
    .single();

  if (error && error.code !== "23505") {
    console.error("Album insert error:", error.message);
    return null;
  }

  return newAlbum?.id || null;
}

// ── Get genre ID ──────────────────────────────────────────────
async function getGenreId(slug) {
  const { data } = await supabase
    .from("genres")
    .select("id")
    .eq("slug", slug)
    .single();
  return data?.id || null;
}

// ── Insert a single track ─────────────────────────────────────
async function insertTrack(track, artistId, albumId, genreId) {
  // Check if track already exists by ISRC or Jamendo ID
  const jamendoIsrc = `JAMENDO-${track.id}`;

  const { data: existing } = await supabase
    .from("tracks")
    .select("id")
    .eq("isrc", jamendoIsrc)
    .single();

  if (existing) {
    return { skipped: true };
  }

  // Insert track
  console.log(`  Inserting track: ${track.name} by artist ${artistId}`);
  const { data: newTrack, error } = await supabase
    .from("tracks")
    .insert({
      artist_id: artistId,
      album_id: albumId,
      title: track.name,
      duration_ms: (track.duration || 0) * 1000,
      isrc: jamendoIsrc,
      explicit: false,
      license_type: "creative_commons",
      status: "published",
      published_at: track.releasedate || new Date().toISOString(),
      raw_file_path: track.audio,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { skipped: true };
    console.error("Track insert error:", error.message, track.name);
    return { error: true };
  }

  // Insert track_files — Jamendo provides a direct MP3 URL
  await supabase.from("track_files").insert({
    track_id: newTrack.id,
    quality: "medium",
    format: "mp3",
    file_url: track.audio,
    bitrate_kbps: 128,
  });

  // Link genre
  // Link genre
  if (genreId) {
    await supabase
      .from("track_genres")
      .upsert(
        { track_id: newTrack.id, genre_id: genreId },
        { onConflict: "track_id,genre_id", ignoreDuplicates: true },
      );
  }

  return { inserted: true, id: newTrack.id };
}

// ── Main sync function ────────────────────────────────────────
async function syncGenre(jamendoTag, genreSlug, targetCount = 50) {
  console.log(`\n📀 Syncing genre: ${jamendoTag} → ${genreSlug}`);

  const genreId = await getGenreId(genreSlug);
  if (!genreId) {
    console.log(`  ⚠️  Genre not found: ${genreSlug}`);
    return 0;
  }

  let inserted = 0;
  let skipped = 0;
  let offset = 0;
  const limit = 50;

  while (inserted < targetCount) {
    const tracks = await fetchJamendoTracks(jamendoTag, offset, limit);

    if (tracks.length === 0) {
      console.log(`  No more tracks available`);
      break;
    }

    for (const track of tracks) {
      if (!track.audio) continue;

      const artistId = await getOrCreateArtist({
        id: track.artist_id,
        name: track.artist_name,
        image: track.artist_image,
      });

      if (!artistId) continue;

      const albumId = await getOrCreateAlbum(artistId, track);

      const result = await insertTrack(track, artistId, albumId, genreId);

      if (result.inserted) {
        inserted++;
        process.stdout.write(
          `\r  ✅ Inserted: ${inserted} | Skipped: ${skipped}`,
        );
      } else if (result.skipped) {
        skipped++;
      }

      // Small delay to avoid hammering the API
      await sleep(50);
    }

    offset += limit;

    if (inserted >= targetCount) break;
  }

  console.log(`\n  Done: ${inserted} inserted, ${skipped} skipped`);
  return inserted;
}

// ── Run ───────────────────────────────────────────────────────
async function main() {
  console.log("🎵 Soundwave — Jamendo Sync");
  console.log("============================");

  if (!JAMENDO_CLIENT_ID) {
    console.error("❌ JAMENDO_CLIENT_ID not set in .env");
    process.exit(1);
  }

  let total = 0;

  // Sync each genre — 30 tracks per genre
  for (const [jamendoTag, genreSlug] of Object.entries(GENRE_MAP)) {
    const count = await syncGenre(jamendoTag, genreSlug, 50);
    total += count;
    await sleep(500);
  }

  console.log(`\n🎉 Sync complete! Total tracks inserted: ${total}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
