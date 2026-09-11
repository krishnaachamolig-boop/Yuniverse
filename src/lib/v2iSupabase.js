import { createClient } from "@supabase/supabase-js";

export const v2iSupabase = createClient(
  import.meta.env.VITE_V2I_SUPABASE_URL,
  import.meta.env.VITE_V2I_SUPABASE_PUBLISHABLE_KEY
);
