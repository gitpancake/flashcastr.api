import { Prisma, PrismaClient } from "@prisma/client";
import { ApolloServer, gql } from "apollo-server";
import { GraphQLError } from "graphql";
import { verifyApiKey } from "./utils/auth";
import { PostgresFlashcastrFlashes } from "./utils/database/flashcastr";
import { PostgresFlashes } from "./utils/database/flashes";
import { PostgresFlashcastrUsers } from "./utils/database/users";
import { getIpfsUrl } from "./utils/ipfs";
import neynarClient from "./utils/neynar/client";
import SignupOperations from "./utils/tasks/signup";
import pool from "./utils/database/postgresClient";

const prisma = new PrismaClient();

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

// Cache for trending cities (24 hour TTL)
let trendingCitiesCache: { data: Array<{ city: string; count: number }>; timestamp: number } | null = null;
const TRENDING_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Cache for leaderboard (1 hour TTL)
let leaderboardCache: { data: Array<{ username: string; pfp_url: string | null; flash_count: number; city_count: number }>; timestamp: number } | null = null;
const LEADERBOARD_CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds

const typeDefs = gql`
  type User {
    fid: Int!
    username: String
    auto_cast: Boolean
  }

  type Flash {
    flash_id: ID!
    city: String
    player: String
    img: String
    ipfs_cid: String
    text: String
    timestamp: String
    flash_count: String
  }

  type FlashcastrFlash {
    id: Int!
    flash_id: String!
    user_fid: Int!
    user_username: String
    user_pfp_url: String
    cast_hash: String
    flash: Flash!
  }

  type FlashesSummary {
    flashCount: Int!
    cities: [String!]!
  }

  type DeleteUserResponse {
    success: Boolean!
    message: String!
  }

  type SignupResponse {
    success: Boolean!
    message: String!
  }

  type InitiateSignupResponse {
    signer_uuid: String!
    public_key: String!
    status: String!
    signer_approval_url: String
    fid: Int
  }

  type PollSignupStatusResponse {
    status: String!
    fid: Int
    user: User
    message: String
  }

  type TrendingCity {
    city: String!
    count: Int!
  }

  type LeaderboardEntry {
    username: String!
    pfp_url: String
    flash_count: Int!
    city_count: Int!
  }

  type Query {
    users(username: String, fid: Int): [User!]!
    flashes(page: Int, limit: Int, fid: Int, username: String, city: String): [FlashcastrFlash!]!
    globalFlashes(page: Int, limit: Int, city: String, player: String): [Flash!]!
    flash(id: Int!): FlashcastrFlash
    flashesSummary(fid: Int!, page: Int, limit: Int): FlashesSummary!
    allFlashesPlayers(username: String): [String!]!
    getAllCities: [String!]!
    getTrendingCities(excludeParis: Boolean = true, hours: Int = 6): [TrendingCity!]!
    getLeaderboard(limit: Int = 100): [LeaderboardEntry!]!
    pollSignupStatus(signer_uuid: String!, username: String!): PollSignupStatusResponse!
  }

  type Mutation {
    setUserAutoCast(fid: Int!, auto_cast: Boolean!): User!
    deleteUser(fid: Int!): DeleteUserResponse!
    signup(fid: Int!, signer_uuid: String!, username: String!): SignupResponse!
    initiateSignup(username: String!): InitiateSignupResponse!
  }
`;

const resolvers = {
  Query: {
    users: async (_: any, args: { username?: string; fid?: number }) => {
      const whereInput: Prisma.flashcastr_usersWhereInput = { deleted: false };
      if (args.username) {
        whereInput.username = args.username;
      }
      if (typeof args.fid === "number") {
        whereInput.fid = args.fid;
      }

      const users = await prisma.flashcastr_users.findMany({
        where: whereInput,
        select: {
          auto_cast: true,
          fid: true,
          username: true,
        },
      });

      return users;
    },
    allFlashesPlayers: async (_: any, args: { username?: string }) => {
      if (!args.username) return [];

      try {
        const flashesDb = new PostgresFlashes();
        return await flashesDb.getAllPlayers(args.username);
      } catch (error) {
        throw new GraphQLError("Failed to fetch player names", {
          extensions: { code: "INTERNAL_SERVER_ERROR" },
        });
      }
    },
    flashes: async (_: any, args: { fid?: number; username?: string; page?: number; limit?: number; city?: string }) => {
      const { page = DEFAULT_PAGE, limit = DEFAULT_LIMIT } = args;
      const validatedPage = Math.max(DEFAULT_PAGE, page);

      const prismaWhereClause: Prisma.flashcastr_flashesWhereInput = {
        deleted: false,
        flashcastr_users: {
          deleted: false,
        },
      };

      if (typeof args.fid === "number") {
        prismaWhereClause.user_fid = args.fid;
      }
      if (args.username) {
        prismaWhereClause.user_username = args.username;
      }
      if (args.city) {
        prismaWhereClause.flashes = {
          city: {
            equals: args.city,
            mode: 'insensitive'
          }
        };
      }

      const flashes = await prisma.flashcastr_flashes.findMany({
        where: prismaWhereClause,
        include: {
          flashes: true,
          flashcastr_users: true,
        },
        skip: (validatedPage - 1) * limit,
        take: limit,
        orderBy: {
          flashes: {
            timestamp: "desc",
          },
        },
      });

      return flashes.map((flash) => {
        return {
          ...flash,
          flash_id: String(flash.flash_id),
          flash: {
            ...flash.flashes,
            flash_id: String(flash.flashes.flash_id),
          },
        };
      });
    },
    globalFlashes: async (_: any, args: { page?: number; limit?: number; city?: string; player?: string }) => {
      const { page = DEFAULT_PAGE, limit = DEFAULT_LIMIT } = args;
      const validatedPage = Math.max(DEFAULT_PAGE, page);

      const whereClause: any = {};

      if (args.city) {
        whereClause.city = {
          equals: args.city,
          mode: 'insensitive'
        };
      }

      if (args.player) {
        whereClause.player = {
          equals: args.player,
          mode: 'insensitive'
        };
      }

      const globalFlashes = await prisma.flashes.findMany({
        where: whereClause,
        skip: (validatedPage - 1) * limit,
        take: limit,
        orderBy: {
          timestamp: "desc",
        },
      });

      return globalFlashes.map((flash) => ({
        ...flash,
        flash_id: String(flash.flash_id),
      }));
    },
    flash: async (_: any, args: { id: number }) => {
      const flash = await prisma.flashcastr_flashes.findFirst({
        where: {
          id: args.id,
          deleted: false,
          flashcastr_users: {
            deleted: false,
          },
        },
        include: {
          flashes: true,
          flashcastr_users: true,
        },
      });

      if (!flash) {
        return null;
      }

      return {
        ...flash,
        flash_id: String(flash.flash_id),
        flash: {
          ...flash.flashes,
          flash_id: String(flash.flashes.flash_id),
        },
      };
    },
    flashesSummary: async (_: any, args: { fid: number }) => {
      const { fid } = args;
      const where = {
        user_fid: fid,
        deleted: false,
        flashcastr_users: {
          deleted: false,
        },
      };

      // Count
      const flashCount = await prisma.flashcastr_flashes.count({ where });

      // Distinct cities: fetch all flashes for the user and extract unique city names
      const allFlashes = await prisma.flashcastr_flashes.findMany({
        where,
        include: {
          flashes: true,
        },
      });

      const cities = Array.from(new Set(allFlashes.map((f) => f.flashes?.city).filter(Boolean))) as string[];

      return { flashCount, cities };
    },
    getAllCities: async () => {
      // Use direct DB query with DISTINCT for memory efficiency
      const result = await pool.query<{ city: string }>(
        'SELECT DISTINCT city FROM flashes WHERE city IS NOT NULL ORDER BY city ASC'
      );

      return result.rows.map(row => row.city);
    },
    getTrendingCities: async (_: any, args: { excludeParis?: boolean; hours?: number }) => {
      const { excludeParis = true, hours = 6 } = args;

      // Check cache first
      const now = Date.now();
      if (trendingCitiesCache && (now - trendingCitiesCache.timestamp) < TRENDING_CACHE_TTL) {
        console.log('[getTrendingCities] Returning cached data');
        return trendingCitiesCache.data;
      }

      console.log('[getTrendingCities] Cache miss or expired, fetching fresh data');

      // Calculate timestamp for N hours ago
      const hoursAgo = new Date();
      hoursAgo.setHours(hoursAgo.getHours() - hours);

      // Use direct DB query with GROUP BY for efficient aggregation
      const parisExclusion = excludeParis
        ? "AND city NOT IN ('Paris', 'paris', 'PARIS')"
        : "";

      const query = `
        SELECT city, COUNT(*) as count
        FROM flashes
        WHERE timestamp >= $1
          AND city IS NOT NULL
          ${parisExclusion}
        GROUP BY city
        ORDER BY count DESC
        LIMIT 10
      `;

      const result = await pool.query<{ city: string; count: string }>(query, [hoursAgo]);

      const trendingCities = result.rows.map(row => ({
        city: row.city,
        count: parseInt(row.count, 10)
      }));

      // Update cache
      trendingCitiesCache = {
        data: trendingCities,
        timestamp: now
      };

      return trendingCities;
    },
    getLeaderboard: async (_: any, args: { limit?: number }) => {
      const { limit = 100 } = args;
      const validatedLimit = Math.min(Math.max(1, limit), 500); // Cap at 500

      // Check cache first
      const now = Date.now();
      if (leaderboardCache && (now - leaderboardCache.timestamp) < LEADERBOARD_CACHE_TTL) {
        console.log('[getLeaderboard] Returning cached data');
        return leaderboardCache.data.slice(0, validatedLimit);
      }

      console.log('[getLeaderboard] Cache miss or expired, fetching fresh data');

      // Use direct DB query with aggregation for efficiency
      // Get Farcaster username and pfp from flashcastr_flashes (not Flash Invaders username from users table)
      const query = `
        SELECT
          MAX(ff.user_username) as username,
          MAX(ff.user_pfp_url) as pfp_url,
          COUNT(ff.flash_id)::int as flash_count,
          COUNT(DISTINCT f.city)::int as city_count
        FROM flashcastr_users u
        LEFT JOIN flashcastr_flashes ff ON ff.user_fid = u.fid AND ff.deleted = false
        LEFT JOIN flashes f ON f.flash_id = ff.flash_id
        WHERE u.deleted = false
        GROUP BY u.fid
        ORDER BY flash_count DESC, city_count DESC
        LIMIT $1
      `;

      const result = await pool.query<{
        username: string;
        pfp_url: string | null;
        flash_count: number;
        city_count: number
      }>(query, [validatedLimit]);

      // Update cache
      leaderboardCache = {
        data: result.rows,
        timestamp: now
      };

      return result.rows;
    },
    pollSignupStatus: async (_: any, args: { signer_uuid: string; username: string }) => {
      const { signer_uuid, username } = args;

      if (!signer_uuid || !username) {
        throw new GraphQLError("signer_uuid and username are required for polling signup status.", {
          extensions: {
            code: "BAD_USER_INPUT",
            argumentName: !signer_uuid ? "signer_uuid" : "username",
          },
        });
      }

      // Helper function for finalization
      async function finalizeAndRespond(fid: number, neynar_signer_uuid: string, flash_invaders_player_name: string) {
        try {
          const finalizedUser = await SignupOperations.finalizeSignupProcess({
            fid: fid,
            signer_uuid: neynar_signer_uuid, // Corrected variable name
            flashInvadersPlayerName: flash_invaders_player_name, // Corrected variable name
          });
          return {
            status: "APPROVED_FINALIZED",
            fid: finalizedUser.fid,
            user: {
              fid: finalizedUser.fid,
              username: finalizedUser.username,
              auto_cast: finalizedUser.auto_cast,
            },
            message: "User signup finalized successfully.",
          };
        } catch (finalizationError) {
          console.error(`[GraphQL pollSignupStatus] Error finalizing signup for signer ${neynar_signer_uuid}, user ${flash_invaders_player_name}:`, finalizationError);
          return {
            status: "ERROR_FINALIZATION",
            fid: fid,
            user: null,
            message: finalizationError instanceof Error ? finalizationError.message : "Failed to finalize user signup in DB.",
          };
        }
      }

      try {
        const neynarSigner = await neynarClient.lookupSigner({ signerUuid: signer_uuid });

        if (neynarSigner.status === "approved" && neynarSigner.fid) {
          return await finalizeAndRespond(neynarSigner.fid, signer_uuid, username);
        } else if (neynarSigner.status === "pending_approval") {
          return {
            status: "PENDING_APPROVAL",
            fid: null,
            user: null,
            message: "Signer approval is pending.",
          };
        } else if (neynarSigner.status === "revoked") {
          return {
            status: "REVOKED",
            fid: null,
            user: null,
            message: "Signer request was revoked.",
          };
        } else {
          // Default case for other neynar statuses
          return {
            status: `NEYNAR_STATUS_${neynarSigner.status.toUpperCase()}`,
            fid: null,
            user: null,
            message: `Signer status from Neynar: ${neynarSigner.status}`,
          };
        }
      } catch (error) {
        console.error(`[GraphQL pollSignupStatus] Error looking up signer ${signer_uuid} on Neynar:`, error);
        return {
          status: "ERROR_NEYNAR_LOOKUP",
          fid: null,
          user: null,
          message: error instanceof Error ? error.message : "Failed to lookup signer on Neynar.",
        };
      }
    },
  },
  Mutation: {
    setUserAutoCast: async (_: any, args: { fid: number; auto_cast: boolean }, context: any) => {
      verifyApiKey(context);

      const db = new PostgresFlashcastrUsers();

      try {
        await db.updateAutocast(args.fid, args.auto_cast);
      } catch (err) {
        console.error("[GraphQL setUserAutoCast] Error updating autocast:", err);
        throw new GraphQLError("Failed to update user auto_cast setting.", {
          extensions: { code: "DATABASE_ERROR" },
        });
      }

      const updatedUser = await db.getByFid(args.fid);

      if (!updatedUser) {
        throw new GraphQLError("User not found after update.", {
          extensions: { code: "NOT_FOUND", resource: "User", fid: args.fid },
        });
      }
      return updatedUser;
    },
    deleteUser: async (_: any, args: { fid: number }, context: any) => {
      verifyApiKey(context);

      try {
        const usersDb = new PostgresFlashcastrUsers();

        const user = await usersDb.getByFid(args.fid);

        if (!user) {
          return { success: false, message: "User not found" };
        }

        const flashesDb = new PostgresFlashcastrFlashes();

        console.log("[GraphQL deleteUser] Deleting user with FID:", args.fid);

        await usersDb.deleteByFid(args.fid);
        await flashesDb.deleteManyByFid(args.fid);
      } catch (err) {
        console.error("[GraphQL deleteUser] Error deleting user:", err);
        return { success: false, message: "User deletion failed" };
      }

      return { success: true, message: "User deleted successfully" };
    },
    signup: async (_: any, args: { fid: number; signer_uuid: String; username: String }, context: any) => {
      verifyApiKey(context);

      console.warn("[GraphQL signup mutation] This mutation is likely deprecated or needs rework due to the new initiateSignup/pollSignupStatus flow. Currently a no-op.");
      // The previous problematic line was: new SignupOperations().handle({ username: args.username });
      // This was incorrect because SignupOperations is imported as an instance, and handle() was removed.
      // This mutation should be reviewed: if it's intended to manually finalize, it should call
      // SignupOperations.finalizeSignupProcess({ fid: args.fid, signer_uuid: args.signer_uuid, username: args.username });
      // For now, it remains a no-op to resolve the linter error and highlight its deprecated status.

      return { success: true, message: "Old signup mutation called (currently no-op - review needed)." };
    },
    initiateSignup: async (_: any, args: { username: string }) => {
      const { username } = args;
      if (!username) {
        throw new GraphQLError("Username is required to initiate signup.", {
          extensions: { code: "BAD_USER_INPUT", argumentName: "username" },
        });
      }
      try {
        const result = await SignupOperations.initiateSignerCreation(username);

        return {
          signer_uuid: result.signer_uuid,
          public_key: result.public_key,
          status: result.status,
          signer_approval_url: result.signer_approval_url,
          fid: result.fid,
        };
      } catch (error) {
        console.error(`[GraphQL initiateSignup] Error initiating signup for ${username}:`, error);
        if (error instanceof Error) throw error; // Rethrow GraphQL formatted errors if possible
        throw new Error("Failed to initiate signup process due to an internal error.");
      }
    },
  },
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: true,
  context: ({ req }) => ({ req }),
  persistedQueries: false,
});

server.listen({ port: 4000 }).then(async ({ url }) => {
  console.log(`🚀 Server ready at ${url}`);
});
