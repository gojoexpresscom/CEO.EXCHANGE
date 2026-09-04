import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl) {
  console.warn("Missing VITE_SUPABASE_URL");
}

if (!supabaseAnonKey) {
  console.warn("Missing VITE_SUPABASE_ANON_KEY");
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key",
  {
    auth: {
      experimental: {
        passkey: true
      }
    }
  }
);
