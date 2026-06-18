const express = require("express");
const router = express.Router();
const os = require("os");

// GET /api/.../debug/network
router.get("/network", async (req, res) => {
  try {
    const ifaces = os.networkInterfaces();

    // Try fetching local and LAN health endpoints using global fetch (Node 18+)
    const tests = {};
    const port = process.env.PORT || 3000;
    const hostLocal = `127.0.0.1:${port}`;
    const lanAddrs = [];
    Object.values(ifaces).forEach((arr) => {
      (arr || []).forEach((it) => {
        if (!it.internal && it.family === "IPv4") lanAddrs.push(it.address);
      });
    });

    try {
      const r = await fetch(`http://${hostLocal}/api/v2/health`, {
        method: "GET",
        timeout: 3000,
      });
      tests.local = { ok: r.ok, status: r.status };
    } catch (err) {
      tests.local = { ok: false, error: String(err) };
    }

    tests.lan = {};
    for (const addr of lanAddrs) {
      try {
        const r = await fetch(`http://${addr}:${port}/api/v2/health`, {
          method: "GET",
          timeout: 3000,
        });
        tests.lan[addr] = { ok: r.ok, status: r.status };
      } catch (err) {
        tests.lan[addr] = { ok: false, error: String(err) };
      }
    }

    res.json({ interfaces: ifaces, tests });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
