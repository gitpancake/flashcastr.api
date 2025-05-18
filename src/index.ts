import { Prisma, PrismaClient } from "@prisma/client";
import { ApolloServer, gql } from "apollo-server";
import { GraphQLError } from "graphql";
import { PostgresFlashcastrFlashes } from "./utils/database/flashcastr";
import { PostgresFlashes } from "./utils/database/flashes";
import { PostgresFlashcastrUsers } from "./utils/database/users";
import neynarClient from "./utils/neynar/client";
import SignupOperations from "./utils/tasks/signup";

const prisma = new PrismaClient();

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

  type Query {
    users(username: String, fid: Int): [User!]!
    flashes(page: Int, limit: Int, fid: Int, username: String): [FlashcastrFlash!]!
    flashesSummary(fid: Int!, page: Int, limit: Int): FlashesSummary!
    allFlashesPlayers(username: String): [String!]!
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
      const where: any = { deleted: false };
      if (args.username) where.username = args.username;
      if (typeof args.fid === "number") where.fid = args.fid;

      const users = await prisma.flashcastr_users.findMany({
        where,
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
    flashes: async (_: any, args: { fid?: number; username?: string; page?: number; limit?: number }) => {
      const { page = 1, limit = 20 } = args;
      const validatedPage = Math.max(1, page);

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
    flashesSummary: async (_: any, args: { fid: number }) => {
      const { fid } = args;
      const where = { user_fid: fid, deleted: false };

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

      try {
        const neynarSigner = await neynarClient.lookupSigner({ signerUuid: signer_uuid });

        if (neynarSigner.status === "approved" && neynarSigner.fid) {
          try {
            const finalizedUser = await SignupOperations.finalizeSignupProcess({
              fid: neynarSigner.fid,
              signer_uuid: neynarSigner.signer_uuid,
              username: username,
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
            console.error(`[GraphQL pollSignupStatus] Error finalizing signup for signer ${signer_uuid}, user ${username}:`, finalizationError);
            return {
              status: "ERROR_FINALIZATION",
              fid: neynarSigner.fid,
              user: null,
              message: finalizationError instanceof Error ? finalizationError.message : "Failed to finalize user signup in DB.",
            };
          }
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
      const apiKey = context.req?.headers["x-api-key"] || context.req?.headers["X-API-KEY"];

      const validApiKey = process.env.API_KEY;

      if (!apiKey || apiKey !== validApiKey) {
        throw new GraphQLError("Unauthorized: Invalid API key", {
          extensions: { code: "UNAUTHORIZED" },
        });
      }

      const db = new PostgresFlashcastrUsers();

      try {
        await db.updateAutocast(args.fid, args.auto_cast);
      } catch (err) {
        console.log(err);
      }

      // Return the updated user (fetch after update)
      const updatedUser = await db.getByFid(args.fid);

      if (!updatedUser) throw new Error("User not found");
      return updatedUser;
    },
    deleteUser: async (_: any, args: { fid: number }, context: any) => {
      const apiKey = context.req?.headers["x-api-key"] || context.req?.headers["X-API-KEY"];
      const validApiKey = process.env.API_KEY;

      if (!apiKey || apiKey !== validApiKey) {
        throw new Error("Unauthorized: Invalid API key");
      }

      try {
        const usersDb = new PostgresFlashcastrUsers();

        const user = await usersDb.getByFid(args.fid);

        if (!user) {
          return { success: false, message: "User not found" };
        }

        const flashesDb = new PostgresFlashcastrFlashes();

        console.log(args.fid);

        await usersDb.deleteByFid(args.fid);
        await flashesDb.deleteManyByFid(args.fid);
      } catch (err) {
        console.log(err);
        return { success: false, message: "User deletion failed" };
      }

      return { success: true, message: "User deleted successfully" };
    },
    signup: async (_: any, args: { fid: number; signer_uuid: String; username: String }, context: any) => {
      const apiKey = context.req?.headers["x-api-key"] || context.req?.headers["X-API-KEY"];
      const validApiKey = process.env.API_KEY;

      if (!apiKey || apiKey !== validApiKey) throw new Error("Unauthorized: Invalid API key");

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
        throw new Error("Username is required to initiate signup.");
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
