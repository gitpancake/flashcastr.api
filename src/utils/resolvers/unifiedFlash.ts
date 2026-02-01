import { GraphQLError } from "graphql";
import pool from "../database/postgresClient";

export interface UnifiedFlashResult {
  flash_id: string;
  city: string | null;
  player: string | null;
  img: string | null;
  ipfs_cid: string | null;
  text: string | null;
  timestamp: string | null;
  flash_count: string | null;
  farcaster_user: {
    fid: number;
    username: string | null;
    pfp_url: string | null;
    cast_hash: string | null;
  } | null;
  identification: {
    id: number;
    matched_flash_id: string;
    matched_flash_name: string | null;
    similarity: number;
    confidence: number;
  } | null;
}

export const unifiedFlashResolver = async (
  _: any,
  args: { flash_id: string }
): Promise<UnifiedFlashResult | null> => {
  try {
    const query = `
      SELECT
        f.flash_id::text as flash_id,
        f.city,
        f.player,
        f.img,
        f.ipfs_cid,
        f.text,
        f.timestamp::text as timestamp,
        f.flash_count,
        ff.user_fid as farcaster_fid,
        ff.user_username as farcaster_username,
        ff.user_pfp_url as farcaster_pfp_url,
        ff.cast_hash as farcaster_cast_hash,
        fi.id as identification_id,
        fi.matched_flash_id::text as identification_matched_flash_id,
        fi.matched_flash_name as identification_matched_flash_name,
        fi.similarity as identification_similarity,
        fi.confidence as identification_confidence
      FROM flashes f
      LEFT JOIN flashcastr_flashes ff ON f.flash_id = ff.flash_id AND ff.deleted = false
      LEFT JOIN flash_identifications fi ON f.ipfs_cid = fi.source_ipfs_cid
      WHERE f.flash_id = $1
    `;

    const result = await pool.query(query, [args.flash_id]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];

    return {
      flash_id: row.flash_id,
      city: row.city,
      player: row.player,
      img: row.img,
      ipfs_cid: row.ipfs_cid,
      text: row.text,
      timestamp: row.timestamp,
      flash_count: row.flash_count,
      farcaster_user: row.farcaster_fid
        ? {
            fid: row.farcaster_fid,
            username: row.farcaster_username,
            pfp_url: row.farcaster_pfp_url,
            cast_hash: row.farcaster_cast_hash,
          }
        : null,
      identification: row.identification_id
        ? {
            id: row.identification_id,
            matched_flash_id: row.identification_matched_flash_id,
            matched_flash_name: row.identification_matched_flash_name,
            similarity: row.identification_similarity,
            confidence: row.identification_confidence,
          }
        : null,
    };
  } catch (error) {
    console.error("[GraphQL unifiedFlash] Error:", error);
    throw new GraphQLError("Failed to fetch unified flash.", {
      extensions: { code: "DATABASE_ERROR" },
    });
  }
};

export const unifiedFlashesResolver = async (
  _: any,
  args: { page?: number; limit?: number; city?: string; player?: string }
): Promise<UnifiedFlashResult[]> => {
  const { page = 1, limit = 20 } = args;
  const validatedPage = Math.max(1, page);
  const offset = (validatedPage - 1) * limit;

  try {
    let whereClause = "WHERE 1=1";
    const params: any[] = [];
    let paramIndex = 1;

    if (args.city) {
      whereClause += ` AND LOWER(f.city) = LOWER($${paramIndex++})`;
      params.push(args.city);
    }

    if (args.player) {
      whereClause += ` AND LOWER(f.player) = LOWER($${paramIndex++})`;
      params.push(args.player);
    }

    params.push(limit, offset);

    const query = `
      SELECT
        f.flash_id::text as flash_id,
        f.city,
        f.player,
        f.img,
        f.ipfs_cid,
        f.text,
        f.timestamp::text as timestamp,
        f.flash_count,
        ff.user_fid as farcaster_fid,
        ff.user_username as farcaster_username,
        ff.user_pfp_url as farcaster_pfp_url,
        ff.cast_hash as farcaster_cast_hash,
        fi.id as identification_id,
        fi.matched_flash_id::text as identification_matched_flash_id,
        fi.matched_flash_name as identification_matched_flash_name,
        fi.similarity as identification_similarity,
        fi.confidence as identification_confidence
      FROM flashes f
      LEFT JOIN flashcastr_flashes ff ON f.flash_id = ff.flash_id AND ff.deleted = false
      LEFT JOIN flash_identifications fi ON f.ipfs_cid = fi.source_ipfs_cid
      ${whereClause}
      ORDER BY f.timestamp DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;

    const result = await pool.query(query, params);

    return result.rows.map((row: any) => ({
      flash_id: row.flash_id,
      city: row.city,
      player: row.player,
      img: row.img,
      ipfs_cid: row.ipfs_cid,
      text: row.text,
      timestamp: row.timestamp,
      flash_count: row.flash_count,
      farcaster_user: row.farcaster_fid
        ? {
            fid: row.farcaster_fid,
            username: row.farcaster_username,
            pfp_url: row.farcaster_pfp_url,
            cast_hash: row.farcaster_cast_hash,
          }
        : null,
      identification: row.identification_id
        ? {
            id: row.identification_id,
            matched_flash_id: row.identification_matched_flash_id,
            matched_flash_name: row.identification_matched_flash_name,
            similarity: row.identification_similarity,
            confidence: row.identification_confidence,
          }
        : null,
    }));
  } catch (error) {
    console.error("[GraphQL unifiedFlashes] Error:", error);
    throw new GraphQLError("Failed to fetch unified flashes.", {
      extensions: { code: "DATABASE_ERROR" },
    });
  }
};
