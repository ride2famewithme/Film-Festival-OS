export interface DbResult<T> {
  data: T | null;
  error: { message: string } | null;
}
export interface QueryBuilder<Row = Record<string, unknown>> extends PromiseLike<DbResult<Row[]>> {
  select(columns?: string): QueryBuilder<Row>;
  insert(rows: Partial<Row> | Partial<Row>[]): QueryBuilder<Row>;
  update(patch: Partial<Row>): QueryBuilder<Row>;
  delete(): QueryBuilder<Row>;
  eq(column: keyof Row & string, value: unknown): QueryBuilder<Row>;
  neq(column: keyof Row & string, value: unknown): QueryBuilder<Row>;
  order(column: keyof Row & string, opts?: { ascending?: boolean }): QueryBuilder<Row>;
  limit(n: number): QueryBuilder<Row>;
  single(): PromiseLike<DbResult<Row>>;
}
export interface AuthUser { id: string; email: string }
export interface AuthSession { user: AuthUser }
export interface AuthClient {
  signUp(creds: { email: string; password: string }): Promise<DbResult<AuthSession>>;
  signInWithPassword(creds: { email: string; password: string }): Promise<DbResult<AuthSession>>;
  signOut(): Promise<DbResult<null>>;
  getSession(): Promise<DbResult<AuthSession>>;
}
export interface DbClient {
  from<Row = Record<string, unknown>>(table: string): QueryBuilder<Row>;
  auth: AuthClient;
}
export type Seed = Record<string, Array<Record<string, unknown>>>;
