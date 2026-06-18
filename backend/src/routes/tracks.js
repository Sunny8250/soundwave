const express = require("express");
const router = express.Router();
const {
  requireAuth,
  optionalAuth,
  requireRole,
  requireMinRole,
} = require("../middleware/auth");
const { validateBody, validateParams, z } = require("../middleware/validation");
const tracksController = require("../controllers/tracksController");

const trackStatusSchema = z.object({
  status: z.enum(["processing", "review", "published", "blocked", "deleted"]),
});

const trackIdParamSchema = z.object({
  id: z.string().uuid(),
});

const trackUpdateSchema = z.object({
  title: z.string().max(300).optional(),
  cover_art_url: z.string().max(250).optional().nullable(),
  bpm: z.number().optional().nullable(),
  mood: z.string().max(100).optional().nullable(),
  energy: z.number().optional().nullable(),
  explicit: z.boolean().optional(),
  album_id: z.string().uuid().optional().nullable(),
  track_number: z.number().int().optional().nullable(),
});

const genreSlugParamSchema = z.object({
  slug: z.string().min(1).max(100),
});

// Public routes
router.get("/", optionalAuth, tracksController.listTracks);
router.get("/trending", tracksController.getTrending);
router.get("/new-releases", tracksController.getNewReleases);
router.get("/indie-indian", tracksController.getIndieIndian);
router.get("/bengali", tracksController.getBengali);
router.get(
  "/by-genre/:slug",
  validateParams(genreSlugParamSchema),
  tracksController.getByGenre,
);
router.get(
  "/:id",
  optionalAuth,
  validateParams(trackIdParamSchema),
  tracksController.getTrack,
);
// PATCH /api/tracks/:id — update track metadata (owner or admin)
router.patch(
  "/:id",
  requireAuth,
  validateParams(trackIdParamSchema),
  validateBody(trackUpdateSchema),
  requireMinRole("creator"),
  tracksController.updateTrackMetadata,
);
router.get(
  "/:id/similar",
  optionalAuth,
  validateParams(trackIdParamSchema),
  tracksController.getSimilar,
);

// Protected routes
router.post(
  "/:id/play",
  requireAuth,
  validateParams(trackIdParamSchema),
  tracksController.recordPlay,
);
router.post(
  "/:id/like",
  requireAuth,
  validateParams(trackIdParamSchema),
  tracksController.likeTrack,
);
router.delete(
  "/:id/like",
  requireAuth,
  validateParams(trackIdParamSchema),
  tracksController.unlikeTrack,
);
router.patch(
  "/:id/status",
  requireAuth,
  validateParams(trackIdParamSchema),
  requireMinRole("admin"),
  validateBody(trackStatusSchema),
  tracksController.updateTrackStatus,
);
router.delete(
  "/admin/:id",
  requireAuth,
  requireRole("admin"),
  validateParams(trackIdParamSchema),
  tracksController.deleteTrack,
);
router.delete(
  "/:id",
  requireAuth,
  requireMinRole("creator"),
  validateParams(trackIdParamSchema),
  tracksController.deleteOwnTrack,
);

module.exports = router;
