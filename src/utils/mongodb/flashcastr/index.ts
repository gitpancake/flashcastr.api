import { DeleteResult, Filter, MongoBulkWriteError, WithId } from "mongodb";
import { Mongo } from "../connector";
import { Flashcastr } from "./types";

export class FlashcastrFlashesDb extends Mongo<Flashcastr> {
  constructor() {
    super({
      dbName: "flashcastr",
      collectionName: "flashes",
    });
  }

  public async onConnect(): Promise<void> {
    await this.collection.createIndex({ "user.fid": -1 });
    await this.collection.createIndex({ "flash.flash_id": 1 }, { unique: true });
  }

  public async getMany(filter: Filter<Flashcastr>, page: number = 1, limit: number = 10): Promise<WithId<Flashcastr>[]> {
    const skip = (page - 1) * limit;

    return this.execute(async (collection) => await collection.find(filter).sort({ "flash.timestamp": -1 }).skip(skip).limit(limit).toArray());
  }

  public async count(filter: Filter<Flashcastr>): Promise<number> {
    return this.execute(async (collection) => await collection.countDocuments(filter));
  }

  public async getDistinctCities(filter: Filter<Flashcastr>): Promise<string[]> {
    return this.execute(async (collection) => await collection.distinct("flash.city", filter));
  }

  public async deleteMany(filter: Filter<Flashcastr>): Promise<DeleteResult> {
    return this.execute(async (collection) => await collection.deleteMany(filter));
  }

  public async insertMany(flashes: Flashcastr[]): Promise<number> {
    return this.execute(async (collection) => {
      try {
        const result = await collection.insertMany(flashes, { ordered: false });
        return result.insertedCount;
      } catch (error: unknown) {
        if (error instanceof MongoBulkWriteError) {
          if (error.code !== 11000) {
            console.error("Error writing documents:", error);
          }

          return error.result.insertedCount ?? 0;
        }

        return 0;
      }
    });
  }
}
