// src/routes/auth.js
const express = require("express");
const router = express.Router();
// Supabase Auth handles sign-up/login on the client side.
// These routes are for app-level profile operations post-auth.

const { requireAuth, requireMinRole } = require("../middleware/auth");
const { validateBody, z } = require("../middleware/validation");
const { supabaseAdmin } = require("../utils/supabase");

const profileUpdateSchema = z.object({
  display_name: z.string().max(100).optional(),
  bio: z.string().max(500).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  username: z.string().min(1).max(50).optional(),
});

const becomeArtistSchema = z.object({
  name: z.string().min(1).max(100),
  bio: z.string().max(500).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
});

const normalizeProfile = (profile) => {
  const adminRole = Array.isArray(profile.admin_roles)
    ? profile.admin_roles[0]?.role
    : profile.admin_roles?.role;
  const { admin_roles, ...cleanProfile } = profile;
  return {
    ...cleanProfile,
    app_role: cleanProfile.role || "listener",
    role: adminRole ? "admin" : cleanProfile.role || "listener",
    admin_role: adminRole || null,
  };
};

// GET /api/auth/me — returns the current user's profile
router.get("/me", requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("*, artists(id, name, slug, is_verified), admin_roles(role)")
    .eq("id", req.userId)
    .single();
  if (error) return res.status(404).json({ error: "User not found" });
  res.json({ data: normalizeProfile(data) });
});

// PATCH /api/auth/me — update display name, bio, avatar
router.patch(
  "/me",
  requireAuth,
  validateBody(profileUpdateSchema),
  async (req, res) => {
    const { display_name, bio, country, username } = req.body;
    const updates = {};
    if (display_name !== undefined) updates.display_name = display_name;
    if (bio !== undefined) updates.bio = bio;
    if (country !== undefined) updates.country = country;
    if (username !== undefined) updates.username = username;

    const { data, error } = await supabaseAdmin
      .from("users")
      .update(updates)
      .eq("id", req.userId)
      .select()
      .single();
    if (error) {
      // If unique constraint / conflict, return server state for client resolution
      if (error.code === "23505") {
        const { data: serverData, error: serverErr } = await supabaseAdmin
          .from("users")
          .select("*, artists(id, name, slug, is_verified), admin_roles(role)")
          .eq("id", req.userId)
          .single();

        return res.status(409).json({
          error: error.message,
          code: "CONFLICT",
          serverState: serverData ? normalizeProfile(serverData) : null,
        });
      }
      return res.status(400).json({ error: error.message });
    }

    res.json({ data });
  },
);

// POST /api/auth/become-artist — creates an artist profile for the user
// FIXED: removed requireMinRole('creator') — any authenticated user can become an artist
router.post(
  "/become-artist",
  requireAuth,
  validateBody(becomeArtistSchema),
  async (req, res) => {
    const { name, bio, country } = req.body;
    if (!name?.trim())
      return res.status(400).json({ error: "Artist name is required" });

    // Check if user already has an artist profile
    const { data: existing } = await supabaseAdmin
      .from("artists")
      .select("id")
      .eq("user_id", req.userId)
      .single();

    if (existing) {
      return res
        .status(409)
        .json({ error: "You already have an artist profile" });
    }

    const cleanName = name.trim();
    const baseSlug = cleanName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const slug = `${baseSlug}-${require("crypto").randomBytes(3).toString("hex")}`;

    const { data, error } = await supabaseAdmin
      .from("artists")
      .insert({ user_id: req.userId, name: cleanName, slug, bio, country })
      .select()
      .single();

    if (error?.code === "23505") {
      return res.status(409).json({ error: "Artist name already taken" });
    }
    if (error) return res.status(400).json({ error: error.message });

    // Upgrade user role to creator
    await supabaseAdmin
      .from("users")
      .update({ is_artist: true, role: "creator" })
      .eq("id", req.userId);

    res.status(201).json({ data });
  },
);

module.exports = router;
