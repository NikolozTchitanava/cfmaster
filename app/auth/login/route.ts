import { NextResponse } from "next/server";

import { MissingDatabaseConfigError } from "@/lib/db";
import { verifyPassword } from "@/lib/security";
import { setSessionCookie } from "@/lib/session";
import { createSession, getUserWithPasswordByIdentity } from "@/lib/store";
import { withMessage } from "@/lib/utils";

export async function POST(request: Request) {
  const formData = await request.formData();
  const identity = String(formData.get("identity") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!identity || !password) {
    return NextResponse.redirect(new URL(withMessage("/", "error", "Enter your handle or email and password.", "auth"), request.url), { status: 303 });
  }

  try {
    const user = await getUserWithPasswordByIdentity(identity);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.redirect(new URL(withMessage("/", "error", "Could not log in with that identity and password.", "auth"), request.url), { status: 303 });
    }

    const session = await createSession(user.id);
    const response = NextResponse.redirect(new URL(withMessage("/profile", "success", "Welcome back."), request.url), { status: 303 });
    setSessionCookie(response, session.token, session.expiresAt);
    return response;
  } catch (error) {
    const message =
      error instanceof MissingDatabaseConfigError
        ? "Add DATABASE_URL before using login on Vercel or locally."
        : error instanceof Error
          ? error.message
          : "Could not log in.";

    return NextResponse.redirect(new URL(withMessage("/", "error", message, "auth"), request.url), { status: 303 });
  }
}
