// lib/postgres.ts
import { Pool } from "pg";

export abstract class Postgres<T = unknown> {
  constructor(protected pool: Pool) {}

  protected async query<R = T>(sql: string, values: any[] = []): Promise<R[]> {
    const res = await this.pool.query(sql, values);
    return res.rows;
  }

  protected async queryOne<R = T>(sql: string, values: any[] = []): Promise<R | null> {
    const res = await this.pool.query(sql, values);
    return res.rows[0] ?? null;
  }
}
