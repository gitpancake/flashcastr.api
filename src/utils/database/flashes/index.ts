import { Flash } from "../../api.invaders.fun/flashes";
import { Postgres } from "../postgres";
import pool from "../postgresClient";

export class PostgresFlashes extends Postgres<Flash> {
  constructor() {
    super(pool);
  }

  public async getAllPlayers(username?: string): Promise<string[]> {
    let sqlQuery = "SELECT DISTINCT player FROM flashes WHERE player IS NOT NULL";
    const queryParams: string[] = [];

    if (username) {
      sqlQuery += " AND LOWER(player) = LOWER($1)";
      queryParams.push(username);
    }
    sqlQuery += " ORDER BY player;";

    try {
      const result = await this.query<{ player: string }>(sqlQuery, queryParams);
      return result.map((row) => row.player).filter(Boolean);
    } catch (error) {
      console.error("Error fetching all players:", error);
      throw new Error("Failed to fetch player names from database");
    }
  }
}
