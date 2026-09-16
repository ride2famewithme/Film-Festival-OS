import type { AuthClient, AuthSession, DbClient, DbResult, QueryBuilder, Seed } from './types';

type Row = Record<string, unknown>;
let _seq = 0;
function uid(): string { _seq += 1; return 'mock_' + _seq.toString(36); }
const ok = <T,>(data: T): DbResult<T> => ({ data, error: null });

class MockQuery implements QueryBuilder<Row> {
  private op: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private filters: Array<{ col: string; val: unknown; neg: boolean }> = [];
  private sort?: { col: string; asc: boolean };
  private cap?: number;
  private payload: Row[] = [];
  constructor(private store: Row[]) {}
  select() { this.op = 'select'; return this; }
  insert(rows: Partial<Row> | Partial<Row>[]) {
    this.op = 'insert';
    this.payload = (Array.isArray(rows) ? rows : [rows]) as Row[];
    return this;
  }
  update(patch: Partial<Row>) { this.op = 'update'; this.payload = [patch as Row]; return this; }
  delete() { this.op = 'delete'; return this; }
  eq(col: string, val: unknown) { this.filters.push({ col, val, neg: false }); return this; }
  neq(col: string, val: unknown) { this.filters.push({ col, val, neg: true }); return this; }
  order(col: string, opts?: { ascending?: boolean }) { this.sort = { col, asc: opts?.ascending ?? true }; return this; }
  limit(n: number) { this.cap = n; return this; }
  private match(r: Row): boolean {
    return this.filters.every((f) => (f.neg ? r[f.col] !== f.val : r[f.col] === f.val));
  }
  private run(): Row[] {
    switch (this.op) {
      case 'insert': {
        const created = this.payload.map((r) => ({ id: r.id ?? uid(), ...r }));
        this.store.push(...created);
        return created;
      }
      case 'update': {
        const hit = this.store.filter((r) => this.match(r));
        hit.forEach((r) => Object.assign(r, this.payload[0]));
        return hit;
      }
      case 'delete': {
        const keep: Row[] = []; const removed: Row[] = [];
        for (const r of this.store) (this.match(r) ? removed : keep).push(r);
        this.store.length = 0; this.store.push(...keep);
        return removed;
      }
      default: {
        let rows = this.store.filter((r) => this.match(r));
        if (this.sort) {
          const { col, asc } = this.sort;
          rows = [...rows].sort((a, b) => (a[col] === b[col] ? 0 : (a[col]! > b[col]! ? 1 : -1) * (asc ? 1 : -1)));
        }
        if (this.cap != null) rows = rows.slice(0, this.cap);
        return rows;
      }
    }
  }
  single() { return Promise.resolve(ok(this.run()[0] ?? null) as DbResult<Row>); }
  then<R1 = DbResult<Row[]>, R2 = never>(
    onfulfilled?: ((v: DbResult<Row[]>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return Promise.resolve(ok(this.run())).then(onfulfilled, onrejected);
  }
}

function mockAuth(): AuthClient {
  const demo = (email: string): AuthSession => ({ user: { id: 'demo_user', email } });
  // Designer mode starts SIGNED IN: the preview canvas mounts every screen of an
  // auth-gated app without hitting the sign-in wall, and useAuth().user.id is
  // always available for owned-table writes. signOut still demos the gate.
  let session: AuthSession | null = demo('demo@example.com');
  return {
    async signUp({ email }) { session = demo(email); return ok(session); },
    async signInWithPassword({ email }) { session = demo(email); return ok(session); },
    async signOut() { session = null; return ok(null); },
    async getSession() { return ok(session) as DbResult<AuthSession>; },
  };
}

export function mockAdapter(seed: Seed): DbClient {
  const tables: Record<string, Row[]> = {};
  for (const [name, rows] of Object.entries(seed)) tables[name] = rows.map((r) => ({ ...r }));
  const auth = mockAuth();
  return {
    from<R = Row>(table: string) {
      if (!tables[table]) tables[table] = [];
      return new MockQuery(tables[table]) as unknown as QueryBuilder<R>;
    },
    auth,
  };
}
