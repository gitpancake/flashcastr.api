import { GraphQLError } from "graphql";
import pool from "../database/postgresClient";

export const flashIdentificationsResolver = async (
  _: any,
  args: { ipfs_cid?: string; matched_flash_id?: string; limit?: number }
) => {
  const { limit = 50 } = args;
  try {
    let query = `
      SELECT 
        fi.id,
        fi.source_ipfs_cid,
        fi.matched_flash_id::text as matched_flash_id,
        fi.matched_flash_name,
        fi.similarity,
        fi.confidence,
        fi.created_at::text as created_at,
        f.flash_id::text as flash_id,
        f.city,
        f.player,
        f.img,
        f.ipfs_cid as flash_ipfs_cid,
        f.text,
        f.timestamp::text as flash_timestamp,
        f.flash_count
      FROM flash_identifications fi
      LEFT JOIN flashes f ON fi.matched_flash_id = f.flash_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (args.ipfs_cid) {
      query += ` AND fi.source_ipfs_cid = $${paramIndex++}`;
      params.push(args.ipfs_cid);
    }
    if (args.matched_flash_id) {
      query += ` AND fi.matched_flash_id = $${paramIndex++}`;
      params.push(args.matched_flash_id);
    }
    query += ` ORDER BY fi.created_at DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const result = await pool.query(query, params);
    return result.rows.map((row: any) => ({
      id: row.id,
      source_ipfs_cid: row.source_ipfs_cid,
      matched_flash_id: row.matched_flash_id,
      matched_flash_name: row.matched_flash_name,
      similarity: row.similarity,
      confidence: row.confidence,
      created_at: row.created_at,
      matched_flash: row.flash_id
        ? {
            flash_id: row.flash_id,
            city: row.city,
            player: row.player,
            img: row.img,
            ipfs_cid: row.flash_ipfs_cid,
            text: row.text,
            timestamp: row.flash_timestamp,
            flash_count: row.flash_count,
          }
        : null,
    }));
  } catch (error) {
    console.error("[GraphQL flashIdentifications] Error:", error);
    throw new GraphQLError("Failed to fetch flash identifications.", {
      extensions: { code: "DATABASE_ERROR" },
    });
  }
};

export const flashIdentificationResolver = async (
  _: any,
  args: { id: number }
) => {
  try {
    const result = await pool.query(
      `SELECT 
        fi.id,
        fi.source_ipfs_cid,
        fi.matched_flash_id::text as matched_flash_id,
        fi.matched_flash_name,
        fi.similarity,
        fi.confidence,
        fi.created_at::text as created_at,
        f.flash_id::text as flash_id,
        f.city,
        f.player,
        f.img,
        f.ipfs_cid as flash_ipfs_cid,
        f.text,
        f.timestamp::text as flash_timestamp,
        f.flash_count
      FROM flash_identifications fi
      LEFT JOIN flashes f ON fi.matched_flash_id = f.flash_id
      WHERE fi.id = $1`,
      [args.id]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      source_ipfs_cid: row.source_ipfs_cid,
      matched_flash_id: row.matched_flash_id,
      matched_flash_name: row.matched_flash_name,
      similarity: row.similarity,
      confidence: row.confidence,
      created_at: row.created_at,
      matched_flash: row.flash_id
        ? {
            flash_id: row.flash_id,
            city: row.city,
            player: row.player,
            img: row.img,
            ipfs_cid: row.flash_ipfs_cid,
            text: row.text,
            timestamp: row.flash_timestamp,
            flash_count: row.flash_count,
          }
        : null,
    };
  } catch (error) {
    console.error("[GraphQL flashIdentification] Error:", error);
    throw new GraphQLError("Failed to fetch flash identification.", {
      extensions: { code: "DATABASE_ERROR" },
    });
  }
};
