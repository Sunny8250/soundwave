import { supabase } from "./supabase";
import { api } from "./api";
import { offlineQueue, AdminActionType } from "../utils/offlineQueue";
import { parseAPIError, APIError, ErrorCode } from "../utils/apiError";
import { useNetworkStatus } from "../hooks/useNetworkStatus";

const isAdmin = async (userId: string) => {
  const { data } = await supabase
    .from("admin_roles")
    .select("role")
    .eq("user_id", userId)
    .single();
  return data?.role || null;
};

export const adminService = {
  // ── Check admin access ──────────────────────────────────────
  async checkAdmin(userId: string) {
    return isAdmin(userId);
  },

  // ── Dashboard stats ─────────────────────────────────────────
  async getStats() {
    const [usersRes, artistsRes, tracksRes, albumsRes, pendingRes, blockedRes] =
      await Promise.all([
        supabase.from("users").select("id", { count: "exact", head: true }),
        supabase.from("artists").select("id", { count: "exact", head: true }),
        supabase
          .from("tracks")
          .select("id", { count: "exact", head: true })
          .eq("status", "published"),
        supabase.from("albums").select("id", { count: "exact", head: true }),
        supabase
          .from("tracks")
          .select("id", { count: "exact", head: true })
          .eq("status", "processing"),
        supabase
          .from("reports")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
      ]);

    return {
      totalUsers: usersRes.count || 0,
      totalArtists: artistsRes.count || 0,
      totalTracks: tracksRes.count || 0,
      totalAlbums: albumsRes.count || 0,
      pendingUploads: pendingRes.count || 0,
      pendingReports: blockedRes.count || 0,
    };
  },

  // ── Users ───────────────────────────────────────────────────
  async getUsers(search = "", filter = "all", page = 0, limit = 20) {
    const adminRolesSelect =
      filter === "admins" ? "admin_roles!inner(role)" : "admin_roles(role)";

    let query = supabase
      .from("users")
      .select(
        `id, email, phone, username, display_name, subscription_tier, is_artist, role, account_status, created_at, ${adminRolesSelect}`,
      )
      .order("created_at", { ascending: false })
      .range(page * limit, (page + 1) * limit - 1);

    if (search) {
      query = query.or(
        `email.ilike.%${search}%,phone.ilike.%${search}%,username.ilike.%${search}%,display_name.ilike.%${search}%`,
      );
    }
    if (filter === "creators") {
      query = query.eq("is_artist", true).is("admin_roles", null);
    }
    if (filter === "listeners") {
      query = query.eq("is_artist", false).is("admin_roles", null);
    }
    if (filter === "premium") query = query.eq("subscription_tier", "premium");

    const { data, error } = await query;
    return { data: data || [], error };
  },

  async getUserDetail(userId: string) {
    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    const { data: artists } = await supabase
      .from("artists")
      .select("id, name, follower_count, monthly_listeners")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    const artist = artists?.[0] || null;
    const artistIds = (artists || []).map((item) => item.id);

    let trackCount = 0;
    if (artistIds.length > 0) {
      const { data: primaryTracks } = await supabase
        .from("tracks")
        .select("id")
        .in("artist_id", artistIds);

      const { data: creditedTracks } = await supabase
        .from("track_artists")
        .select("track_id")
        .in("artist_id", artistIds);

      const trackIds = new Set<string>();
      (primaryTracks || []).forEach((track) => trackIds.add(track.id));
      (creditedTracks || []).forEach((credit) => trackIds.add(credit.track_id));
      trackCount = trackIds.size;
    }

    const { data: adminRole } = await supabase
      .from("admin_roles")
      .select("role")
      .eq("user_id", userId)
      .single();

    return { user, artist, artists: artists || [], adminRole, trackCount };
  },

  async blockUser(userId: string) {
    return api.updateAdminUser(userId, { account_status: "blocked" });
  },

  async setAccountStatus(userId: string, accountStatus: "active" | "blocked") {
    return api.updateAdminUser(userId, { account_status: accountStatus });
  },

  async makeAdmin(userId: string, role = "moderator") {
    return supabase.from("admin_roles").upsert({ user_id: userId, role });
  },

  async removeAdmin(userId: string) {
    return supabase.from("admin_roles").delete().eq("user_id", userId);
  },

  async setUserRole(userId: string, role: "admin" | "creator" | "listener") {
    return api.updateAdminUser(
      userId,
      role === "admin" ? { role, admin_role: "admin" } : { role },
    );
  },

  async setAdminLevel(
    userId: string,
    adminRole: "super_admin" | "admin" | "moderator",
  ) {
    return api.updateAdminUser(userId, { admin_role: adminRole });
  },

  async updateUserProfile(
    userId: string,
    updates: {
      display_name?: string | null;
      username?: string;
      bio?: string | null;
      country?: string | null;
      avatar_url?: string | null;
      subscription_tier?: "free" | "premium" | "artist_pro";
    },
  ) {
    return api.updateAdminUser(userId, updates);
  },

  // ── Content ─────────────────────────────────────────────────
  async getPendingTracks() {
    const { data } = await supabase
      .from("tracks")
      .select(
        `
        id, title, status, created_at, explicit,
        artists!tracks_artist_id_fkey ( id, name ),
        albums!tracks_album_id_fkey   ( cover_art_url, title )
      `,
      )
      .eq("status", "processing")
      .order("created_at", { ascending: true })
      .limit(20);
    return data || [];
  },

  async getAllTracks(genre = "", status = "published", page = 0, limit = 100) {
    let query = supabase
      .from("tracks")
      .select(
        `
        id, title, play_count, explicit, status, created_at,
        artists!tracks_artist_id_fkey ( name ),
        albums!tracks_album_id_fkey   ( cover_art_url )
      `,
        { count: "exact" },
      )
      .order("play_count", { ascending: false })
      .range(page * limit, (page + 1) * limit - 1);

    if (status) query = query.eq("status", status);

    const { data, count } = await query;
    return { data: data || [], count };
  },

  // ── Content write operations — route through backend API ─────
  // Direct supabase writes fail for admins due to RLS on tracks/albums

  async approveTrack(trackId: string) {
    try {
      return await api.updateTrackStatus(trackId, "published");
    } catch (error: any) {
      const apiError = parseAPIError(error, "Failed to approve track");
      if (apiError.isRetryable()) {
        await offlineQueue.add("APPROVE_TRACK", { trackId });
        throw new APIError(
          "Action queued. Will retry when online.",
          ErrorCode.OFFLINE,
        );
      }
      throw apiError;
    }
  },

  async rejectTrack(trackId: string) {
    try {
      return await api.updateTrackStatus(trackId, "rejected");
    } catch (error: any) {
      const apiError = parseAPIError(error, "Failed to reject track");
      if (apiError.isRetryable()) {
        await offlineQueue.add("REJECT_TRACK", { trackId });
        throw new APIError(
          "Action queued. Will retry when online.",
          ErrorCode.OFFLINE,
        );
      }
      throw apiError;
    }
  },

  async takedownTrack(trackId: string) {
    try {
      return await api.updateTrackStatus(trackId, "takedown");
    } catch (error: any) {
      const apiError = parseAPIError(error, "Failed to takedown track");
      if (apiError.isRetryable()) {
        await offlineQueue.add("TAKEDOWN_TRACK", { trackId });
        throw new APIError(
          "Action queued. Will retry when online.",
          ErrorCode.OFFLINE,
        );
      }
      throw apiError;
    }
  },

  // ── Reports ─────────────────────────────────────────────────
  async getReports(filter = "all") {
    const response = await api.getAdminReports("pending", filter, 50);
    return response?.data || [];
  },

  async resolveReport(reportId: string, action: "resolved" | "dismissed") {
    const response = await api.updateAdminReport(reportId, action);
    return response?.data || null;
  },

  async getAuditLogs(
    options: {
      limit?: number;
      action?: string;
      actorId?: string;
      targetUserId?: string;
    } = {},
  ) {
    const response = await api.getAdminAuditLogs({
      limit: options.limit,
      action: options.action,
      actor_id: options.actorId,
      target_user_id: options.targetUserId,
    });
    return response?.data || [];
  },

  async getArtistAnalytics(limit = 10) {
    const response = await api.getArtistAnalytics(limit);
    return response?.data || [];
  },

  // ── Albums ──────────────────────────────────────────────────
  async getAllAlbums(page = 0, limit = 100) {
    const { data, count } = await supabase
      .from("albums")
      .select(
        `
        id, title, type, is_published, total_tracks, created_at,
        artists!albums_artist_id_fkey ( name ),
        cover_art_url
      `,
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(page * limit, (page + 1) * limit - 1);
    return { data: data || [], count };
  },

  async deleteTrack(trackId: string) {
    try {
      return await api.deleteTrack(trackId);
    } catch (error: any) {
      const apiError = parseAPIError(error, "Failed to delete track");
      if (apiError.isRetryable()) {
        await offlineQueue.add("DELETE_TRACK", { trackId });
        throw new APIError(
          "Delete queued. Will retry when online.",
          ErrorCode.OFFLINE,
        );
      }
      throw apiError;
    }
  },

  async toggleAlbumPublished(albumId: string, published: boolean) {
    try {
      return await api.updateAlbum(albumId, { is_published: published } as any);
    } catch (error: any) {
      const apiError = parseAPIError(error, "Failed to update album");
      if (apiError.isRetryable()) {
        await offlineQueue.add("TOGGLE_ALBUM", { albumId, published });
        throw new APIError(
          "Update queued. Will retry when online.",
          ErrorCode.OFFLINE,
        );
      }
      throw apiError;
    }
  },

  // ── Artists ─────────────────────────────────────────────────
  async deleteAlbum(albumId: string) {
    try {
      return await api.deleteAlbum(albumId);
    } catch (error: any) {
      const apiError = parseAPIError(error, "Failed to delete album");
      if (apiError.isRetryable()) {
        await offlineQueue.add("DELETE_ALBUM", { albumId });
        throw new APIError(
          "Delete queued. Will retry when online.",
          ErrorCode.OFFLINE,
        );
      }
      throw apiError;
    }
  },

  async getAllArtists(search = "", page = 0, limit = 100) {
    let query = supabase
      .from("artists")
      .select(
        "id, name, avatar_url, is_verified, follower_count, monthly_listeners, created_at",
        { count: "exact" },
      )
      .order("follower_count", { ascending: false })
      .range(page * limit, (page + 1) * limit - 1);

    if (search) query = query.ilike("name", `%${search}%`);

    const { data, count } = await query;
    return { data: data || [], count };
  },

  async verifyArtist(artistId: string, verified: boolean) {
    try {
      return await supabase
        .from("artists")
        .update({ is_verified: verified })
        .eq("id", artistId);
    } catch (error: any) {
      const apiError = parseAPIError(
        error,
        "Failed to update artist verification",
      );
      if (apiError.isRetryable()) {
        await offlineQueue.add("VERIFY_ARTIST", { artistId, verified });
        throw new APIError(
          "Update queued. Will retry when online.",
          ErrorCode.OFFLINE,
        );
      }
      throw apiError;
    }
  },
};
