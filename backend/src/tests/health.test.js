const request = require("supertest");
const { app, server } = require("../index");

describe("Backend health endpoints", () => {
  it("should return the service health status", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status", "ok");
    expect(res.body).toHaveProperty("version");
  });

  it("should return API health for v2", async () => {
    const res = await request(app).get("/api/v2/health");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("ok", true);
  });

  it("should return 404 for unknown routes", async () => {
    const res = await request(app).get("/api/v2/unknown-route");
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error", "Route not found");
  });

  afterAll(async () => {
    if (server && typeof server.close === "function") {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
