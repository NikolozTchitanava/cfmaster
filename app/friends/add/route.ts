import { NextResponse } from "next/server";

import { DATABASE_ENV_HELP, MissingDatabaseConfigError } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { addFriendOrTrackedHandle } from "@/lib/store";
import { withMessage } from "@/lib/utils";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL(withMessage("/", "error", "Log in to manage friends.", "auth"), request.url), { status: 303 });
  }

  const formData = await request.formData();
  const identifier = String(formData.get("identifier") ?? "");

  try {
    const message = await addFriendOrTrackedHandle(user.id, identifier);
    return NextResponse.redirect(new URL(withMessage("/friends", "success", message), request.url), { status: 303 });
  } catch (error) {
    const message =
      error instanceof MissingDatabaseConfigError
        ? DATABASE_ENV_HELP
        : error instanceof Error
          ? error.message
          : "Could not add that friend or handle.";

    return NextResponse.redirect(new URL(withMessage("/friends", "error", message), request.url), { status: 303 });
  }
}
