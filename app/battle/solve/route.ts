import { NextResponse } from "next/server";

import { markBattleAccepted } from "@/lib/battle-store";
import { getCurrentUser } from "@/lib/session";
import { withMessage } from "@/lib/utils";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL(withMessage("/", "error", "Log in to submit battle solves.", "auth"), request.url), {
      status: 303
    });
  }
  const formData = await request.formData();
  const battleId = String(formData.get("battleId") ?? "");
  const problemKey = String(formData.get("problemKey") ?? "");

  if (!battleId || !problemKey) {
    return NextResponse.redirect(new URL(withMessage("/battle", "error", "Missing battle action details."), request.url), { status: 303 });
  }

  try {
    await markBattleAccepted({
      battleId,
      userId: user.id,
      problemKey
    });
    return NextResponse.redirect(new URL(withMessage(`/battle?battle=${encodeURIComponent(battleId)}`, "success", "Accepted solution locked in."), request.url), {
      status: 303
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not record the accepted solution.";
    return NextResponse.redirect(new URL(withMessage(`/battle?battle=${encodeURIComponent(battleId)}`, "error", message), request.url), {
      status: 303
    });
  }
}
