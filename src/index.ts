import { PrismaClient } from "@prisma/client";
import { ApolloServer, gql } from "apollo-server";
import { FlashcastrFlashesDb } from "./utils/mongodb/flashcastr";
import { Users } from "./utils/mongodb/users";
import SignupTask from "./utils/tasks/signup";

const prisma = new PrismaClient();

const typeDefs = gql`
  type FlashesFlash {
    id: ID
    city: String
    flash_count: String
    flash_id: Int
    img: String
    player: String
    posted: Boolean
    text: String
    timestamp: Float
  }

  type FlashesUserExperimental {
    deprecation_notice: String
    neynar_user_score: Float
  }

  type FlashesUserProfileBioMentionedChannels {
    id: String
    image_url: String
    name: String
    object: String
  }

  type FlashesUserProfileBioMentionedChannelsRanges {
    end: Int
    start: Int
  }

  type FlashesUserProfileBioMentionedProfiles {
    custody_address: String
    display_name: String
    fid: Int
    object: String
    pfp_url: String
    username: String
  }

  type FlashesUserProfileBioMentionedProfilesRanges {
    end: Int
    start: Int
  }

  type FlashesUserProfileBio {
    mentioned_channels: [FlashesUserProfileBioMentionedChannels!]
    mentioned_channels_ranges: [FlashesUserProfileBioMentionedChannelsRanges!]
    mentioned_profiles: [FlashesUserProfileBioMentionedProfiles!]
    mentioned_profiles_ranges: [FlashesUserProfileBioMentionedProfilesRanges!]
    text: String
  }

  type FlashesUserProfile {
    bio: FlashesUserProfileBio
  }

  type FlashesUserVerifiedAddressesPrimary {
    eth_address: String
    sol_address: String
  }

  type FlashesUserVerifiedAddresses {
    eth_addresses: [String!]
    primary: FlashesUserVerifiedAddressesPrimary
    sol_addresses: String
  }

  type FlashesUser {
    custody_address: String
    display_name: String
    experimental: FlashesUserExperimental
    fid: Int
    follower_count: Int
    following_count: Int
    object: String
    pfp_url: String
    power_badge: Boolean
    profile: FlashesUserProfile
    score: Float
    username: String
    verifications: [String!]
    verified_accounts: String
    verified_addresses: FlashesUserVerifiedAddresses
  }

  type Flash {
    id: ID!
    castHash: String
    flash: FlashesFlash
    user: FlashesUser
  }

  type User {
    id: ID!
    auto_cast: Boolean
    fid: Int
    historic_sync: Boolean
    username: String
  }

  type FlashesSummary {
    flashes: [Flash!]!
    flashCount: Int!
    cities: [String!]!
  }

  type Query {
    users(username: String, fid: Int): [User!]!
    flashes(fid: Int, username: String): [Flash!]!
    flashesSummary(fid: Int!, page: Int = 1, limit: Int = 20): FlashesSummary!
    flashesAll(page: Int = 1, limit: Int = 40, fid: Int, search: String): [Flash!]!
  }

  type Mutation {
    setUserAutoCast(fid: Int!, auto_cast: Boolean!): User!
    deleteUser(fid: Int!): DeleteUserResult!
    signup(fid: Int!, signer_uuid: String!, username: String!): SignupResult!
  }

  type SignupResult {
    success: Boolean!
    message: String
  }

  type DeleteUserResult {
    success: Boolean!
    message: String
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
        await new Users().updateDocument({ fid: args.fid }, { $set: { auto_cast: args.auto_cast } });
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
        await new Users().deleteDocument({ fid: args.fid });
        await new FlashcastrFlashesDb().deleteMany({ "user.fid": args.fid });
      } catch (err) {
        console.log(err);
        return { success: false, message: "User deletion failed" };
      }

      return { success: true, message: "User deleted successfully" };
    },
    signup: async (_: any, args: { fid: number; signer_uuid: string; username: string }, context: any) => {
      console.log("signup");
      const apiKey = context.req?.headers["x-api-key"] || context.req?.headers["X-API-KEY"];
      const validApiKey = process.env.API_KEY;

      console.log({ apiKey, validApiKey });

      if (!apiKey || apiKey !== validApiKey) {
        throw new Error("Unauthorized: Invalid API key");
      }

      try {
        console.log("signup try");

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

server.listen({ port: 4000 }).then(({ url }) => {
  console.log(`🚀 Server ready at ${url}`);
});
