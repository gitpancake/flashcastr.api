import { config } from "dotenv";
import { Collection, Db, Document, MongoClient } from "mongodb";

config({
  path: ".env",
});

// ✅ Reuse global singleton (safe in serverless or Node context)
let mongoClient: MongoClient | null = null;
const connectedCollections = new Set<string>();

export abstract class Mongo<T extends Document> {
  protected db!: Db;
  protected collection!: Collection<T>;

  constructor(private options: { dbName: string; collectionName: string }) {}

  private async getClient(): Promise<MongoClient> {
    const uri = process.env.DATABASE_URL!;

    if (!mongoClient) {
      mongoClient = new MongoClient(uri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
      });
      await mongoClient.connect();
    }

    return mongoClient;
  }

  public async connect(): Promise<void> {
    const cacheKey = `${this.options.dbName}.${this.options.collectionName}`;

    // Prevent reconnecting and re-initializing the same collection
    if (connectedCollections.has(cacheKey)) return;

    console.log(`Connecting to ${cacheKey}...`);

    const client = await this.getClient();
    this.db = client.db(this.options.dbName);
    this.collection = this.db.collection<T>(this.options.collectionName);

    connectedCollections.add(cacheKey);
  }

  protected async execute<R>(fn: (col: Collection<T>) => Promise<R>): Promise<R> {
    if (!this.collection) {
      await this.connect();
    }
    return fn(this.collection);
  }
}
