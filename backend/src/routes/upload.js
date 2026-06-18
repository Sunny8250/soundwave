// ============================================================
// SOUNDWAVE — Upload Routes
// src/routes/upload.js
//
// Handles the full audio upload pipeline:
// 1. Validate file
// 2. Store raw master to Cloudflare R2
// 3. Create track record in DB with status='processing'
// 4. Return upload ID (processing happens async via worker)
// ============================================================

const express = require("express");
const router = express.Router();
const multer = require("multer");
const { requireAuth, requireMinRole } = require("../middleware/auth");
const { validateBody, validateParams, z } = require("../middleware/validation");
const {
  preflightAlbumUpload,
  uploadTrack,
  uploadBulk,
  getUploadStatus,
  uploadArtwork,
} = require("../controllers/uploadController");

// Use memory storage — we stream directly to Supabase storage, not disk
const storage = multer.memoryStorage();

const preflightAlbumUploadSchema = z.object({
  album_id: z.string().uuid().optional().nullable(),
  album_name: z.string().max(200).optional().nullable(),
  artist_id: z.string().uuid().optional().nullable(),
  tracks: z
    .array(
      z.object({
        client_id: z.string().optional().nullable(),
        title: z.string().min(1).max(200),
        artist_names: z.string().max(500).optional().nullable(),
      }),
    )
    .min(1),
});

const trackUploadSchema = z.object({
  title: z.string().min(1).max(200),
  album_id: z.string().uuid().optional().nullable(),
  album_name: z.string().max(200).optional().nullable(),
  artist_id: z.string().uuid().optional().nullable(),
  track_number: z.coerce.number().int().positive().optional(),
  explicit: z.preprocess((value) => {
    if (value === "true" || value === true) return true;
    if (value === "false" || value === false) return false;
    return undefined;
  }, z.boolean().optional()),
  genre_ids: z.string().optional().nullable(),
  artwork_url: z.string().max(250).optional().nullable(),
  artist_names: z.string().max(500).optional().nullable(),
});

const bulkUploadSchema = z.object({
  tracks: z.preprocess(
    (value) => {
      if (typeof value === "string") {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }
      return value;
    },
    z
      .array(
        z.object({
          title: z.string().min(1).max(200),
          artist_names: z.string().max(500).optional().nullable(),
          album_name: z.string().max(200).optional().nullable(),
          track_number: z.coerce.number().int().positive().optional(),
          explicit: z.preprocess((value) => {
            if (value === "true" || value === true) return true;
            if (value === "false" || value === false) return false;
            return undefined;
          }, z.boolean().optional()),
          genre_ids: z.string().optional().nullable(),
          artwork_url: z.string().max(250).optional().nullable(),
          client_id: z.string().optional().nullable(),
        }),
      )
      .min(1),
  ),
});

const artworkUploadSchema = z.object({
  artist_id: z.string().uuid().optional().nullable(),
});

const uploadTrackIdParamsSchema = z.object({
  trackId: z.string().uuid(),
});

const fileFilter = (req, file, cb) => {
  const allowed = [
    "audio/wav",
    "audio/x-wav",
    "audio/flac",
    "audio/x-flac",
    "audio/mpeg", // mp3
    "audio/aiff",
    "audio/x-aiff",
    "audio/mp4",
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
  }
};

const imageFileFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported image type: ${file.mimetype}`), false);
  }
};

const audioUpload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      "audio/mpeg",
      "audio/mp4",
      "audio/aac",
      "audio/wav",
      "audio/ogg",
      "audio/flac",
    ];
    cb(null, allowed.includes(file.mimetype));
  },
});

const imageUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, file.mimetype.startsWith("image/"));
  },
});

// POST /api/upload/preflight
// Body: JSON { album_id?, album_name?, artist_id?, tracks: [{ title, artist_names }] }
router.post(
  "/preflight",
  requireAuth,
  requireMinRole("creator"),
  validateBody(preflightAlbumUploadSchema),
  preflightAlbumUpload,
);

// POST /api/upload/track
// Body: multipart/form-data
//   - file: audio file (required)
//   - title: string (required)
//   - album_id: UUID (optional)
//   - track_number: integer (optional)
//   - explicit: boolean (optional)
//   - genre_ids: JSON array of genre UUIDs (optional)
router.post(
  "/track",
  requireAuth,
  audioUpload.single("file"),
  validateBody(trackUploadSchema),
  uploadTrack,
);

// POST /api/upload/bulk
// Body: multipart/form-data
//   - files: array of audio files (required)
//   - tracks: JSON string describing metadata for each file, e.g. [{ title, artist_names, album_name, explicit, genre_ids }]
router.post(
  "/bulk",
  requireAuth,
  requireMinRole("creator"),
  audioUpload.array("files", 50),
  validateBody(bulkUploadSchema),
  uploadBulk,
);

// GET /api/upload/status/:trackId
// Poll this to check processing status
router.get(
  "/status/:trackId",
  requireAuth,
  validateParams(uploadTrackIdParamsSchema),
  getUploadStatus,
);

// POST /api/upload/artwork
// Body: multipart/form-data
//   - artwork: image file (required, max 10MB)
router.post(
  "/artwork",
  requireAuth,
  requireMinRole("creator"),
  imageUpload.single("artwork"),
  validateBody(artworkUploadSchema),
  uploadArtwork,
);

module.exports = router;
