import type { DbClient, Seed } from './types';
import { mockAdapter } from './mock';
import { supabaseAdapter } from './supabase';

export type { DbClient } from './types';

export function createDb(seed: Seed): DbClient {
  const adapter = process.env.EXPO_PUBLIC_ADAPTER ?? 'mock';
  if (adapter === 'supabase') return supabaseAdapter();
  if (adapter !== 'mock') throw new Error(`Unsupported EXPO_PUBLIC_ADAPTER: ${adapter}`);
  return mockAdapter(seed);
}
