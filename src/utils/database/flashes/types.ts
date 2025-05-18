import { User as NeynarUser } from "@neynar/nodejs-sdk/build/api";
import { Flash } from "../../api.invaders.fun/flashes";

export interface Flashcastr {
  flash: Flash;
  user: NeynarUser;
  castHash: string | null;
}

export interface FlashcastrFlash {
  flash_id: number;
  user_fid: number;
  user_username: string;
  user_pfp_url: string;
  cast_hash: string | null;
}
