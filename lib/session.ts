import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { cache } from "react";

import { MissingDatabaseConfigError } from "@/lib/db";
import { getSessionUser } from "@/lib/store";
import { SESSION_COOKIE_NAME, withMessage } from "@/lib/utils";

export const getCurrentUser = cache(async () => {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) {
      return null;
    }

    return await getSessionUser(token);
  } catch (error) {
    if (error instanceof MissingDatabaseConfigError) {
      return null;
    }

    throw error;
  }
});

export async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect(withMessage("/", "error", "Log in to open your profile.", "auth"));
  }

  return user;
}

export function setSessionCookie(response: NextResponse, token: string, expiresAt: Date): void {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0)
  });
}
