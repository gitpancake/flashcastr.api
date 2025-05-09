import { config } from "dotenv";
import { Collection, Db, Document, MongoClient } from "mongodb";

config({ path: ".env" });

let mongoClient: MongoClient | null = null;

// ✅ Cache collections by key: "dbName.collectionName"
const collectionCache: Map<string, Collection<any>> = new Map();

export abstract class Mongo<T extends Document> {
  protected db!: Db;
  protected collection!: Collection<T>;

  constructor(private options: { dbName: string; collectionName: string }) {}

  protected async onConnect(): Promise<void> {}

  private async getClient(): Promise<MongoClient> {
    const uri = process.env.DATABASE_URL!;

    if (!mongoClient) {
      mongoClient = new MongoClient(uri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
      });
      await mongoClient.connect();
    } else {
      try {
        await mongoClient.db("admin").command({ ping: 1 });
      } catch (err) {
        console.warn("Mongo client disconnected. Reconnecting...");
        mongoClient = new MongoClient(uri, {
          maxPoolSize: 10,
          serverSelectionTimeoutMS: 5000,
        });
        await mongoClient.connect();
      }
    }

    return mongoClient;
  }

  public async connect(): Promise<void> {
    const cacheKey = `${this.options.dbName}.${this.options.collectionName}`;

    const cached = collectionCache.get(cacheKey);
    if (cached) {
      this.db = mongoClient!.db(this.options.dbName);
      this.collection = cached as Collection<T>;
      return;
    }

    console.log(`Connecting to ${cacheKey}...`);

    const client = await this.getClient();
    this.db = client.db(this.options.dbName);
    this.collection = this.db.collection<T>(this.options.collectionName);

    await this.onConnect(); // Index setup etc.

    collectionCache.set(cacheKey, this.collection);
  }

  protected async execute<R>(fn: (col: Collection<T>) => Promise<R>): Promise<R> {
    if (!this.collection) {
      await this.connect();
    }
    return fn(this.collection);
  }
}
