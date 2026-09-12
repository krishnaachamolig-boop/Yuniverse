import { createClient } from "@supabase/supabase-js";

const DEFAULT_V2I_URL = "https://kzfxybtibfogoioyvvci.supabase.co";
const DEFAULT_V2I_KEY = "sb_publishable_T4DuuQXnTHmL1NO3PcMG3w_EmDjt52Q";

const v2iUrl = import.meta.env.VITE_V2I_SUPABASE_URL || DEFAULT_V2I_URL;
const v2iKey = import.meta.env.VITE_V2I_SUPABASE_PUBLISHABLE_KEY || DEFAULT_V2I_KEY;

export const isV2iConfigured = Boolean(v2iUrl && v2iKey);

export const v2iSupabase = createClient(
  v2iUrl || DEFAULT_V2I_URL,
  v2iKey || DEFAULT_V2I_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  }
);

