import { Configuration, NeynarAPIClient } from "@neynar/nodejs-sdk";

if (!process.env.NEYNAR_API_KEY) {
  throw new Error("NEYNAR_API_KEY is not set");
}

const config = new Configuration({ apiKey: process.env.NEYNAR_API_KEY });

const neynarClient = new NeynarAPIClient(config);

export default neynarClient;
