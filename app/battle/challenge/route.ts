import { NextResponse } from "next/server";

import { createBattleChallenge, parseBattleLoadout } from "@/lib/battle-store";
import { getCurrentUser } from "@/lib/session";
import { withMessage } from "@/lib/utils";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL(withMessage("/", "error", "Log in to send a battle challenge.", "auth"), request.url), {
      status: 303
    });
  }
  const formData = await request.formData();
  const opponentIdentity = String(formData.get("opponentIdentity") ?? "").trim();

  if (!opponentIdentity) {
    return NextResponse.redirect(new URL(withMessage("/battle", "error", "Choose a registered opponent handle or email."), request.url), {
      status: 303
    });
  }

  try {
    await createBattleChallenge({
      challengerUserId: user.id,
      opponentIdentity,
      loadout: parseBattleLoadout(formData)
    });

    return NextResponse.redirect(new URL(withMessage("/battle", "success", "Battle challenge sent."), request.url), { status: 303 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create that battle.";
    return NextResponse.redirect(new URL(withMessage("/battle", "error", message), request.url), { status: 303 });
  }
}
