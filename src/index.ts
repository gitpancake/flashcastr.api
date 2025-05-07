import { PrismaClient } from "@prisma/client";
import { ApolloServer, gql } from "apollo-server";

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
    flashesAll(page: Int = 1, limit: Int = 40): [Flash!]!
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
    flashesAll: async (_: any, args: { page?: number; limit?: number }) => {
      const { page = 1, limit = 40 } = args;
      return prisma.flashes.findMany({
        skip: (page - 1) * limit,
        take: limit,
      });
    },
  },
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: true,
});

server.listen({ port: 4000 }).then(({ url }) => {
  console.log(`🚀 Server ready at ${url}`);
});
