// ============================================================
// SOUNDWAVE — Stream Route (Supabase Storage version)
// src/routes/stream.js
//
// Returns a streaming URL for a track.
// Uses Supabase Storage public URLs — no signed URLs needed.
// ============================================================

const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/auth");
const {
  validateQuery,
  validateParams,
  z,
} = require("../middleware/validation");
const { supabaseAdmin } = require("../utils/supabase");

const trackStreamQuerySchema = z.object({
  quality: z.string().max(50).optional(),
});

const trackIdParamSchema = z.object({
  trackId: z.string().uuid(),
});

// GET /api/stream/:trackId?quality=medium
router.get(
  "/:trackId",
  requireAuth,
  validateParams(trackIdParamSchema),
  validateQuery(trackStreamQuerySchema),
  async (req, res) => {
    try {
      const { trackId } = req.params;
      const quality = req.query.quality || "medium";

      // Check user subscription tier
      const { data: user } = await supabaseAdmin
        .from("users")
        .select("subscription_tier")
        .eq("id", req.userId)
        .single();

      // Free users limited to low/medium quality
      const allowedQuality =
        user?.subscription_tier === "free" ? "medium" : quality;

      // Get the track file URL
      const { data: trackFile, error } = await supabaseAdmin
        .from("track_files")
        .select("file_url, format, bitrate_kbps, quality")
        .eq("track_id", trackId)
        .eq("quality", allowedQuality)
        .single();

      if (error || !trackFile) {
        // Fallback — return any available quality
        const { data: fallback } = await supabaseAdmin
          .from("track_files")
          .select("file_url, quality, format")
          .eq("track_id", trackId)
          .limit(1)
          .single();

        if (!fallback) {
          return res
            .status(404)
            .json({ error: "No audio file available for this track" });
        }

        return res.json({
          data: {
            url: fallback.file_url,
            quality: fallback.quality,
            format: fallback.format,
          },
        });
      }

      // Supabase Storage public URLs don't expire — return directly
      res.json({
        data: {
          url: trackFile.file_url,
          quality: trackFile.quality,
          format: trackFile.format,
          bitrate: trackFile.bitrate_kbps,
        },
      });
    } catch (err) {
      console.error("stream error:", err);
      res.status(500).json({ error: err.message });
    }
  },
);

module.exports = router;
