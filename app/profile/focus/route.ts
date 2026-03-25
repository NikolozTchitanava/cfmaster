import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/session";
import { updateUserFocus } from "@/lib/store";
import type { Focus } from "@/lib/types";
import { withMessage } from "@/lib/utils";

const allowedFocuses = new Set<Focus>(["warmup", "steady", "stretch"]);

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL(withMessage("/", "error", "Log in to adjust your focus.", "auth"), request.url), { status: 303 });
  }

  const formData = await request.formData();
  const focus = String(formData.get("focus") ?? "") as Focus;
  if (!allowedFocuses.has(focus)) {
    return NextResponse.redirect(new URL(withMessage("/profile", "error", "Pick a valid daily focus."), request.url), { status: 303 });
  }

  await updateUserFocus(user.id, focus);
  return NextResponse.redirect(new URL(withMessage("/profile", "success", `Daily focus updated to ${focus}.`), request.url), { status: 303 });
}
