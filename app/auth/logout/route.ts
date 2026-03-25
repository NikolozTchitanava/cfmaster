import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { clearSessionCookie } from "@/lib/session";
import { deleteSession } from "@/lib/store";
import { SESSION_COOKIE_NAME, withMessage } from "@/lib/utils";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    await deleteSession(token).catch(() => undefined);
  }

  const response = NextResponse.redirect(new URL(withMessage("/", "success", "You signed out."), request.url), { status: 303 });
  clearSessionCookie(response);
  return response;
}
