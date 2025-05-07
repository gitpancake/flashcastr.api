import { Collection, Document, MongoClient } from "mongodb";

export abstract class Mongo<T extends Document> {
  private client: MongoClient;

  public collection: Collection<T>;

  constructor({ dbName, collectionName }: { dbName: string; collectionName: string }) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not defined in the environment variables");
    }

    this.client = new MongoClient(process.env.DATABASE_URL);
    this.collection = this.client.db(dbName).collection<T>(collectionName);
  }

  public async onConnect(): Promise<void> {}

  protected async execute<R>(operation: (collection: Collection<T>) => Promise<R>): Promise<R> {
    try {
      await this.client.connect();

      await this.onConnect();

      return await operation(this.collection);
    } catch (error) {
      console.error("Database operation error:", error);
      throw error;
    } finally {
      await this.client.close();
    }
  }
}
