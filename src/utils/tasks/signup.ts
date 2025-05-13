import { Flash, FlashesApi } from "../api.invaders.fun/flashes";
import { PostgresFlashcastrFlashes } from "../database/flashcastr";
import { FlashcastrFlash } from "../database/flashcastr/types";

import { PostgresFlashcastrUsers } from "../database/users";
import neynarClient from "../neynar";

class SignupTask {
  public async handle({ fid, signer_uuid, username }: { fid: number; signer_uuid: string; username: string }): Promise<void> {
    const {
      users: [neynarUser],
    } = await neynarClient.fetchBulkUsers({ fids: [fid] });

    function escapeRegex(str: string) {
      return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    const safeUsername = escapeRegex(username);

    const flashes: Flash[] = [];
    let offset = 0;
    let doesHaveNext = true;
    const limit = 20;

    do {
      const { items, hasNext } = await new FlashesApi().getFlashes(offset, limit, safeUsername);
      flashes.push(...items);
      offset += limit;
      doesHaveNext = hasNext;
    } while (doesHaveNext);

    if (!flashes.length) {
      return;
    }

    const docs: FlashcastrFlash[] = [];

    for (const flash of flashes) {
      docs.push({
        flash_id: flash.flash_id,
        user_fid: fid,
        user_username: username,
        user_pfp_url: neynarUser.pfp_url ?? "",
        cast_hash: null,
      });
    }

    await new PostgresFlashcastrUsers().insert({
      fid,
      signer_uuid,
      username,
      auto_cast: true,
    });

    await new PostgresFlashcastrFlashes().insertMany(docs);
  }
}

export default SignupTask;
