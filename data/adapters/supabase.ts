import type { SupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseClient } from '../supabase-client';
import type { AuthClient, AuthSession, DbClient, DbResult, QueryBuilder } from './types';

type Row = Record<string, unknown>;

function env(name: 'EXPO_PUBLIC_SUPABASE_URL' | 'EXPO_PUBLIC_SUPABASE_ANON_KEY'): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required when EXPO_PUBLIC_ADAPTER=supabase`);
  return value;
}

function mapError(error: { message: string } | null | undefined) {
  return error ? { message: error.message } : null;
}

function mapSession(user: { id: string; email?: string | null } | null): AuthSession | null {
  if (!user || !user.email) return null;
  return { user: { id: user.id, email: user.email } };
}

class SupabaseQuery implements QueryBuilder<Row> {
  private builder: any;
  constructor(private client: SupabaseClient, private table: string) {
    this.builder = client.from(table).select('*');
  }
  select(columns = '*') { this.builder = this.client.from(this.table).select(columns); return this; }
  insert(rows: Partial<Row> | Partial<Row>[]) { this.builder = this.client.from(this.table).insert(rows).select('*'); return this; }
  update(patch: Partial<Row>) { this.builder = this.client.from(this.table).update(patch).select('*'); return this; }
  delete() { this.builder = this.client.from(this.table).delete().select('*'); return this; }
  eq(col: string, val: unknown) { this.builder = this.builder.eq(col, val); return this; }
  neq(col: string, val: unknown) { this.builder = this.builder.neq(col, val); return this; }
  order(col: string, opts?: { ascending?: boolean }) { this.builder = this.builder.order(col, { ascending: opts?.ascending ?? true }); return this; }
  limit(n: number) { this.builder = this.builder.limit(n); return this; }
  async single(): Promise<DbResult<Row>> {
    const { data, error } = await this.builder.maybeSingle();
    return { data: data ?? null, error: mapError(error) };
  }
  then<R1 = DbResult<Row[]>, R2 = never>(
    onfulfilled?: ((v: DbResult<Row[]>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return Promise.resolve(this.builder).then(({ data, error }: any) => ({ data: data ?? [], error: mapError(error) })).then(onfulfilled, onrejected);
  }
}

function authAdapter(client: SupabaseClient): AuthClient {
  return {
    async signUp({ email, password }) {
      const { data, error } = await client.auth.signUp({ email, password });
      return { data: mapSession(data.user), error: mapError(error) } as DbResult<AuthSession>;
    },
    async signInWithPassword({ email, password }) {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      return { data: mapSession(data.user), error: mapError(error) } as DbResult<AuthSession>;
    },
    async signOut() {
      const { error } = await client.auth.signOut();
      return { data: null, error: mapError(error) };
    },
    async getSession() {
      const { data, error } = await client.auth.getSession();
      return { data: mapSession(data.session?.user ?? null), error: mapError(error) } as DbResult<AuthSession>;
    },
  };
}

export function supabaseAdapter(): DbClient {
  const client = requireSupabaseClient();
  return {
    from<R = Row>(table: string) { return new SupabaseQuery(client, table) as unknown as QueryBuilder<R>; },
    auth: authAdapter(client),
  };
}
