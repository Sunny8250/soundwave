import { supabase } from "./supabase";

export const playlistService = {
  // Get all playlists for the current user
  async getUserPlaylists(userId: string) {
    const { data, error } = await supabase
      .from("playlists")
      .select(
        "id, title, description, cover_art_url, is_public, total_tracks, updated_at",
      )
      .eq("owner_id", userId)
      .order("title", { ascending: true });
    return { data, error };
  },

  // Get a single playlist with all its tracks
  async getPlaylist(playlistId: string) {
    const { data, error } = await supabase
      .from("playlists")
      .select(
        `
        *,
        playlist_tracks (
          id, position, added_at,
          tracks (
            id, title, duration_ms, explicit, play_count, cover_art_url,
            artists!tracks_artist_id_fkey ( id, name, avatar_url ),
            albums!tracks_album_id_fkey   ( cover_art_url ),
            track_artists (
              role,
              artists ( id, name, avatar_url )
            )
          )
        )
      `,
      )
      .eq("id", playlistId)
      .order("position", {
        referencedTable: "playlist_tracks",
        ascending: true,
      })
      .single();
    return { data, error };
  },

  // Create a new playlist
  async createPlaylist(userId: string, title: string, isPublic = true) {
    const { data, error } = await supabase
      .from("playlists")
      .insert({
        owner_id: userId,
        title: title.trim(),
        is_public: isPublic,
      })
      .select()
      .single();
    return { data, error };
  },

  // Add a track to a playlist
  async addTrackToPlaylist(
    playlistId: string,
    trackId: string,
    userId: string,
  ) {
    // Get the next position
    const { data: last } = await supabase
      .from("playlist_tracks")
      .select("position")
      .eq("playlist_id", playlistId)
      .order("position", { ascending: false })
      .limit(1)
      .single();

    const position = (last?.position ?? -1) + 1;

    const { data, error } = await supabase
      .from("playlist_tracks")
      .insert({
        playlist_id: playlistId,
        track_id: trackId,
        added_by: userId,
        position,
      })
      .select()
      .single();

    if (!error) {
      // Update total_tracks count
      await supabase.rpc("increment_playlist_count", {
        playlist_id: playlistId,
      });
    }

    return { data, error };
  },

  // Remove a track from a playlist
  async removeTrackFromPlaylist(playlistId: string, trackId: string) {
    const { error } = await supabase
      .from("playlist_tracks")
      .delete()
      .eq("playlist_id", playlistId)
      .eq("track_id", trackId);

    if (!error) {
      // Decrement count — use RPC if available, otherwise recount
      const { error: rpcErr } = await supabase.rpc("decrement_playlist_count", {
        playlist_id: playlistId,
      });
      if (rpcErr) {
        // Fallback: recount manually
        const { count } = await supabase
          .from("playlist_tracks")
          .select("id", { count: "exact", head: true })
          .eq("playlist_id", playlistId);
        await supabase
          .from("playlists")
          .update({ total_tracks: count || 0 })
          .eq("id", playlistId);
      }
    }

    return { error };
  },

  // Check if a track is in a playlist
  async isTrackInPlaylist(playlistId: string, trackId: string) {
    const { data } = await supabase
      .from("playlist_tracks")
      .select("id")
      .eq("playlist_id", playlistId)
      .eq("track_id", trackId)
      .single();
    return !!data;
  },

  // Get the user's Liked Songs playlist (auto-create if missing)
  async getLikedSongsPlaylist(userId: string) {
    const { data } = await supabase
      .from("playlists")
      .select("id")
      .eq("owner_id", userId)
      .eq("title", "Liked Songs")
      .single();

    if (data) return data;

    // Auto-create if it doesn't exist (for older accounts)
    const { data: created } = await supabase
      .from("playlists")
      .insert({
        owner_id: userId,
        title: "Liked Songs",
        description: "Your liked songs",
        is_public: false,
        total_tracks: 0,
      })
      .select("id")
      .single();

    return created;
  },

  // Like a track — adds to Liked Songs playlist
  async likeTrack(userId: string, trackId: string) {
    const liked = await playlistService.getLikedSongsPlaylist(userId);
    if (!liked)
      return { error: "Could not find or create Liked Songs playlist" };

    // Check if already liked
    const already = await playlistService.isTrackInPlaylist(liked.id, trackId);
    if (already) return { error: null }; // idempotent — not an error

    return playlistService.addTrackToPlaylist(liked.id, trackId, userId);
  },

  // Unlike a track — removes from Liked Songs playlist
  async unlikeTrack(userId: string, trackId: string) {
    const liked = await playlistService.getLikedSongsPlaylist(userId);
    if (!liked) return { error: null }; // nothing to unlike
    return playlistService.removeTrackFromPlaylist(liked.id, trackId);
  },

  // Check if a track is liked
  async isTrackLiked(userId: string, trackId: string) {
    const liked = await playlistService.getLikedSongsPlaylist(userId);
    if (!liked) return false;
    return playlistService.isTrackInPlaylist(liked.id, trackId);
  },

  // Delete a playlist
  async deletePlaylist(playlistId: string) {
    const { error } = await supabase
      .from("playlists")
      .delete()
      .eq("id", playlistId);
    return { error };
  },
};
