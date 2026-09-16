// Read hooks — the only data API a screen needs. See /data/db for the adapter.
import { useQuery } from '@tanstack/react-query';
import schema from './schema';
import { db } from './db';
import { seedFromSchema } from './define';

// Detail-screen fallback: match by id (string-coerced), else first row. A detail
// screen is also mounted param-less as its own preview tile, so it MUST resolve an
// item rather than blank/crash. Mirror of lib/data-contract/hooks.ts (keep in sync).
function selectRow(list: any[], id: string | number | null | undefined) {
  if (!list || list.length === 0) return null;
  if (id != null) {
    const hit = list.find((r) => String(r.id) === String(id));
    if (hit) return hit;
  }
  return list[0];
}

/** All rows of a table. Seeded data shows on first render; real backend refetches. */
export function useTable(table: string) {
  const seed = seedFromSchema(schema)[table] ?? [];
  const { data } = useQuery({
    queryKey: ['data', table],
    queryFn: async () => {
      const res = await db.from(table).select();
      if (res.error) throw new Error(res.error.message);
      return res.data ?? [];
    },
    initialData: seed,
    initialDataUpdatedAt: 0,
  });
  return data ?? [];
}

/** One row by id, with a guaranteed fallback (first row) for param-less previews. */
export function useRow(table: string, id: string | number | null | undefined) {
  return selectRow(useTable(table), id);
}
