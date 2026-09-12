import { createClient } from "@supabase/supabase-js";

const DEFAULT_YUNIVERSE_URL = "https://mkettxxokdfegnrrdwrc.supabase.co";
const DEFAULT_YUNIVERSE_KEY = "sb_publishable_KfkNRmwgwJmpSstUrJzSqg_Qs9cDFVA";

const yuniverseUrl =
  import.meta.env.VITE_YUNIVERSE_SUPABASE_URL || DEFAULT_YUNIVERSE_URL;

const yuniverseKey =
  import.meta.env.VITE_YUNIVERSE_SUPABASE_PUBLISHABLE_KEY || DEFAULT_YUNIVERSE_KEY;

export const isYuniverseConfigured = Boolean(yuniverseUrl && yuniverseKey);

export const yuniverseSupabase = createClient(
  yuniverseUrl || DEFAULT_YUNIVERSE_URL,
  yuniverseKey || DEFAULT_YUNIVERSE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  }
);

