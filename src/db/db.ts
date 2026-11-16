export type SqlValue = string | number | null;

/** Минимум от базы, нужный хранилищам. Ему соответствует SQLiteDatabase из expo-sqlite. */
export interface Db {
  runAsync(source: string, params: SqlValue[]): Promise<unknown>;
  getAllAsync<T>(source: string, params: SqlValue[]): Promise<T[]>;
  getFirstAsync<T>(source: string, params: SqlValue[]): Promise<T | null>;
}
