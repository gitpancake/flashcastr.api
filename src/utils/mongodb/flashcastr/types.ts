import { User as NeynarUser } from "@neynar/nodejs-sdk/build/api";
import { Flash } from "../../api.invaders.fun/flashes";

export interface Flashcastr {
  flash: Flash;
  user: NeynarUser;
  castHash: string | null;
}
