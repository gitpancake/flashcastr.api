import { DeleteResult, Filter, MongoBulkWriteError } from "mongodb";
import { Mongo } from "../connector";
import { Flashcastr } from "./types";

export class FlashcastrFlashes extends Mongo<Flashcastr> {
  constructor() {
    super({
      dbName: "flashcastr",
      collectionName: "flashes",
    });
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
