import { Flash, FlashesApi } from "../api.invaders.fun/flashes";
import { PostgresFlashcastrFlashes } from "../database/flashcastr";
import { FlashcastrFlash } from "../database/flashcastr/types";
import { PostgresFlashcastrUsers } from "../database/users";
import { User as DbUser } from "../database/users/types";

import neynarClient from "../neynar/client";
import { getSignedKey } from "../neynar/getSignedKey";
// Signer type from Neynar SDK might be useful for type hints if getSignedKey returns it directly.
// import { Signer } from "@neynar/nodejs-sdk/build/api";

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

      if (!signerData || !signerData.signer_uuid) {
        // This check might be redundant if getSignedKey throws on failure to get a signer_uuid
        throw new Error("getSignedKey did not return a valid signer_uuid.");
      }

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

  public async finalizeSignupProcess({ fid, signer_uuid, username }: { fid: number; signer_uuid: string; username: string }): Promise<DbUser> {
    console.log(`[SignupOperations.finalize] Finalizing signup for FID: ${fid}, Username: ${username}, Signer: ${signer_uuid}`);

    let pfpUrl = "";
    try {
      const {
        users: [neynarUser],
      } = await neynarClient.fetchBulkUsers({ fids: [fid] });
      if (neynarUser && neynarUser.pfp_url) {
        pfpUrl = neynarUser.pfp_url;
      }
    } catch (error) {
      console.warn(`[SignupOperations.finalize] Error fetching Neynar user details for FID ${fid} (pfp_url will be empty):`, error);
    }
    console.log(`[SignupOperations.finalize] Neynar pfp_url for FID ${fid}: '${pfpUrl}'`);

    function escapeRegex(str: string) {
      return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
    const safeUsername = escapeRegex(username);
    console.log(`[SignupOperations.finalize] Fetching flashes for safeUsername: ${safeUsername}`);
    const flashes: Flash[] = [];
    let offset = 0;
    let doesHaveNext = true;
    const limit = 20;

    try {
      do {
        const { items, hasNext } = await new FlashesApi().getFlashes(offset, limit, safeUsername);
        flashes.push(...items);
        offset += limit;
        doesHaveNext = hasNext;
      } while (doesHaveNext);
      console.log(`[SignupOperations.finalize] Fetched ${flashes.length} flashes for ${username}.`);
    } catch (error) {
      console.error(`[SignupOperations.finalize] Error fetching flashes for ${username} (will proceed without flashes):`, error);
    }

    const userToStore: DbUser = {
      fid,
      username,
      signer_uuid,
      auto_cast: true,
    };

    const usersDb = new PostgresFlashcastrUsers();
    try {
      console.log(`[SignupOperations.finalize] Inserting/updating user in DB: FID ${fid}, Username ${username}, Signer ${signer_uuid}`);
      await usersDb.insert(userToStore);
      console.log(`[SignupOperations.finalize] User record for FID ${fid} processed in DB.`);
    } catch (error) {
      console.error(`[SignupOperations.finalize] Error inserting/updating user FID ${fid} in DB:`, error);
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Database error during user finalization for FID ${fid}: ${message}`);
    }

    if (flashes.length > 0) {
      const docs: FlashcastrFlash[] = flashes.map((flash) => ({
        flash_id: flash.flash_id,
        user_fid: fid,
        user_username: username,
        user_pfp_url: pfpUrl,
        cast_hash: null,
      }));

      try {
        console.log(`[SignupOperations.finalize] Inserting ${docs.length} flash records for user FID ${fid}.`);
        await new PostgresFlashcastrFlashes().insertMany(docs);
        console.log(`[SignupOperations.finalize] Flash records inserted for user FID ${fid}.`);
      } catch (error) {
        console.error(`[SignupOperations.finalize] Error inserting flash records for FID ${fid} (signup completed for user, but not flashes):`, error);
      }
    } else {
      console.log(`[SignupOperations.finalize] No flashes found or to insert for ${username}.`);
    }

    console.log(`[SignupOperations.finalize] Successfully finalized signup for username: ${username}, FID: ${fid}`);
    try {
      const dbUserRecord = await usersDb.getByFid(fid);
      if (!dbUserRecord) {
        throw new Error(`User FID ${fid} not found in DB after successful finalization call. This should not happen if insert was successful.`);
      }
      return dbUserRecord;
    } catch (error) {
      console.error(`[SignupOperations.finalize] Error fetching user FID ${fid} from DB after finalization operations:`, error);
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Error fetching user FID ${fid} post-finalization: ${message}`);
    }
  }
}

export default new SignupOperations();
