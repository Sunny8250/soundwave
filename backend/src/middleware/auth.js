// ============================================================
// SOUNDWAVE — Auth Middleware
// src/middleware/auth.js
//
// Extracts and verifies the Supabase JWT from the Authorization header.
// Attaches req.user and req.supabaseClient to the request.
//
// Usage in routes:
//   router.get('/me', requireAuth, controller)
//   router.get('/public', controller)          ← no auth needed
// ============================================================

const { createClient } = require("@supabase/supabase-js");
const { supabaseAdmin } = require("../utils/supabase");
const { logAdminAction } = require("../utils/adminAudit");

const ROLE_PRIORITY = {
  listener: 1,
  creator: 2,
  admin: 3,
};

const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ error: "Missing or invalid Authorization header" });
  }

  const token = authHeader.split(" ")[1];

  // Create a Supabase client scoped to this user's JWT
  // This ensures all queries respect RLS for this specific user
  const userSupabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    },
  );

  // Verify the token by fetching the user
  const {
    data: { user },
    error,
  } = await userSupabase.auth.getUser(token);

  if (error || !user) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("users")
    .select("id, role, account_status, is_artist, phone_verified")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return res.status(403).json({ error: "User profile not found" });
  }

  if (profile.account_status !== "active") {
    return res.status(403).json({ error: "This account is not active" });
  }

  const { data: adminRole } = await supabaseAdmin
    .from("admin_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  const hasAdminPrivileges =
    profile.role === "admin" ||
    ["super_admin", "admin", "moderator"].includes(adminRole?.role);

  // Attach to request for use in controllers
  req.user = user;
  req.userId = user.id;
  req.profile = { ...profile, admin_role: adminRole?.role || null };
  req.adminRole = adminRole?.role || null;
  req.userRole = hasAdminPrivileges
    ? "admin"
    : profile.role || (profile.is_artist ? "creator" : "listener");
  req.isAdmin = hasAdminPrivileges;
  req.supabase = userSupabase; // RLS-scoped client
  next();
};

const requireRole =
  (...allowedRoles) =>
  async (req, res, next) => {
    const role = req.userRole || "listener";
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({
        error: `This action requires ${allowedRoles.join(" or ")} access`,
      });
    }

    if (req.isAdmin && req.method !== "GET") {
      try {
        await logAdminAction({
          actorId: req.userId,
          action: `admin_request:${req.method}:${req.path}`,
          newValues: {
            method: req.method,
            path: req.originalUrl || req.path,
            query: req.query || null,
            body: req.body || null,
          },
        });
      } catch (err) {
        console.warn("Admin request logging failed:", err);
      }
    }

    return next();
  };

const requireMinRole = (minimumRole) => (req, res, next) => {
  const role = req.userRole || "listener";
  if ((ROLE_PRIORITY[role] || 0) >= (ROLE_PRIORITY[minimumRole] || 0)) {
    return next();
  }

  return res.status(403).json({
    error: `This action requires ${minimumRole} access`,
  });
};

// Optional auth — attaches user if token present, continues if not
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }
  return requireAuth(req, res, next);
};

module.exports = { requireAuth, optionalAuth, requireRole, requireMinRole };
