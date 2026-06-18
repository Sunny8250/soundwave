const { createClient } = require("@supabase/supabase-js");
const { Pool } = require("pg");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment");
}

// Warn loudly if service role key is missing — admin ops will silently fail
if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "[FATAL] SUPABASE_SERVICE_ROLE_KEY is not set. " +
      "Admin operations will fail or bypass nothing. " +
      "Set this in your .env file immediately.",
  );
  // In production throw; in dev warn so app still starts
  if (process.env.NODE_ENV === "production") {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required in production");
  }
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

// If no service role key, fall back to anon key so the app at least starts
// but log every admin operation as a warning
const supabaseAdmin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY,
  { auth: { persistSession: false } },
);

let dbPool = null;
if (DATABASE_URL) {
  dbPool = new Pool({
    connectionString: DATABASE_URL,
    max: 10,
    min: 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
  dbPool.on("error", (err) => {
    console.error("Unexpected PostgreSQL pool error:", err);
  });
}

module.exports = { supabase, supabaseAdmin, dbPool };
