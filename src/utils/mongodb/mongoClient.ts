import { config } from "dotenv";
import { MongoClient } from "mongodb";

config({ path: ".env" });

const uri = process.env.DATABASE_URL!;
if (!uri) throw new Error("DATABASE_URL is not defined in the environment variables");

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

if (!global._mongoClientPromise) {
  client = new MongoClient(uri);
  global._mongoClientPromise = client.connect().then(() => client);
}
clientPromise = global._mongoClientPromise;

export default clientPromise;
