import { Postgres } from "../postgres";
import pool from "../postgresClient";
import { FlashcastrFlash } from "./types";

export class PostgresFlashcastrFlashes extends Postgres<FlashcastrFlash> {
  constructor() {
    super(pool);
  }

  public async deleteManyByFid(fid: number): Promise<FlashcastrFlash[]> {
    const sql = `UPDATE flashcastr_flashes SET deleted = true WHERE user_fid = $1 RETURNING *`;
    return await this.query(sql, [fid]);
  }

  public async insertMany(flashes: FlashcastrFlash[]): Promise<FlashcastrFlash[]> {
    if (!flashes.length) return [];

    const columns = ["flash_id", "user_fid", "user_username", "user_pfp_url", "cast_hash", "deleted"];
    const values: any[] = [];
    const valuePlaceholders = flashes.map((f, i) => {
      const offset = i * columns.length;
      values.push(f.flash_id, f.user_fid, f.user_username, f.user_pfp_url, f.cast_hash, false);
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6})`;
    });

    const sql = `
      INSERT INTO flashcastr_flashes (${columns.join(", ")})
      VALUES ${valuePlaceholders.join(", ")}
      ON CONFLICT (flash_id) DO UPDATE SET
        deleted = false,
        user_fid = EXCLUDED.user_fid,
        user_username = EXCLUDED.user_username,
        user_pfp_url = EXCLUDED.user_pfp_url,
        cast_hash = EXCLUDED.cast_hash
      RETURNING *
    `;

    return await this.query(sql, values);
  }
}
