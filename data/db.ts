// The single data surface every screen imports: `import { db } from '@/data/db'`.
// Backend swaps via EXPO_PUBLIC_ADAPTER (mock | supabase) with no screen changes.
import schema from './schema';
import { createDb } from './adapters';
import { seedFromSchema } from './define';

export const db = createDb(seedFromSchema(schema));
export type { InferRow } from './define';
