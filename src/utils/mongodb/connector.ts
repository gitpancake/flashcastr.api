import { Collection, Document } from "mongodb";
import clientPromise from "./mongoClient";

export abstract class Mongo<T extends Document> {
  public collection: Collection<T>;
  private dbName: string;
  private collectionName: string;

  constructor({ dbName, collectionName }: { dbName: string; collectionName: string }) {
    this.dbName = dbName;
    this.collectionName = collectionName;
    // collection will be set in execute
    this.collection = undefined as any;
  }

  public async onConnect(): Promise<void> {}

  protected async execute<R>(operation: (collection: Collection<T>) => Promise<R>): Promise<R> {
    const client = await clientPromise;
    this.collection = client.db(this.dbName).collection<T>(this.collectionName);

    try {
      await this.onConnect();
      return await operation(this.collection);
    } catch (error) {
      console.error("Database operation error:", error);
      throw error;
    }
  }
}
