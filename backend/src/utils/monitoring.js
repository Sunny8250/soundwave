const MAX_HISTORY = 100;
const startTime = Date.now();

const requestHistory = [];
const errorHistory = [];

const counters = {
  totalRequests: 0,
  totalErrors: 0,
  totalAdminRequests: 0,
  slowRequests: 0,
  statusCodes: {},
};

const recordRequest = ({
  path,
  method,
  status,
  durationMs,
  isAdmin = false,
}) => {
  counters.totalRequests += 1;
  counters.statusCodes[status] = (counters.statusCodes[status] || 0) + 1;
  if (durationMs >= 1000) {
    counters.slowRequests += 1;
  }
  if (isAdmin) {
    counters.totalAdminRequests += 1;
  }

  requestHistory.unshift({
    path,
    method,
    status,
    durationMs,
    isAdmin,
    timestamp: new Date().toISOString(),
  });

  if (requestHistory.length > MAX_HISTORY) {
    requestHistory.pop();
  }
};

const recordError = (error, req = {}) => {
  counters.totalErrors += 1;
  errorHistory.unshift({
    message: error?.message || "Unknown error",
    path: req.originalUrl || req.url || "unknown",
    method: req.method || "unknown",
    status: req.status || null,
    stack: error?.stack || null,
    timestamp: new Date().toISOString(),
  });

  if (errorHistory.length > MAX_HISTORY) {
    errorHistory.pop();
  }
};

const getMonitoringSnapshot = () => {
  const uptimeMs = Date.now() - startTime;
  const averageLatencyMs =
    requestHistory.length > 0
      ? Math.round(
          requestHistory.reduce((sum, item) => sum + item.durationMs, 0) /
            requestHistory.length,
        )
      : 0;

  return {
    serverTime: new Date().toISOString(),
    uptimeSeconds: Math.round(uptimeMs / 1000),
    totalRequests: counters.totalRequests,
    totalErrors: counters.totalErrors,
    totalAdminRequests: counters.totalAdminRequests,
    slowRequests: counters.slowRequests,
    averageLatencyMs,
    statusCodes: counters.statusCodes,
    recentRequests: requestHistory.slice(0, 20),
    recentErrors: errorHistory.slice(0, 20),
    memoryUsage: process.memoryUsage(),
  };
};

module.exports = {
  recordRequest,
  recordError,
  getMonitoringSnapshot,
};
