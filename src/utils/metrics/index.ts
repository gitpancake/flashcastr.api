import http from "http";
import {
  Registry,
  Counter,
  Gauge,
  Histogram,
  collectDefaultMetrics,
} from "prom-client";

// Create a new registry
export const register = new Registry();

// Collect default Node.js metrics (CPU, memory, event loop, etc.)
collectDefaultMetrics({ register });

// ============================================
// COUNTERS
// ============================================

export const graphqlRequestsTotal = new Counter({
  name: "flashcastr_api_graphql_requests_total",
  help: "Total GraphQL requests",
  labelNames: ["operation_type", "operation_name"],
  registers: [register],
});

export const graphqlErrorsTotal = new Counter({
  name: "flashcastr_api_graphql_errors_total",
  help: "Total GraphQL errors",
  labelNames: ["operation_type", "operation_name"],
  registers: [register],
});

export const signupsInitiatedTotal = new Counter({
  name: "flashcastr_api_signups_initiated_total",
  help: "Total user signups initiated",
  registers: [register],
});

export const signupsCompletedTotal = new Counter({
  name: "flashcastr_api_signups_completed_total",
  help: "Total user signups completed successfully",
  registers: [register],
});

export const usersDeletedTotal = new Counter({
  name: "flashcastr_api_users_deleted_total",
  help: "Total users deleted",
  registers: [register],
});

export const cacheHitsTotal = new Counter({
  name: "flashcastr_api_cache_hits_total",
  help: "Cache hits",
  labelNames: ["cache_name"],
  registers: [register],
});

export const cacheMissesTotal = new Counter({
  name: "flashcastr_api_cache_misses_total",
  help: "Cache misses",
  labelNames: ["cache_name"],
  registers: [register],
});

export const neynarRequestsTotal = new Counter({
  name: "flashcastr_api_neynar_requests_total",
  help: "Requests to Neynar API",
  labelNames: ["endpoint", "status"],
  registers: [register],
});

export const databaseQueriesTotal = new Counter({
  name: "flashcastr_api_database_queries_total",
  help: "Total database queries executed",
  labelNames: ["query_type"],
  registers: [register],
});

// ============================================
// GAUGES
// ============================================

export const activeUsersTotal = new Gauge({
  name: "flashcastr_api_active_users_total",
  help: "Total active (non-deleted) users",
  registers: [register],
});

export const totalFlashesCount = new Gauge({
  name: "flashcastr_api_total_flashes",
  help: "Total flashes in database",
  registers: [register],
});

export const uptimeSeconds = new Gauge({
  name: "flashcastr_api_uptime_seconds",
  help: "Process uptime in seconds",
  registers: [register],
});

export const memoryBytes = new Gauge({
  name: "flashcastr_api_memory_bytes",
  help: "Memory usage in bytes",
  labelNames: ["type"],
  registers: [register],
});

// ============================================
// HISTOGRAMS
// ============================================

export const graphqlDurationSeconds = new Histogram({
  name: "flashcastr_api_graphql_duration_seconds",
  help: "Duration of GraphQL operations in seconds",
  labelNames: ["operation_type", "operation_name"],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

export const databaseQueryDurationSeconds = new Histogram({
  name: "flashcastr_api_database_query_duration_seconds",
  help: "Duration of database queries in seconds",
  labelNames: ["query_type"],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [register],
});

// ============================================
// METRICS SERVER
// ============================================

const startTime = Date.now();

// Update uptime and memory gauges periodically
setInterval(() => {
  uptimeSeconds.set((Date.now() - startTime) / 1000);

  const mem = process.memoryUsage();
  memoryBytes.set({ type: "heap_used" }, mem.heapUsed);
  memoryBytes.set({ type: "heap_total" }, mem.heapTotal);
  memoryBytes.set({ type: "rss" }, mem.rss);
  memoryBytes.set({ type: "external" }, mem.external);
}, 5000);

export function startMetricsServer(port: number = 9092): void {
  const server = http.createServer(async (req, res) => {
    const url = req.url?.split("?")[0] || "";
    if (url === "/metrics" || url === "/") {
      try {
        res.setHeader("Content-Type", register.contentType);
        res.end(await register.metrics());
      } catch (err) {
        res.statusCode = 500;
        res.end("Error collecting metrics");
      }
    } else if (url === "/health") {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ status: "ok" }));
    } else {
      res.statusCode = 404;
      res.end("Not found");
    }
  });

  server.listen(port, () => {
    console.log(`[Metrics] Prometheus metrics available at http://localhost:${port}/metrics`);
  });
}
