// ============================================================
// src/routes/users.js
// ============================================================
const express = require("express");
const router = express.Router();
const { requireAuth, requireRole } = require("../middleware/auth");
const {
  validateBody,
  validateQuery,
  validateParams,
  z,
} = require("../middleware/validation");
const { supabaseAdmin } = require("../utils/supabase");
const { logAdminAction, notifyAdmins } = require("../utils/adminAudit");

const adminUserUpdateSchema = z.object({
  role: z.enum(["admin", "creator", "listener"]).optional(),
  admin_role: z
    .union([z.enum(["super_admin", "admin", "moderator"]), z.null()])
    .optional(),
  account_status: z
    .union([z.enum(["active", "blocked", "deleted"]), z.null()])
    .optional(),
  display_name: z.string().max(100).optional().nullable(),
  username: z.string().min(1).max(50).optional(),
  bio: z.string().max(500).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  avatar_url: z.string().max(250).optional().nullable(),
  subscription_tier: z.enum(["free", "premium", "artist_pro"]).optional(),
});

const adminUserListQuerySchema = z.object({
  search: z.string().max(100).optional().nullable(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const adminContentQuerySchema = z.object({
  type: z.enum(["pending", "albums", "artists"]).optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
});

const adminNotificationsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
  unread: z.enum(["true", "false"]).optional(),
});

const artistAnalyticsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
});

const historyQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
});

const libraryQuerySchema = z.object({
  item_type: z.string().max(50).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const libraryItemParamsSchema = z.object({
  itemType: z.string().max(50),
  itemId: z.string().max(100),
});

const notificationIdParamSchema = z.object({
  id: z.string().uuid(),
});

const librarySaveSchema = z.object({
  item_type: z.string().min(1).max(50),
  item_id: z.string().min(1).max(100),
});

const reportCreateSchema = z.object({
  content_type: z.string().min(1).max(50),
  content_id: z.string().min(1).max(100),
  reason: z.string().min(1).max(500),
  description: z.string().max(1000).optional().nullable(),
  priority: z.enum(["low", "normal", "high"]).optional(),
});

const queueUpdateSchema = z.object({
  tracks: z.array(z.string().uuid()).min(0),
  source_type: z.string().max(50).optional(),
  source_id: z.string().uuid().optional().nullable(),
});

const reportStatusSchema = z.object({
  status: z.enum(["resolved", "dismissed"]),
});

const VALID_ROLES = new Set(["admin", "creator", "listener"]);
const VALID_STATUSES = new Set(["active", "blocked", "deleted"]);
const VALID_ADMIN_ROLES = new Set(["super_admin", "admin", "moderator"]);
const VALID_SUBSCRIPTION_TIERS = new Set(["free", "premium", "artist_pro"]);

const getCount = async (table, buildQuery = (query) => query) => {
  const query = buildQuery(
    supabaseAdmin.from(table).select("id", { count: "exact", head: true }),
  );
  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
};

const getAdminUserCount = async () => {
  const [{ data: adminRows }, { data: legacyRows }] = await Promise.all([
    supabaseAdmin.from("admin_roles").select("user_id"),
    supabaseAdmin.from("users").select("id").eq("role", "admin"),
  ]);
  const ids = new Set();
  (adminRows || []).forEach((row) => ids.add(row.user_id));
  (legacyRows || []).forEach((row) => ids.add(row.id));
  return ids.size;
};

const normalizeAdminUser = (user) => {
  const adminRole = Array.isArray(user.admin_roles)
    ? user.admin_roles[0]?.role
    : user.admin_roles?.role;
  const derivedRole = adminRole ? "admin" : user.role || "listener";
  const { admin_roles, ...cleanUser } = user;
  return {
    ...cleanUser,
    role: derivedRole,
    app_role: user.role || "listener",
    admin_role: adminRole || null,
  };
};

// GET /api/users/admin/stats - dashboard counts from live database
router.get(
  "/admin/stats",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    try {
      const [
        totalUsers,
        admins,
        creators,
        listeners,
        blockedUsers,
        totalTracks,
        totalAlbums,
        totalArtists,
        pendingUploads,
      ] = await Promise.all([
        getCount("users"),
        getAdminUserCount(),
        getCount("users", (query) => query.eq("role", "creator")),
        getCount("users", (query) => query.eq("role", "listener")),
        getCount("users", (query) => query.eq("account_status", "blocked")),
        getCount("tracks"),
        getCount("albums"),
        getCount("artists"),
        getCount("tracks", (query) =>
          query.in("status", ["processing", "review"]),
        ),
      ]);

      res.json({
        data: {
          totalUsers,
          admins,
          creators,
          listeners,
          blockedUsers,
          totalTracks,
          totalAlbums,
          totalArtists,
          pendingUploads,
        },
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

// GET /api/users/admin/content - catalog/moderation preview from live DB
router.get(
  "/admin/content",
  requireAuth,
  requireRole("admin"),
  validateQuery(adminContentQuerySchema),
  async (req, res) => {
    try {
      const { type = "pending", limit = 20 } = req.query;
      const safeLimit = Math.min(Number(limit) || 20, 50);

      if (type === "albums") {
        const { data, error } = await supabaseAdmin
          .from("albums")
          .select(
            `
          id, title, type, cover_art_url, is_published, release_date, total_tracks,
          artists!albums_artist_id_fkey ( id, name )
        `,
          )
          .order("created_at", { ascending: false })
          .limit(safeLimit);
        if (error) throw error;
        return res.json({ data });
      }

      if (type === "artists") {
        const { data, error } = await supabaseAdmin
          .from("artists")
          .select(
            "id, name, avatar_url, country, is_verified, monthly_listeners, follower_count",
          )
          .order("created_at", { ascending: false })
          .limit(safeLimit);
        if (error) throw error;
        return res.json({ data });
      }

      let query = supabaseAdmin
        .from("tracks")
        .select(
          `
        id, title, status, cover_art_url, duration_ms, play_count, like_count, published_at,
        artists!tracks_artist_id_fkey ( id, name, avatar_url ),
        albums!tracks_album_id_fkey ( id, title, cover_art_url )
      `,
        )
        .order("created_at", { ascending: false })
        .limit(safeLimit);

      if (type === "pending") {
        query = query.in("status", ["processing", "review"]);
      }

      const { data, error } = await query;
      if (error) throw error;
      res.json({ data });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

// GET /api/users/admin/users - admin user management list
router.get(
  "/admin/users",
  requireAuth,
  requireRole("admin"),
  validateQuery(adminUserListQuerySchema),
  async (req, res) => {
    const { search = "", limit = 50, offset = 0 } = req.query;

    let query = supabaseAdmin
      .from("users")
      .select(
        `
      id, email, username, display_name, phone, phone_verified,
      role, account_status, is_artist, created_at,
      admin_roles ( role )
    `,
      )
      .order("created_at", { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    const cleanSearch = String(search).trim();
    if (cleanSearch) {
      query = query.or(
        `email.ilike.%${cleanSearch}%,username.ilike.%${cleanSearch}%,display_name.ilike.%${cleanSearch}%,phone.ilike.%${cleanSearch}%`,
      );
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ data: (data || []).map(normalizeAdminUser) });
  },
);

// PATCH /api/users/admin/users/:id - admin can promote/demote/block users
const userIdParamSchema = z.object({
  id: z.string().uuid(),
});

const reportIdParamSchema = z.object({
  id: z.string().uuid(),
});

router.patch(
  "/admin/users/:id",
  requireAuth,
  requireRole("admin"),
  validateParams(userIdParamSchema),
  validateBody(adminUserUpdateSchema),
  async (req, res) => {
    const {
      role,
      admin_role,
      account_status,
      display_name,
      username,
      bio,
      country,
      avatar_url,
      subscription_tier,
    } = req.body;
    const updates = {};

    const { data: targetAdminRole } = await supabaseAdmin
      .from("admin_roles")
      .select("role")
      .eq("user_id", req.params.id)
      .maybeSingle();

    if (
      targetAdminRole?.role === "super_admin" &&
      req.adminRole !== "super_admin"
    ) {
      return res
        .status(403)
        .json({ error: "Only a super admin can modify a super admin" });
    }

    const { data: userBefore } = await supabaseAdmin
      .from("users")
      .select(
        `
      id, email, username, display_name, phone, phone_verified,
      avatar_url, bio, country, subscription_tier,
      role, account_status, is_artist, created_at,
      admin_roles ( role )
    `,
      )
      .eq("id", req.params.id)
      .single();

    if (role !== undefined) {
      if (!VALID_ROLES.has(role)) {
        return res.status(400).json({ error: "Invalid role" });
      }
      updates.role = role;
      updates.is_artist = role === "admin" || role === "creator";
    }

    if (admin_role !== undefined && admin_role !== null) {
      if (!VALID_ADMIN_ROLES.has(admin_role)) {
        return res.status(400).json({ error: "Invalid admin role" });
      }
      if (admin_role === "super_admin" && req.adminRole !== "super_admin") {
        return res
          .status(403)
          .json({ error: "Only a super admin can grant super admin access" });
      }
    }

    if (account_status !== undefined) {
      if (!VALID_STATUSES.has(account_status)) {
        return res.status(400).json({ error: "Invalid account status" });
      }
      updates.account_status = account_status;
    }

    if (display_name !== undefined) {
      updates.display_name = String(display_name).trim() || null;
    }

    if (username !== undefined) {
      const cleanUsername = String(username).trim();
      if (!cleanUsername) {
        return res.status(400).json({ error: "Username is required" });
      }
      updates.username = cleanUsername;
    }

    if (bio !== undefined) {
      updates.bio = String(bio).trim() || null;
    }

    if (country !== undefined) {
      updates.country = String(country).trim() || null;
    }

    if (avatar_url !== undefined) {
      updates.avatar_url = String(avatar_url).trim() || null;
    }

    if (subscription_tier !== undefined) {
      if (!VALID_SUBSCRIPTION_TIERS.has(subscription_tier)) {
        return res.status(400).json({ error: "Invalid subscription tier" });
      }
      updates.subscription_tier = subscription_tier;
    }

    if (Object.keys(updates).length === 0) {
      if (admin_role === undefined) {
        return res.status(400).json({ error: "No valid updates provided" });
      }
    }

    if (
      req.params.id === req.userId &&
      updates.account_status &&
      updates.account_status !== "active"
    ) {
      return res
        .status(400)
        .json({ error: "Admins cannot block their own account" });
    }

    if (role === "admin") {
      await supabaseAdmin
        .from("admin_roles")
        .upsert({ user_id: req.params.id, role: admin_role || "admin" });
    } else if (role === "creator" || role === "listener") {
      await supabaseAdmin
        .from("admin_roles")
        .delete()
        .eq("user_id", req.params.id);
    } else if (admin_role !== undefined) {
      if (admin_role) {
        await supabaseAdmin
          .from("admin_roles")
          .upsert({ user_id: req.params.id, role: admin_role });
      } else {
        await supabaseAdmin
          .from("admin_roles")
          .delete()
          .eq("user_id", req.params.id);
      }
    }

    let userQuery = supabaseAdmin
      .from("users")
      .select(
        `
      id, email, username, display_name, phone, phone_verified,
      avatar_url, bio, country, subscription_tier,
      role, account_status, is_artist, created_at,
      admin_roles ( role )
    `,
      )
      .eq("id", req.params.id)
      .single();

    if (Object.keys(updates).length > 0) {
      userQuery = supabaseAdmin
        .from("users")
        .update(updates)
        .eq("id", req.params.id)
        .select(
          `
        id, email, username, display_name, phone, phone_verified,
        avatar_url, bio, country, subscription_tier,
        role, account_status, is_artist, created_at,
        admin_roles ( role )
      `,
        )
        .single();
    }

    const { data, error } = await userQuery;

    if (error) {
      // Handle unique constraint / conflict errors by returning current server state
      if (error.code === "23505") {
        const { data: serverData } = await supabaseAdmin
          .from("users")
          .select(
            `
        id, email, username, display_name, phone, phone_verified,
        avatar_url, bio, country, subscription_tier,
        role, account_status, is_artist, created_at,
        admin_roles ( role )
      `,
          )
          .eq("id", req.params.id)
          .single();

        return res.status(409).json({
          error: error.message,
          code: "CONFLICT",
          serverState: serverData ? normalizeAdminUser(serverData) : null,
        });
      }
      return res.status(400).json({ error: error.message });
    }

    const normalizedUser = normalizeAdminUser(data);

    await logAdminAction({
      actorId: req.userId,
      targetUserId: req.params.id,
      action: "update_user",
      oldValues: userBefore ? normalizeAdminUser(userBefore) : null,
      newValues: normalizedUser,
    });

    res.json({ data: normalizedUser });
  },
);

// POST /api/users/reports - create a report from the current user
router.post(
  "/reports",
  requireAuth,
  validateBody(reportCreateSchema),
  async (req, res) => {
    const {
      content_type,
      content_id,
      reason,
      description,
      priority = "normal",
    } = req.body;
    if (!content_type || !content_id || !reason) {
      return res
        .status(400)
        .json({ error: "content_type, content_id, and reason are required" });
    }

    const { data, error } = await supabaseAdmin
      .from("reports")
      .insert({
        reporter_id: req.userId,
        content_type,
        content_id,
        reason,
        description: description || null,
        priority,
      })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });

    await notifyAdmins({
      type: "system",
      title: "New moderation report",
      body: `${content_type} report submitted: ${reason}`,
      payload: {
        report_id: data.id,
        content_type,
        content_id,
        priority,
      },
    });

    res.status(201).json({ data });
  },
);

// GET /api/users/admin/reports - admin report queue
const adminReportListQuerySchema = z.object({
  status: z.string().max(50).optional(),
  content_type: z.string().max(50).optional(),
  sort: z.string().max(50).optional(),
  order: z.enum(["asc", "desc"]).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

router.get(
  "/admin/reports",
  requireAuth,
  requireRole("admin"),
  validateQuery(adminReportListQuerySchema),
  async (req, res) => {
    const {
      status = "pending",
      content_type,
      sort = "priority",
      order = "desc",
      limit = 50,
    } = req.query;

    let query = supabaseAdmin
      .from("reports")
      .select(
        `
      id, reporter_id, content_type, content_id, reason, description,
      status, priority, resolved_by, resolved_at, created_at,
      reporter:reporter_id ( id, email, username, display_name, phone )
    `,
      )
      .limit(Math.min(Number(limit) || 50, 100));

    if (status && status !== "all") query = query.eq("status", status);
    if (content_type && content_type !== "all")
      query = query.eq("content_type", content_type);

    if (sort === "priority") {
      query = query
        .order("priority", { ascending: order !== "desc" })
        .order("created_at", { ascending: true });
    } else {
      query = query.order(String(sort), { ascending: order === "asc" });
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ data });
  },
);

// PATCH /api/users/admin/reports/:id - resolve or dismiss a report
router.patch(
  "/admin/reports/:id",
  requireAuth,
  requireRole("admin"),
  validateParams(reportIdParamSchema),
  validateBody(reportStatusSchema),
  async (req, res) => {
    const { status } = req.body;
    if (!["resolved", "dismissed"].includes(status)) {
      return res.status(400).json({ error: "Invalid report status" });
    }

    const { data: reportBefore, error: reportBeforeError } = await supabaseAdmin
      .from("reports")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (reportBeforeError || !reportBefore) {
      return res.status(404).json({ error: "Report not found" });
    }

    const { data, error } = await supabaseAdmin
      .from("reports")
      .update({
        status,
        resolved_by: req.userId,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });

    await logAdminAction({
      actorId: req.userId,
      targetUserId: reportBefore.reporter_id,
      action: status === "resolved" ? "resolve_report" : "dismiss_report",
      oldValues: {
        status: reportBefore.status,
        content_type: reportBefore.content_type,
        content_id: reportBefore.content_id,
        reason: reportBefore.reason,
      },
      newValues: {
        status,
        resolved_at: new Date().toISOString(),
      },
    });

    res.json({ data });
  },
);

// GET /api/users/admin/audit-logs - recent admin action history
const adminAuditLogsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
  action: z.string().max(100).optional(),
  actor_id: z.string().max(100).optional(),
  target_user_id: z.string().max(100).optional(),
});

router.get(
  "/admin/audit-logs",
  requireAuth,
  requireRole("admin"),
  validateQuery(adminAuditLogsQuerySchema),
  async (req, res) => {
    const { limit = 50, action, actor_id, target_user_id } = req.query;
    let query = supabaseAdmin
      .from("admin_audit_logs")
      .select(
        `
      id, actor_id, target_user_id, action, old_values, new_values, created_at,
      actor:actor_id ( id, username, display_name ),
      target_user:target_user_id ( id, username, display_name )
    `,
      )
      .order("created_at", { ascending: false })
      .limit(Math.min(Number(limit) || 50, 100));

    if (action) query = query.eq("action", action);
    if (actor_id) query = query.eq("actor_id", actor_id);
    if (target_user_id) query = query.eq("target_user_id", target_user_id);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ data });
  },
);

// GET /api/users/admin/artist-analytics - artist metrics for admins
router.get(
  "/admin/artist-analytics",
  requireAuth,
  requireRole("admin"),
  validateQuery(artistAnalyticsQuerySchema),
  async (req, res) => {
    const { limit = 20 } = req.query;
    const safeLimit = Math.min(Number(limit) || 20, 50);

    const { data: artists, error: artistError } = await supabaseAdmin
      .from("artists")
      .select(
        "id, name, avatar_url, follower_count, monthly_listeners, user_id",
      )
      .order("follower_count", { ascending: false })
      .limit(safeLimit);

    if (artistError)
      return res.status(500).json({ error: artistError.message });

    const artistIds = (artists || []).map((artist) => artist.id);
    let metrics = {};

    if (artistIds.length > 0) {
      const { data: trackRows, error: trackError } = await supabaseAdmin
        .from("tracks")
        .select("artist_id, play_count")
        .in("artist_id", artistIds)
        .eq("status", "published");

      if (trackError)
        return res.status(500).json({ error: trackError.message });

      metrics = (trackRows || []).reduce((acc, track) => {
        const artistId = track.artist_id;
        const current = acc[artistId] || {
          total_plays: 0,
          published_tracks: 0,
        };
        return {
          ...acc,
          [artistId]: {
            total_plays: current.total_plays + (track.play_count || 0),
            published_tracks: current.published_tracks + 1,
          },
        };
      }, {});
    }

    const analytics = (artists || []).map((artist) => ({
      ...artist,
      published_tracks: metrics[artist.id]?.published_tracks || 0,
      total_plays: metrics[artist.id]?.total_plays || 0,
    }));

    res.json({ data: analytics });
  },
);

// GET /api/users/admin/notifications - current user's notifications
router.get(
  "/admin/notifications",
  requireAuth,
  validateQuery(adminNotificationsQuerySchema),
  async (req, res) => {
    const { limit = 50, unread = "false" } = req.query;
    let query = supabaseAdmin
      .from("notifications")
      .select("*")
      .eq("user_id", req.userId)
      .order("created_at", { ascending: false })
      .limit(Math.min(Number(limit) || 50, 100));

    if (unread === "true") query = query.eq("read", false);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ data });
  },
);

router.patch(
  "/admin/notifications/:id/read",
  requireAuth,
  validateParams(notificationIdParamSchema),
  async (req, res) => {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from("notifications")
      .update({ read: true })
      .eq("id", id)
      .eq("user_id", req.userId)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json({ data });
  },
);

// GET /api/users/library — user's saved items
router.get(
  "/library",
  requireAuth,
  validateQuery(libraryQuerySchema),
  async (req, res) => {
    const { item_type, limit = 50, offset = 0 } = req.query;

    let query = supabaseAdmin
      .from("user_library")
      .select("id, item_type, item_id, saved_at")
      .eq("user_id", req.userId)
      .order("saved_at", { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (item_type) query = query.eq("item_type", item_type);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ data });
  },
);

// POST /api/users/library — save item
router.post(
  "/library",
  requireAuth,
  validateBody(librarySaveSchema),
  async (req, res) => {
    const { item_type, item_id } = req.body;

    const { data, error } = await supabaseAdmin
      .from("user_library")
      .insert({ user_id: req.userId, item_type, item_id })
      .select()
      .single();
    if (error && error.code === "23505")
      return res.status(409).json({ error: "Already saved" });
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ data });
  },
);

// DELETE /api/users/library/:itemType/:itemId
router.delete(
  "/library/:itemType/:itemId",
  requireAuth,
  validateParams(libraryItemParamsSchema),
  async (req, res) => {
    await supabaseAdmin
      .from("user_library")
      .delete()
      .eq("user_id", req.userId)
      .eq("item_type", req.params.itemType)
      .eq("item_id", req.params.itemId);
    res.json({ success: true });
  },
);

// GET /api/users/history
router.get(
  "/history",
  requireAuth,
  validateQuery(historyQuerySchema),
  async (req, res) => {
    const { limit = 30 } = req.query;
    const { data, error } = await supabaseAdmin
      .from("listening_history")
      .select(
        `
      id, played_ms, completed, played_at,
      tracks ( id, title, duration_ms, cover_art_url, artists(name, avatar_url), albums(cover_art_url) )
    `,
      )
      .eq("user_id", req.userId)
      .order("played_at", { ascending: false })
      .limit(Number(limit));
    if (error) return res.status(500).json({ error: error.message });
    res.json({ data });
  },
);

// GET /api/users/queue
router.get("/queue", requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("user_queue")
    .select(
      `
      id, position, source_type,
      tracks ( id, title, duration_ms, cover_art_url, artists(name, avatar_url), albums(cover_art_url) )
    `,
    )
    .eq("user_id", req.userId)
    .order("position", { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ data });
});

// PUT /api/users/queue — replace entire queue
router.put(
  "/queue",
  requireAuth,
  validateBody(queueUpdateSchema),
  async (req, res) => {
    const { tracks, source_type, source_id } = req.body;
    if (!Array.isArray(tracks))
      return res.status(400).json({ error: "tracks array required" });

    // Clear existing queue
    await supabaseAdmin.from("user_queue").delete().eq("user_id", req.userId);

    if (tracks.length === 0) return res.json({ success: true });

    const rows = tracks.map((track_id, position) => ({
      user_id: req.userId,
      track_id,
      position,
      source_type: source_type || "queue",
      source_id: source_id || null,
    }));

    const { error } = await supabaseAdmin.from("user_queue").insert(rows);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ success: true });
  },
);

module.exports = router;
