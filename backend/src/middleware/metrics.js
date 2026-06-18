const { recordRequest, recordError } = require("../utils/monitoring");

const requestMetricsMiddleware = (req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const durationMs = Date.now() - start;
    const path = req.originalUrl || req.url || "unknown";
    const method = req.method || "unknown";
    const status = res.statusCode || 0;
    const isAdmin = Boolean(req.isAdmin);

    recordRequest({ path, method, status, durationMs, isAdmin });

    if (durationMs >= 1500) {
      console.warn(
        `Slow request detected: ${method} ${path} took ${durationMs}ms with status ${status}`,
      );
    }

    if (status >= 500) {
      recordError(
        new Error(`Server error response ${status} for ${method} ${path}`),
        req,
      );
    }
  });

  next();
};

const errorMonitoringMiddleware = (err, req, res, next) => {
  recordError(err, req);
  next(err);
};

module.exports = {
  requestMetricsMiddleware,
  errorMonitoringMiddleware,
};
