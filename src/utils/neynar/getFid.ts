import { mnemonicToAccount } from "viem/accounts";
import neynarClient from "./client";

export const getFid = async () => {
  if (!process.env.FARCASTER_DEVELOPER_MNEMONIC) {
    throw new Error("FARCASTER_DEVELOPER_MNEMONIC is not set");
  }

  const account = mnemonicToAccount(process.env.FARCASTER_DEVELOPER_MNEMONIC);

  const { user: farcasterDeveloper } = await neynarClient.lookupUserByCustodyAddress({
    custodyAddress: account.address,
  });

  return Number(farcasterDeveloper.fid);
};
