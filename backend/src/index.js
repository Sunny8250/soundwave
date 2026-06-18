// ============================================================
// SOUNDWAVE — Express Server Entry Point
// src/index.js
// ============================================================

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/auth");
const trackRoutes = require("./routes/tracks");
const artistRoutes = require("./routes/artists");
const albumRoutes = require("./routes/albums");
const playlistRoutes = require("./routes/playlists");
const userRoutes = require("./routes/users");
const uploadRoutes = require("./routes/upload");
const streamRoutes = require("./routes/stream");
const debugRoutes = require("./routes/debug");
const { requireAuth, requireRole } = require("./middleware/auth");
const {
  requestMetricsMiddleware,
  errorMonitoringMiddleware,
} = require("./middleware/metrics");
const { dbPool } = require("./utils/supabase");

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_ORIGINS = (
  process.env.FRONTEND_URLS ||
  process.env.FRONTEND_URL ||
  ""
)
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

// ── Security middleware ──────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || FRONTEND_ORIGINS.length === 0) {
        return callback(null, true);
      }
      if (FRONTEND_ORIGINS.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS origin denied: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Authorization",
      "Content-Type",
      "Accept",
      "Origin",
      "X-Requested-With",
    ],
    optionsSuccessStatus: 200,
  }),
);

// ── Rate limiting ────────────────────────────────────────────
app.set("trust proxy", 1);
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 150,
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: true,
  message: { error: "Too many requests, please try again later." },
});
app.use("/api/", limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: true,
  message: { error: "Too many auth requests, please try again later." },
});
app.use("/api/auth", authLimiter);

// Stricter limit for upload endpoint
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: true,
  message: { error: "Upload limit reached. Try again in an hour." },
});

// ── Request parsing ──────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(requestMetricsMiddleware);

// ── Health check ─────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

// Health check used by mobile app for connectivity detection
app.get("/api/health", (req, res) => {
  res.status(200).json({ ok: true, timestamp: Date.now() });
});
app.get("/api/v2/health", (req, res) => {
  res.status(200).json({ ok: true, timestamp: Date.now() });
});

// ── Monitoring endpoints ─────────────────────────────────────
app.get("/api/v2/monitor", requireAuth, requireRole("admin"), (req, res) => {
  const { getMonitoringSnapshot } = require("./utils/monitoring");
  res.json({ data: getMonitoringSnapshot() });
});

const mountRoutes = (prefix) => {
  app.use(`${prefix}/auth`, authRoutes);
  app.use(`${prefix}/tracks`, trackRoutes);
  app.use(`${prefix}/artists`, artistRoutes);
  app.use(`${prefix}/albums`, albumRoutes);
  app.use(`${prefix}/playlists`, playlistRoutes);
  app.use(`${prefix}/users`, userRoutes);
  app.use(`${prefix}/upload`, uploadLimiter, uploadRoutes);
  app.use(`${prefix}/stream`, streamRoutes);
  app.use(`${prefix}/debug`, debugRoutes);
};

mountRoutes("/api");
mountRoutes("/api/v2");

if (dbPool) {
  dbPool
    .connect()
    .then((client) => {
      client.release();
      console.info("Database pool established successfully.");
    })
    .catch((err) => {
      console.error("Unable to establish database pool:", err);
    });
}

// ── 404 handler ───────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ── Global error handler ──────────────────────────────────────
app.use(errorMonitoringMiddleware);
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(err.status || 500).json({
    error:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message,
  });
});

// ── Start server ──────────────────────────────────────────────
const startServer = (port, host = "0.0.0.0") => {
  const server = app.listen(port, host, () => {
    const env = process.env.NODE_ENV || "development";
    console.info(`Soundwave API running on ${host}:${port}`);
    console.info(`Environment: ${env}`);
    console.info(`Health check: http://${host}:${port}/health`);
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE" && port === 3000) {
      console.warn(
        `Port ${port} is already in use. Trying port 3001 instead...`,
      );
      startServer(3001, host);
      return;
    }
    console.error("Failed to start server:", err);
    process.exit(1);
  });

  return server;
};

const server = startServer(Number(PORT));
module.exports = { app, server };
