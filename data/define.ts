// Data contract — single source the app authors at /data/schema.ts.
export type FieldType = 'uuid' | 'text' | 'int' | 'float' | 'number' | 'bool' | 'timestamp' | 'json';

export interface Field {
  type: FieldType;
  pk?: boolean;
  required?: boolean;
  unique?: boolean;
  ref?: string;
  owner?: boolean;
}
export interface Table {
  fields: Record<string, Field>;
  owned: boolean;
  seed: Array<Record<string, unknown>>;
}
export type Schema = Record<string, Table>;

export function defineSchema<S extends Schema>(schema: S): S {
  return schema;
}

interface TsMap {
  uuid: string; text: string; int: number; float: number; number: number;
  bool: boolean; timestamp: string; json: Record<string, unknown>;
}
type RequiredCols<F extends Record<string, Field>> = {
  [K in keyof F]: F[K] extends { required: true } | { pk: true } ? K : never;
}[keyof F];

export type InferRow<S extends Schema, K extends keyof S> =
  { [C in RequiredCols<S[K]['fields']>]: TsMap[S[K]['fields'][C]['type']] } &
  { [C in Exclude<keyof S[K]['fields'], RequiredCols<S[K]['fields']>>]?: TsMap[S[K]['fields'][C]['type']] };

export function seedFromSchema(schema: Schema): Record<string, Array<Record<string, unknown>>> {
  const out: Record<string, Array<Record<string, unknown>>> = {};
  for (const [table, def] of Object.entries(schema)) out[table] = def.seed;
  return out;
}
