import { Flash, FlashesApi } from "../api.invaders.fun/flashes";
import { FlashcastrFlashes } from "../mongodb/flashcastr";
import { Flashcastr } from "../mongodb/flashcastr/types";

import { FlashcastrUsers } from "../mongodb/users";
import neynarClient from "../neynar";

class SignupTask {
  public async handle({ fid, signer_uuid, username }: { fid: number; signer_uuid: string; username: string }): Promise<void> {
    await new FlashcastrUsers().insert({
      fid,
      signer_uuid,
      username,
      auto_cast: true,
      historic_sync: false,
    });

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

    const docs: Flashcastr[] = [];

    for (const flash of flashes) {
      docs.push({
        flash,
        user: neynarUser,
        castHash: null,
      });
    }

    await new FlashcastrFlashes().insertMany(docs);
  }
}

export default SignupTask;
