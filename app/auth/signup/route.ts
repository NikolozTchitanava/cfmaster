import { NextResponse } from "next/server";

import { MissingDatabaseConfigError } from "@/lib/db";
import { hashPassword } from "@/lib/security";
import { setSessionCookie } from "@/lib/session";
import { createSession, createUserAccount } from "@/lib/store";
import { normalizeEmail, normalizeHandle, withMessage } from "@/lib/utils";

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const handle = normalizeHandle(String(formData.get("handle") ?? ""));
  const password = String(formData.get("password") ?? "");

  if (!email || !handle || !password) {
    return NextResponse.redirect(new URL(withMessage("/", "error", "Handle, email, and password are required.", "auth"), request.url), { status: 303 });
  }

  if (password.length < 6) {
    return NextResponse.redirect(new URL(withMessage("/", "error", "Use a password with at least 6 characters.", "auth"), request.url), { status: 303 });
  }

  try {
    const user = await createUserAccount({
      email,
      handle,
      passwordHash: hashPassword(password)
    });
    const session = await createSession(user.id);
    const response = NextResponse.redirect(new URL(withMessage("/profile", "success", "Your account is live and your handle has been synced."), request.url), { status: 303 });
    setSessionCookie(response, session.token, session.expiresAt);
    return response;
  } catch (error) {
    const message =
      error instanceof MissingDatabaseConfigError
        ? "Add DATABASE_URL before using signup on Vercel or locally."
        : error instanceof Error
          ? error.message
          : "Could not create the account.";

    return NextResponse.redirect(new URL(withMessage("/", "error", message, "auth"), request.url), { status: 303 });
  }
}
