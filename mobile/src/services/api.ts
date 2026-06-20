import { supabase } from "./supabase";
import { withRetry } from "../utils/retry";
import { APIError, parseAPIError, ErrorCode } from "../utils/apiError";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

const API_PREFIX = process.env.EXPO_PUBLIC_API_PREFIX || "/api/v2";
const API_BASE = API_URL ? `${API_URL}${API_PREFIX}` : "";

if (!API_URL) {
  console.error(
    "[CONFIG ERROR] EXPO_PUBLIC_API_URL is not set. " +
      "All API calls will fail. Set it in your .env file.",
  );
}

const getHeaders = async () => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const { data, error } = await supabase.auth.getSession();
  if (error) return headers;

  let session = data?.session;
  const expiresAt = session?.expires_at;
  const now = Math.floor(Date.now() / 1000);

  if (session?.refresh_token && expiresAt && expiresAt - now < 60) {
    const refreshResult = await supabase.auth.refreshSession();
    if (!refreshResult.error && refreshResult.data?.session) {
      session = refreshResult.data.session;
    }
  }

  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  return headers;
};

const safeFetch = async (
  url: string,
  options: RequestInit = {},
  retryOnAuth = true,
) => {
  if (!API_URL) throw new Error("API_URL not configured");

  const mergedOptions = {
    ...options,
    headers: {
      ...(options.headers as Record<string, string>),
      ...(await getHeaders()),
    },
  } as RequestInit;

  let res: Response;
  try {
    res = await fetch(url, mergedOptions);
  } catch (err: any) {
    console.error(
      "safeFetch network error:",
      url,
      err && err.message ? err.message : err,
    );
    throw err;
  }
  const text = await res.text();

  if (!res.ok) {
    if (res.status === 401 && retryOnAuth) {
      const refreshResult = await supabase.auth.refreshSession();
      if (!refreshResult.error) {
        return safeFetch(url, options, false);
      }
    }

    let errMsg = `HTTP ${res.status}`;
    let errorCode = ErrorCode.UNKNOWN;

    try {
      const body = text ? JSON.parse(text) : null;
      errMsg = body?.error || body?.message || JSON.stringify(body) || errMsg;
      errorCode = body?.code || errorCode;
    } catch {
      errMsg = text || errMsg;
    }

    if (res.status === 401) {
      throw new APIError(errMsg, ErrorCode.UNAUTHORIZED, res.status);
    }

    throw new APIError(errMsg, errorCode, res.status);
  }

  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

/**
 * Wrapper for destructive operations (delete, update, approve)
 * with automatic retry logic
 */
const safeFetchWithRetry = async (
  url: string,
  options: RequestInit = {},
  retryOptions?: any,
) => {
  return withRetry(() => safeFetch(url, options), {
    maxRetries: 3,
    initialDelayMs: 1000,
    ...retryOptions,
  });
};

export const api = {
  // Tracks
  getTracks: async (params?: {
    search?: string;
    genre?: string;
    limit?: number;
  }) => {
    const query = new URLSearchParams(params as any).toString();
    return safeFetch(`${API_BASE}/tracks?${query}`);
  },

  getNewReleases: async () => safeFetch(`${API_BASE}/tracks/new-releases`),

  getTrending: async () => safeFetch(`${API_BASE}/tracks/trending`),

  getIndieIndian: async () => safeFetch(`${API_BASE}/tracks/indie-indian`),

  getBengali: async () => safeFetch(`${API_BASE}/tracks/bengali`),

  getByGenre: async (slug: string, limit = 20) =>
    safeFetch(`${API_BASE}/tracks/by-genre/${slug}?limit=${limit}`),

  getTrack: async (id: string) => safeFetch(`${API_BASE}/tracks/${id}`),

  getStreamUrl: async (trackId: string, quality = "medium") =>
    safeFetch(`${API_BASE}/stream/${trackId}?quality=${quality}`),

  bulkUpload: async (
    files: Array<{ uri: string; name: string; type: string }>,
    tracksMetadata: Array<{
      title: string;
      artist_names: string;
      album_name?: string;
      explicit?: boolean;
      genre_ids?: string[];
      artwork_url?: string;
      track_number?: number;
    }>,
    onProgress?: (completed: number, total: number) => void,
  ) => {
    const headers = await getHeaders();
    delete (headers as any)["Content-Type"];

    const formData = new FormData();

    for (const file of files) {
      formData.append("files", {
        uri: file.uri,
        name: file.name,
        type: file.type,
      } as any);
    }

    formData.append("tracks", JSON.stringify(tracksMetadata));

    const res = await fetch(`${API_BASE}/upload/bulk`, {
      method: "POST",
      headers: headers as any,
      body: formData,
    });

    if (!res.ok) {
      const err = await res
        .json()
        .catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(err.error || `Upload failed with status ${res.status}`);
    }

    return res.json();
  },

  recordPlay: async (
    trackId: string,
    played_ms: number,
    completed: boolean,
  ) => {
    try {
      return await safeFetch(`${API_BASE}/tracks/${trackId}/play`, {
        method: "POST",
        body: JSON.stringify({ played_ms, completed }),
      });
    } catch {
      return null;
    }
  },

  likeTrack: async (trackId: string) =>
    safeFetch(`${API_BASE}/tracks/${trackId}/like`, { method: "POST" }),

  unlikeTrack: async (trackId: string) =>
    safeFetch(`${API_BASE}/tracks/${trackId}/like`, { method: "DELETE" }),

  deleteTrack: async (trackId: string) =>
    safeFetchWithRetry(`${API_BASE}/tracks/${trackId}`, {
      method: "DELETE",
    }),

  deleteAdminTrack: async (trackId: string) =>
    safeFetchWithRetry(`${API_BASE}/tracks/admin/${trackId}`, {
      method: "DELETE",
    }),

  updateTrackStatus: async (trackId: string, status: string) =>
    safeFetchWithRetry(`${API_BASE}/tracks/${trackId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  // Artists
  getArtist: async (id: string) => safeFetch(`${API_BASE}/artists/${id}`),

  updateArtist: async (id: string, updates: any) =>
    safeFetch(`${API_BASE}/artists/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    }),

  deleteArtist: async (id: string) =>
    safeFetch(`${API_BASE}/artists/${id}`, { method: "DELETE" }),

  // Albums
  updateAlbum: async (id: string, updates: any) =>
    safeFetch(`${API_BASE}/albums/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    }),

  deleteAlbum: async (id: string) =>
    safeFetch(`${API_BASE}/albums/${id}`, { method: "DELETE" }),

  // Playlists
  getPlaylist: async (id: string) => safeFetch(`${API_BASE}/playlists/${id}`),

  getGenres: async () => {
    const { data, error } = await supabase
      .from("genres")
      .select("*")
      .order("name");
    return { data, error };
  },

  getMe: async () => safeFetch(`${API_BASE}/auth/me`),

  getAdminUsers: async (search = "") => {
    const query = search ? `?search=${encodeURIComponent(search)}` : "";
    return safeFetch(`${API_BASE}/users/admin/users${query}`);
  },

  getAdminStats: async () => safeFetch(`${API_BASE}/users/admin/stats`),

  getAdminContent: async (type = "pending", limit = 20) => {
    const query = new URLSearchParams({
      type,
      limit: String(limit),
    }).toString();
    return safeFetch(`${API_BASE}/users/admin/content?${query}`);
  },

  updateAdminUser: async (id: string, updates: any) =>
    safeFetch(`${API_BASE}/users/admin/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    }),

  createReport: async (report: any) =>
    safeFetch(`${API_BASE}/users/reports`, {
      method: "POST",
      body: JSON.stringify(report),
    }),

  getAdminReports: async (
    status = "pending",
    contentType = "all",
    limit = 50,
  ) => {
    const query = new URLSearchParams({
      status,
      content_type: contentType,
      limit: String(limit),
    }).toString();
    return safeFetch(`${API_BASE}/users/admin/reports?${query}`);
  },

  updateAdminReport: async (id: string, status: "resolved" | "dismissed") =>
    safeFetch(`${API_BASE}/users/admin/reports/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  getAdminAuditLogs: async (
    params: {
      limit?: number;
      action?: string;
      actor_id?: string;
      target_user_id?: string;
    } = {},
  ) => {
    const query = new URLSearchParams({
      limit: String(params.limit || 50),
      ...(params.action ? { action: params.action } : {}),
      ...(params.actor_id ? { actor_id: params.actor_id } : {}),
      ...(params.target_user_id
        ? { target_user_id: params.target_user_id }
        : {}),
    }).toString();
    return safeFetch(`${API_BASE}/users/admin/audit-logs?${query}`);
  },
  getArtistAnalytics: async (limit = 20) =>
    safeFetch(`${API_BASE}/users/admin/artist-analytics?limit=${limit}`),

  getRecentlyPlayed: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return { data: [] };

    const { data } = await supabase
      .from("listening_history")
      .select(
        `
        id, played_at, completed,
        tracks (
          id, title, duration_ms, play_count,
          artists!tracks_artist_id_fkey ( id, name, avatar_url ),
          albums!tracks_album_id_fkey   ( id, title, cover_art_url )
        )
      `,
      )
      .eq("user_id", session.user.id)
      .order("played_at", { ascending: false })
      .limit(20);

    const seen = new Set<string>();
    const unique = (data || []).filter((item) => {
      const t = item.tracks as any;
      if (!t || seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });

    return { data: unique.map((item) => item.tracks) };
  },

  recordPlayComplete: async (trackId: string) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    const { data: recent } = await supabase
      .from("listening_history")
      .select("id")
      .eq("user_id", session.user.id)
      .eq("track_id", trackId)
      .order("played_at", { ascending: false })
      .limit(1)
      .single();

    if (recent?.id) {
      await supabase
        .from("listening_history")
        .update({ completed: true })
        .eq("id", recent.id);
    }

    await supabase.rpc("increment_play_count", { track_id: trackId });
  },
  checkConnectivity: async () => checkConnectivity(),
};

// Try multiple health endpoints to diagnose connectivity problems.
// export const checkConnectivity = async () => {
//   const candidates = [] as string[];
//   if (API_BASE) candidates.push(`${API_BASE}/health`);
//   if (API_URL) candidates.push(`${API_URL}/api/health`);
//   if (API_URL) candidates.push(`${API_URL}/health`);
//   // common local fallback
//   candidates.push(`http://localhost:3000/api/v2/health`);
//   const results: Array<{
//     url: string;
//     ok?: boolean;
//     status?: number;
//     err?: string;
//   }> = [];

//   for (const url of candidates) {
//     try {
//       const controller = new AbortController();
//       const timeout = setTimeout(() => controller.abort(), 3000);
//       const res = await fetch(url, {
//         method: "GET",
//         signal: controller.signal,
//       });
//       clearTimeout(timeout);
//       if (res.ok) return { url, status: res.status };
//       results.push({ url, ok: false, status: res.status });
//     } catch (err: any) {
//       results.push({
//         url,
//         err: err && err.message ? err.message : String(err),
//       });
//     }
//   }

//   throw new Error(
//     `No reachable API endpoints. Attempts: ${JSON.stringify(results)}`,
//   );
// };

// Simplified connectivity check — only tests the real API URL, with a generous
// timeout to account for Render free-tier cold starts (up to 60s to wake up)
export const checkConnectivity = async () => {
  if (!API_URL) {
    throw new Error("EXPO_PUBLIC_API_URL is not configured");
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000); // 45s for cold start
    const res = await fetch(`${API_URL}/api/health`, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.ok) return { url: `${API_URL}/api/health`, status: res.status };
    throw new Error(`Health check returned status ${res.status}`);
  } catch (err: any) {
    throw new Error(`Could not reach backend: ${err?.message || String(err)}`);
  }
};
