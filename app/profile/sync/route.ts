import { NextResponse } from "next/server";

import { MissingDatabaseConfigError } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { updateUserSnapshot } from "@/lib/store";
import { withMessage } from "@/lib/utils";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL(withMessage("/", "error", "Log in to sync your profile.", "auth"), request.url), { status: 303 });
  }

  try {
    await updateUserSnapshot(user.id);
    return NextResponse.redirect(new URL(withMessage("/profile", "success", "Fresh Codeforces activity pulled in."), request.url), { status: 303 });
  } catch (error) {
    const message =
      error instanceof MissingDatabaseConfigError
        ? "Add DATABASE_URL before syncing profiles."
        : error instanceof Error
          ? error.message
          : "Could not sync the profile.";

    return NextResponse.redirect(new URL(withMessage("/profile", "error", message), request.url), { status: 303 });
  }
}
