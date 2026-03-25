import { NextResponse } from "next/server";

import { parseBattleLoadout, respondToBattleChallenge } from "@/lib/battle-store";
import { getCurrentUser } from "@/lib/session";
import { withMessage } from "@/lib/utils";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL(withMessage("/", "error", "Log in to answer a battle challenge.", "auth"), request.url), {
      status: 303
    });
  }
  const formData = await request.formData();
  const battleId = String(formData.get("battleId") ?? "");
  const decision = String(formData.get("decision") ?? "accept");

  if (!battleId) {
    return NextResponse.redirect(new URL(withMessage("/battle", "error", "Missing battle id."), request.url), { status: 303 });
  }

  try {
    await respondToBattleChallenge({
      battleId,
      userId: user.id,
      accept: decision !== "decline",
      loadout: decision === "decline" ? undefined : parseBattleLoadout(formData)
    });

    return NextResponse.redirect(
      new URL(withMessage("/battle", "success", decision === "decline" ? "Battle request declined." : "Battle accepted. Duel is live."), request.url),
      { status: 303 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not respond to that battle.";
    return NextResponse.redirect(new URL(withMessage("/battle", "error", message), request.url), { status: 303 });
  }
}
