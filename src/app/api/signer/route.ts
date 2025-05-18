import { NextResponse } from "next/server";
// Adjusted imports to reflect project structure (utils instead of lib)
import neynarClient from "../../../utils/neynar/client";
import { getSignedKey } from "../../../utils/neynar/getSignedKey";
import SignupTask from "../../../utils/tasks/signup";

// --- Existing POST /api/signer ---
// DEPRECATED: This will be replaced by the new POST handler below
export async function POST_OLD() {
  try {
    const signedKey = await getSignedKey(true);
    return NextResponse.json(signedKey, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}

// --- Existing GET /api/signer ---
// DEPRECATED: This will be replaced by the new GET handler below
export async function GET_OLD(req: Request) {
  const { searchParams } = new URL(req.url);
  const signer_uuid = searchParams.get("signer_uuid");
  const username = searchParams.get("username");

  if (!signer_uuid) {
    return NextResponse.json({ error: "signer_uuid is required" }, { status: 400 });
  }
  // Username is needed for the original SignupTask call
  if (!username) {
    return NextResponse.json({ error: "username is required" }, { status: 400 });
  }

  try {
    const signer = await neynarClient.lookupSigner({ signerUuid: signer_uuid });

    if (signer.status === "approved" && signer.fid && username) {
      await new SignupTask().handle({ fid: signer.fid, signer_uuid: signer.signer_uuid, username });
    }

    return NextResponse.json(signer, { status: 200 });
  } catch (error) {
    console.error("Error in GET /api/signer (old):", error);
    return NextResponse.json({ error: "An error occurred while fetching signer status or processing signup." }, { status: 500 });
  }
}

// --- NEW ENDPOINTS ---

// New POST /api/signer
// This endpoint creates a signer.
export async function POST(req: Request) {
  try {
    // is_sponsored is true, as per your original POST and getSignedKey structure
    const signedKeyResult = await getSignedKey(true);
    return NextResponse.json(signedKeyResult, { status: 200 });
  } catch (error) {
    console.error("Error creating signer:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json({ error: "Failed to create signer.", details: errorMessage }, { status: 500 });
  }
}

// New GET /api/signer
// This endpoint checks signer status and triggers SignupTask on approval.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const signer_uuid = searchParams.get("signer_uuid");
  const username = searchParams.get("username");

  if (!signer_uuid) {
    return NextResponse.json({ error: "signer_uuid is required" }, { status: 400 });
  }
  if (!username) {
    return NextResponse.json({ error: "username is required for signup finalization" }, { status: 400 });
  }

  try {
    const signerStatus = await neynarClient.lookupSigner({ signerUuid: signer_uuid });

    if (signerStatus.status === "approved" && signerStatus.fid) {
      console.log(`Signer ${signer_uuid} approved for user ${username}, FID: ${signerStatus.fid}. Triggering SignupTask.`);
      try {
        await new SignupTask().handle({
          fid: signerStatus.fid,
          signer_uuid: signerStatus.signer_uuid,
          username,
        });
        console.log(`SignupTask completed for user ${username}, FID: ${signerStatus.fid}.`);
      } catch (taskError) {
        console.error(`SignupTask failed for user ${username}, FID: ${signerStatus.fid}, signer_uuid: ${signer_uuid}:`, taskError);
        // The client will still receive the "approved" status from Neynar.
        // The task failure is logged server-side.
        // Consider if this scenario needs more specific error handling communicated to the client.
      }
    }
    return NextResponse.json(signerStatus, { status: 200 });
  } catch (error) {
    console.error(`Error fetching signer status for ${signer_uuid} or processing signup for user ${username}:`, error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    // Neynar API might return specific errors for "not found" etc., which could be handled more gracefully.
    // For example, if Neynar returns 404 for a signer_uuid, this might not be a 500 server error.
    // The neynarClient.lookupSigner might throw an error that includes a status code.
    // For now, a general 500 is returned for simplicity.
    return NextResponse.json({ error: "Failed to get signer status or process signup.", details: errorMessage }, { status: 500 });
  }
}
