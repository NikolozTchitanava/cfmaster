import { NextResponse } from "next/server";

import { addBattleWrongAttempt } from "@/lib/battle-store";
import { getCurrentUser } from "@/lib/session";
import { withMessage } from "@/lib/utils";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL(withMessage("/", "error", "Log in to record battle attempts.", "auth"), request.url), {
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
    await addBattleWrongAttempt({
      battleId,
      userId: user.id,
      problemKey
    });
    return NextResponse.redirect(new URL(withMessage(`/battle?battle=${encodeURIComponent(battleId)}`, "success", "Wrong attempt recorded."), request.url), {
      status: 303
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not record the wrong attempt.";
    return NextResponse.redirect(new URL(withMessage(`/battle?battle=${encodeURIComponent(battleId)}`, "error", message), request.url), {
      status: 303
    });
  }
}
