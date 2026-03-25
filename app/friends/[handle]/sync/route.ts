import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/session";
import { refreshFriendSnapshot } from "@/lib/store";
import { withMessage } from "@/lib/utils";

type RouteContext = {
  params: Promise<{ handle: string }>;
};

export async function POST(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL(withMessage("/", "error", "Log in to refresh friend handles.", "auth"), request.url), { status: 303 });
  }

  const { handle } = await params;

  try {
    const refreshedHandle = await refreshFriendSnapshot(user.id, handle);
    return NextResponse.redirect(
      new URL(withMessage(`/friends/${encodeURIComponent(refreshedHandle)}`, "success", "Friend activity refreshed."), request.url),
      { status: 303 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not refresh that handle.";
    return NextResponse.redirect(new URL(withMessage("/friends", "error", message), request.url), { status: 303 });
  }
}
