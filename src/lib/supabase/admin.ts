import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl() && supabaseServiceRoleKey());
}

export function getSupabaseAdmin() {
  const url = supabaseUrl();
  const key = supabaseServiceRoleKey();
  if (!url || !key) {
    throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  }
  if (!client) {
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

function supabaseUrl() {
  return process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
}

function supabaseServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY;
}
