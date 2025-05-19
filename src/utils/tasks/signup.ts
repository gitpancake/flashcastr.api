import { Flash, FlashesApi } from "../api.invaders.fun/flashes";
import { PostgresFlashcastrFlashes } from "../database/flashcastr";
import { FlashcastrFlash } from "../database/flashcastr/types";
import { PostgresFlashcastrUsers } from "../database/users";
import { User as DbUser } from "../database/users/types";
import { encrypt } from "../encrypt/encrypt";

import neynarClient from "../neynar/client";
import { getSignedKey } from "../neynar/getSignedKey";
// Signer type from Neynar SDK might be useful for type hints if getSignedKey returns it directly.
// import { Signer } from "@neynar/nodejs-sdk/build/api";

const FLASH_FETCH_LIMIT = 20;
const MAX_FLASHES_TO_INSERT = 7000;

// Renamed class to reflect multiple operations
export class SignupOperations {
  public async initiateSignerCreation(username: string): Promise<{
    signer_uuid: string;
    public_key: string;
    status: string;
    signer_approval_url?: string;
    fid?: number;
  }> {
    if (!username || username.trim() === "") {
      console.error("[SignupOperations.initiate] Username is required.");
      throw new Error("Username is required to initiate signer creation.");
    }
    if (username.toLowerCase() === "anonymous") {
      console.error("[SignupOperations.initiate] Username 'anonymous' is not allowed.");
      throw new Error("Username 'anonymous' is not allowed.");
    }
    console.log(`[SignupOperations.initiate] Initiating signer creation for username: ${username}`);

    try {
      const signerData = await getSignedKey(true); // is_sponsored = true

      console.log(
        `[SignupOperations.initiate] Signer created for ${username}: ${JSON.stringify({
          signer_uuid: signerData.signer_uuid,
          status: signerData.status,
          approval_url: signerData.signer_approval_url,
          fid: signerData.fid,
        })}`
      );

      return {
        signer_uuid: signerData.signer_uuid,
        public_key: signerData.public_key,
        status: signerData.status,
        signer_approval_url: signerData.signer_approval_url,
        fid: signerData.fid,
      };
    } catch (error) {
      console.error(`[SignupOperations.initiate] Failed to create signer key for username ${username}:`, error);
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create signer key for ${username}: ${message}`);
    }
  }

  private async _fetchNeynarUserDetails(fid: number): Promise<{ pfpUrl: string; farcasterUsername: string }> {
    console.log(`[SignupOperations._fetchNeynarUserDetails] Fetching Neynar user details for FID: ${fid}`);
    try {
      const {
        users: [neynarUser],
      } = await neynarClient.fetchBulkUsers({ fids: [fid] });

      if (!neynarUser) {
        throw new Error(`Could not fetch Neynar user details for FID ${fid}.`);
      }
      const pfpUrl = neynarUser.pfp_url ?? "";
      const farcasterUsername = neynarUser.username ?? "";
      console.log(`[SignupOperations._fetchNeynarUserDetails] Fetched Neynar details for FID ${fid}: Username '${farcasterUsername}'`);
      return { pfpUrl, farcasterUsername };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[SignupOperations._fetchNeynarUserDetails] Error fetching Neynar user details for FID ${fid}: ${message}`);
      throw new Error(`Error fetching Neynar user details for FID ${fid}. ${message}`);
    }
  }

  private _escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  private async _fetchAllFlashesForPlayer(playerName: string): Promise<Flash[]> {
    const safPlayerName = this._escapeRegex(playerName);
    console.log(`[SignupOperations._fetchAllFlashesForPlayer] Fetching flashes for player: ${safPlayerName}`);
    const flashes: Flash[] = [];
    let offset = 0;
    let doesHaveNext = true;

    try {
      do {
        const { items, hasNext } = await new FlashesApi().getFlashes(offset, FLASH_FETCH_LIMIT, safPlayerName);
        flashes.push(...items);
        offset += FLASH_FETCH_LIMIT;
        doesHaveNext = hasNext;
      } while (doesHaveNext);
      console.log(`[SignupOperations._fetchAllFlashesForPlayer] Fetched ${flashes.length} flashes for player: ${safPlayerName}.`);
      return flashes;
    } catch (error) {
      console.error(`[SignupOperations._fetchAllFlashesForPlayer] Error fetching flashes for player ${safPlayerName} (will return empty list):`, error);
      return []; // Return empty list on error, as per original logic of proceeding
    }
  }

  private async _storeUserDetails(userToStore: DbUser): Promise<void> {
    console.log(
      `[SignupOperations._storeUserDetails] Inserting/updating user in DB: FID ${userToStore.fid}, Username ${userToStore.username}, Encrypted Signer (length): ${userToStore.signer_uuid?.length}`
    );
    try {
      await new PostgresFlashcastrUsers().insert(userToStore);
      console.log(`[SignupOperations._storeUserDetails] User record for FID ${userToStore.fid} processed in DB.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[SignupOperations._storeUserDetails] Error inserting/updating user FID ${userToStore.fid} in DB:`, error);
      throw new Error(`Database error during user data storage for FID ${userToStore.fid}: ${message}`);
    }
  }

  private async _storePlayerFlashes(dbFlashesToStore: FlashcastrFlash[]): Promise<void> {
    if (!dbFlashesToStore.length) {
      console.log("[SignupOperations._storePlayerFlashes] No flashes to store.");
      return;
    }
    const fid = dbFlashesToStore[0].user_fid; // Assuming all flashes are for the same user
    console.log(`[SignupOperations._storePlayerFlashes] Inserting ${dbFlashesToStore.length} flash records for user FID ${fid}.`);
    try {
      await new PostgresFlashcastrFlashes().insertMany(dbFlashesToStore);
      console.log(`[SignupOperations._storePlayerFlashes] Flash records inserted for user FID ${fid}.`);
    } catch (error) {
      console.error(`[SignupOperations._storePlayerFlashes] Error inserting flash records for FID ${fid} (signup completed for user, but not flashes):`, error);
      // Original logic proceeds without throwing, so we just log here.
    }
  }

  private async _getFinalizedUserFromDb(fid: number): Promise<DbUser> {
    console.log(`[SignupOperations._getFinalizedUserFromDb] Fetching user FID ${fid} from DB after finalization.`);
    try {
      const dbUserRecord = await new PostgresFlashcastrUsers().getByFid(fid);
      if (!dbUserRecord) {
        // This case should ideally be handled by the caller if null is possible, or ensure insert guarantees presence.
        throw new Error(`User FID ${fid} not found in DB after finalization. This indicates an issue if insert was expected to succeed.`);
      }
      return dbUserRecord;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[SignupOperations._getFinalizedUserFromDb] Error fetching user FID ${fid} from DB:`, error);
      throw new Error(`Error fetching user FID ${fid} post-finalization: ${message}`);
    }
  }

  public async finalizeSignupProcess({ fid, signer_uuid, flashInvadersPlayerName }: { fid: number; signer_uuid: string; flashInvadersPlayerName: string }): Promise<DbUser> {
    if (!process.env.SIGNER_ENCRYPTION_KEY) {
      console.error("[SignupOperations.finalize] SIGNER_ENCRYPTION_KEY is not set.");
      throw new Error("SIGNER_ENCRYPTION_KEY is not set, cannot finalize signup.");
    }
    console.log(`[SignupOperations.finalize] Finalizing signup for FID: ${fid}, Player: ${flashInvadersPlayerName}, Signer: ${signer_uuid}`);

    const { pfpUrl, farcasterUsername } = await this._fetchNeynarUserDetails(fid);

    const playerFlashes = await this._fetchAllFlashesForPlayer(flashInvadersPlayerName);

    const userToStore: DbUser = {
      fid,
      username: flashInvadersPlayerName, // Storing Flash Invaders player name
      signer_uuid: encrypt(signer_uuid, process.env.SIGNER_ENCRYPTION_KEY),
      auto_cast: true,
    };
    await this._storeUserDetails(userToStore);

    if (playerFlashes.length > MAX_FLASHES_TO_INSERT) {
      console.log(`[SignupOperations.finalize] Skipping flash insertion for user FID ${fid} because flash count (${playerFlashes.length}) exceeds ${MAX_FLASHES_TO_INSERT}.`);
    } else if (playerFlashes.length > 0) {
      const dbFlashesToStore: FlashcastrFlash[] = playerFlashes.map((flash) => ({
        flash_id: flash.flash_id,
        user_fid: fid,
        user_username: farcasterUsername, // Using Farcaster username from Neynar
        user_pfp_url: pfpUrl,
        cast_hash: null,
      }));
      await this._storePlayerFlashes(dbFlashesToStore);
    } else {
      console.log(`[SignupOperations.finalize] No flashes found or to insert for player: ${flashInvadersPlayerName}.`);
    }

    console.log(`[SignupOperations.finalize] Successfully finalized signup for Player: '${flashInvadersPlayerName}', FID: ${fid}`);
    return this._getFinalizedUserFromDb(fid);
  }
}

export default new SignupOperations();
