import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let sharedSupabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) return null;

  if (!sharedSupabaseClient) {
    sharedSupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  return sharedSupabaseClient;
}

export function requireSupabaseClient(): SupabaseClient {
  const client = getSupabaseClient();

  if (!client) {
    throw new Error(
      'Supabase environment variables are required when EXPO_PUBLIC_ADAPTER=supabase'
    );
  }

  return client;
}
