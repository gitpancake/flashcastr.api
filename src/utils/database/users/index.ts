import { Postgres } from "../postgres";
import pool from "../postgresClient";
import { User } from "./types";

export class PostgresFlashcastrUsers extends Postgres<User> {
  constructor() {
    super(pool);
  }

  public async insert(user: User): Promise<number> {
    const sql = `
      INSERT INTO flashcastr_users (fid, username, signer_uuid, auto_cast)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (fid) DO NOTHING
      RETURNING fid
    `;

    const values = [user.fid, user.username, user.signer_uuid, user.auto_cast];

    const result = await this.query(sql, values);

    if (result.length === 0) {
      throw new Error("Failed to insert user or user already exists");
    }

    return result[0].fid;
  }

  public async updateAutocast(fid: number, auto_cast: boolean): Promise<void> {
    const sql = `
      UPDATE flashcastr_users
      SET auto_cast = $1
      WHERE fid = $2
      RETURNING fid
    `;

    const result = await this.query(sql, [auto_cast, fid]);

    if (result.length === 0) {
      throw new Error("No user found with the provided fid");
    }
  }

  public async deleteByFid(fid: number): Promise<void> {
    const sql = `
      DELETE FROM flashcastr_users
      WHERE fid = $1
    `;

    const result = await this.query(sql, [fid]);

    if (result.length === 0) {
      throw new Error("No user found with the provided fid");
    }
  }
}
