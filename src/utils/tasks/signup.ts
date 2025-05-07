import { Flash, FlashesApi } from "../api.invaders.fun/flashes";
import { FlashcastrFlashesDb } from "../mongodb/flashcastr";
import { Flashcastr } from "../mongodb/flashcastr/types";

import { Users } from "../mongodb/users";
import neynarClient from "../neynar";

class SignupTask {
  public async handle({ fid, signer_uuid, username }: { fid: number; signer_uuid: string; username: string }): Promise<void> {
    console.log({
      fid,
      signer_uuid,
      username,
    });

    console.log("Inserting user");

    await new Users().insert({
      fid,
      signer_uuid,
      username,
      auto_cast: true,
      historic_sync: false,
    });

    console.log("Fetching Neynar user");

    const {
      users: [neynarUser],
    } = await neynarClient.fetchBulkUsers({ fids: [fid] });

    console.log("Fetching flashes");

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

    console.log("Inserting flashes");

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

    console.log("Inserting flashes into database");

    await new FlashcastrFlashesDb().insertMany(docs);

    console.log("Done");
  }
}

export default SignupTask;
