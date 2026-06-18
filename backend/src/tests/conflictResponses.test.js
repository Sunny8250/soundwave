const request = require("supertest");

// Mock auth middleware to inject a test user
jest.mock("../middleware/auth", () => ({
  requireAuth: (req, res, next) => {
    req.userId = "test-user-id";
    req.isAdmin = true;
    req.adminRole = "super_admin";
    next();
  },
  requireRole: () => (req, res, next) => next(),
  requireMinRole: () => (req, res, next) => next(),
}));

// Mock supabase Admin client
const mockFrom = (table) => {
  return {
    update: (updates) => ({
      eq: (col, val) => ({
        select: () => ({
          single: async () => {
            // Simulate unique constraint violation for test cases
            return {
              data: null,
              error: { code: "23505", message: "unique violation" },
            };
          },
        }),
      }),
    }),
    select: () => ({
      single: async () => ({
        data: { id: "test", username: "server" },
        error: null,
      }),
    }),
  };
};

jest.mock("../utils/supabase", () => ({
  supabaseAdmin: {
    from: (table) => mockFrom(table),
  },
}));

const { app, server } = require("../index");

afterAll((done) => {
  if (server && server.close) server.close(done);
  else done();
});

describe("Conflict response shape", () => {
  test("PATCH /api/auth/me returns 409 with serverState on unique violation", async () => {
    const res = await request(app)
      .patch("/api/auth/me")
      .send({ username: "existing" })
      .set("Accept", "application/json");

    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty("serverState");
    expect(res.body.code).toBe("CONFLICT");
  });

  test("PATCH /api/tracks/:id returns 409 with serverState on unique violation", async () => {
    const res = await request(app)
      .patch("/api/tracks/00000000-0000-0000-0000-000000000000")
      .send({ title: "Existing Title" })
      .set("Accept", "application/json");

    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty("serverState");
    expect(res.body.code).toBe("CONFLICT");
  });
});
