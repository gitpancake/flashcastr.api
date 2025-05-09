import { config } from "dotenv";
import { Collection, Db, Document, MongoClient } from "mongodb";

config({
  path: ".env",
});

// ✅ Reuse global singleton (safe in serverless or Node context)
let mongoClient: MongoClient | null = null;

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
    console.log(`Connecting to ${this.options.dbName}...`);

    const client = await this.getClient();
    this.db = client.db(this.options.dbName);
    this.collection = this.db.collection<T>(this.options.collectionName);
  }

  protected async execute<R>(fn: (col: Collection<T>) => Promise<R>): Promise<R> {
    if (!this.collection) {
      await this.connect();
    }
    return fn(this.collection);
  }
}
