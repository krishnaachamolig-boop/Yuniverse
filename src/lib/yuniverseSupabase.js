import { createClient } from "@supabase/supabase-js";

const yuniverseUrl = import.meta.env.VITE_YUNIVERSE_SUPABASE_URL;

const yuniverseKey = import.meta.env.VITE_YUNIVERSE_SUPABASE_PUBLISHABLE_KEY;

if (!yuniverseUrl) {
  throw new Error("VITE_YUNIVERSE_SUPABASE_URL is missing in .env");
}

if (!yuniverseKey) {
  throw new Error("VITE_YUNIVERSE_SUPABASE_PUBLISHABLE_KEY is missing in .env");
}

export const yuniverseSupabase = createClient(yuniverseUrl, yuniverseKey);
