// backend/src/routes/albums.js
const express = require("express");
const router = express.Router();
const { requireAuth, requireMinRole } = require("../middleware/auth");
const { validateBody, validateParams, z } = require("../middleware/validation");
const { supabaseAdmin } = require("../utils/supabase");

const albumUpdateSchema = z.object({
  title: z.string().max(200).optional(),
  type: z.string().max(50).optional(),
  release_date: z.string().optional(),
  is_published: z.boolean().optional(),
  cover_art_url: z.string().max(250).optional().nullable(),
});

const albumIdParamSchema = z.object({
  id: z.string().uuid(),
});

// PATCH /api/albums/:id — update album (admin or album owner)
router.patch(
  "/:id",
  requireAuth,
  validateParams(albumIdParamSchema),
  validateBody(albumUpdateSchema),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { title, type, release_date, is_published, cover_art_url } =
        req.body;

      // Verify ownership or admin
      if (!req.isAdmin) {
        const { data: album } = await supabaseAdmin
          .from("albums")
          .select("artist_id")
          .eq("id", id)
          .single();

        const { data: artist } = await supabaseAdmin
          .from("artists")
          .select("id")
          .eq("id", album?.artist_id)
          .eq("user_id", req.userId)
          .single();

        if (!artist) return res.status(403).json({ error: "Not your album" });
      }

      const updates = {};
      if (title !== undefined) updates.title = title;
      if (type !== undefined) updates.type = type;
      if (release_date !== undefined) updates.release_date = release_date;
      if (is_published !== undefined) updates.is_published = is_published;
      if (cover_art_url !== undefined) updates.cover_art_url = cover_art_url;

      const { data, error } = await supabaseAdmin
        .from("albums")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) return res.status(400).json({ error: error.message });
      res.json({ data });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

// DELETE /api/albums/:id
router.delete(
  "/:id",
  requireAuth,
  validateParams(albumIdParamSchema),
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!req.isAdmin) {
        const { data: album } = await supabaseAdmin
          .from("albums")
          .select("artist_id")
          .eq("id", id)
          .single();

        const { data: artist } = await supabaseAdmin
          .from("artists")
          .select("id")
          .eq("id", album?.artist_id)
          .eq("user_id", req.userId)
          .single();

        if (!artist) return res.status(403).json({ error: "Not your album" });
      }

      const { error } = await supabaseAdmin
        .from("albums")
        .delete()
        .eq("id", id);

      if (error) return res.status(400).json({ error: error.message });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

module.exports = router;
