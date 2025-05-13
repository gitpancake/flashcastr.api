import { PrismaClient } from "@prisma/client";
import { ApolloServer, gql } from "apollo-server";
import { PostgresFlashcastrFlashes } from "./utils/database/flashcastr";
import { PostgresFlashcastrUsers } from "./utils/database/users";
import SignupTask from "./utils/tasks/signup";

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
  }

  type FlashesSummary {
    flashes: [Flash!]!
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

  type Query {
    users(username: String, fid: Int): [User!]!
    flashes(fid: Int, username: String): [FlashcastrFlash!]!
    flashesSummary(fid: Int!, page: Int, limit: Int): FlashesSummary!
    flashesAll(page: Int, limit: Int, fid: Int, search: String): [FlashcastrFlash!]!
  }

  type Mutation {
    setUserAutoCast(fid: Int!, auto_cast: Boolean!): User!
    deleteUser(fid: Int!): DeleteUserResponse!
    signup(fid: Int!, signer_uuid: String!, username: String!): SignupResponse!
  }
`;

const resolvers = {
  Query: {
    users: async (_: any, args: { username?: string; fid?: number }) => {
      const where: any = {};
      if (args.username) where.username = args.username;
      if (typeof args.fid === "number") where.fid = args.fid;

      const users = await prisma.users.findMany({
        where,
        select: {
          id: true,
          auto_cast: true,
          fid: true,
          historic_sync: true,
          username: true,
        },
      });

      return users;
    },
    flashes: async (_: any, args: { fid?: number; username?: string }) => {
      const where: any = {};
      if (typeof args.fid === "number") where["user.fid"] = args.fid;
      if (args.username) where["user.username"] = args.username;
      const flashes = await prisma.flashes.findMany({
        where: Object.keys(where).length
          ? { user: { ...("user.fid" in where ? { fid: where["user.fid"] } : {}), ...("user.username" in where ? { username: where["user.username"] } : {}) } }
          : undefined,
      });
      return flashes;
    },
    flashesSummary: async (_: any, args: { fid: number; page?: number; limit?: number }) => {
      const { fid, page = 1, limit = 20 } = args;
      const where = { user: { is: { fid } } };
      // Paginated flashes
      const flashes = await prisma.flashes.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
      });
      // Count
      const flashCount = await prisma.flashes.count({ where });

      // Distinct cities: fetch all flashes for the user and extract unique city names
      const allFlashes = await prisma.flashes.findMany({
        where,
        select: { flash: { select: { city: true } } },
      });

      const cities = Array.from(new Set(allFlashes.map((f) => f.flash?.city).filter(Boolean)));
      return { flashes, flashCount, cities };
    },
    flashesAll: async (_: any, args: { page?: number; limit?: number; fid?: number; search?: string }) => {
      const { page = 1, limit = 40, fid, search } = args;
      const where: any = {};
      if (typeof fid === "number") {
        where.user = { is: { fid } };
      }
      if (search) {
        // Case-insensitive search on flash.city or flash.player
        where.OR = [{ flash: { city: { contains: search, mode: "insensitive" } } }, { flash: { player: { contains: search, mode: "insensitive" } } }];
      }

      return await prisma.flashes.findMany({
        where: Object.keys(where).length ? where : undefined,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: {
          flash: {
            timestamp: "desc",
          },
        },
        select: {
          flash: true,
          user: true,
          castHash: true,
        },
      });
    },
  },
  Mutation: {
    setUserAutoCast: async (_: any, args: { fid: number; auto_cast: boolean }, context: any) => {
      const apiKey = context.req?.headers["x-api-key"] || context.req?.headers["X-API-KEY"];

      const validApiKey = process.env.API_KEY;

      if (!apiKey || apiKey !== validApiKey) {
        throw new Error("Unauthorized: Invalid API key");
      }

      try {
        await new PostgresFlashcastrUsers().updateAutocast(args.fid, args.auto_cast);
      } catch (err) {
        console.log(err);
      }

      // Return the updated user (fetch after update)
      const updatedUser = await prisma.users.findFirst({ where: { fid: args.fid } });

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
        await new PostgresFlashcastrUsers().deleteByFid(args.fid);
        await new PostgresFlashcastrFlashes().deleteManyByFid(args.fid);
      } catch (err) {
        console.log(err);
        return { success: false, message: "User deletion failed" };
      }

      return { success: true, message: "User deleted successfully" };
    },
    signup: async (_: any, args: { fid: number; signer_uuid: string; username: string }, context: any) => {
      const apiKey = context.req?.headers["x-api-key"] || context.req?.headers["X-API-KEY"];
      const validApiKey = process.env.API_KEY;

      if (!apiKey || apiKey !== validApiKey) {
        throw new Error("Unauthorized: Invalid API key");
      }

      try {
        new SignupTask().handle({
          fid: args.fid,
          signer_uuid: args.signer_uuid,
          username: args.username,
        });

        return { success: true, message: "User created successfully" };
      } catch (err) {
        console.log(err);
        return { success: false, message: "User creation failed" };
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
