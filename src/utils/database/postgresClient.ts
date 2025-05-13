// lib/postgresClient.ts
import { config } from "dotenv";
import { Pool } from "pg";

config({ path: ".env" });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not defined");

declare global {
  var _pgPool: Pool | undefined;
}

const pool = global._pgPool ?? new Pool({ connectionString });

if (process.env.NODE_ENV !== "production") {
  global._pgPool = pool;
}

export default pool;
