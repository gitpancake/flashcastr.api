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

  type Query {
    users(username: String, fid: Int): [User!]!
    flashes(page: Int, limit: Int, fid: Int, username: String): [FlashcastrFlash!]!
    flashesSummary(fid: Int!, page: Int, limit: Int): FlashesSummary!
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
    flashes: async (_: any, args: { fid?: number; username?: string; page?: number; limit?: number }) => {
      const { page = 1, limit = 20 } = args;
      const validatedPage = Math.max(1, page);

      const where: any = {};

      if (typeof args.fid === "number") where["user.fid"] = args.fid;
      if (args.username) where["user.username"] = args.username;

      const flashes = await prisma.flashcastr_flashes.findMany({
        where: Object.keys(where).length
          ? {
              deleted: false,
              user_fid: where["user.fid"],
              user_username: where["user.username"],
            }
          : { deleted: false },
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
          flash_id: Number(flash.flash_id),
          flash: {
            ...flash.flashes,
            flash_id: Number(flash.flashes.flash_id),
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

      const cities = Array.from(new Set(allFlashes.map((f) => f.flashes?.city).filter(Boolean)));

      return { flashCount, cities };
    },
  },
  Mutation: {
    setUserAutoCast: async (_: any, args: { fid: number; auto_cast: boolean }, context: any) => {
      const apiKey = context.req?.headers["x-api-key"] || context.req?.headers["X-API-KEY"];

      const validApiKey = process.env.API_KEY;

      if (!apiKey || apiKey !== validApiKey) {
        throw new Error("Unauthorized: Invalid API key");
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
