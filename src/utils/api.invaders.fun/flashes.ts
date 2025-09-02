import { BaseApi } from "./base";

export interface Flash {
  id: string;
  city: string;
  flash_count: string;
  flash_id: number;
  img: string;
  ipfs_cid: string | null;
  player: string;
  posted: boolean | null;
  text: string;
  timestamp: number;
}

export interface FlashConnection {
  items: Flash[];
  hasNext: boolean;
}

export class FlashesApi extends BaseApi {
  public async getFlashes(offset: number = 0, limit: number = 20, player?: string): Promise<FlashConnection> {
    const variables: Record<string, any> = {
      offset,
      limit,
    };

    if (player !== undefined && player !== null) {
      variables.player = player;
    }

    const response = await this.api.post("/graphql", {
      query: `
        query Flashes($offset: Int, $limit: Int, $player: String) {
          flashes(offset: $offset, limit: $limit, player: $player) {
            items {
              city
              flash_id
              img
              ipfs_cid
              player
              text
              timestamp
            }
            hasNext
          }
        }
      `,
      variables,
    });

    return response.data.data.flashes;
  }
}
