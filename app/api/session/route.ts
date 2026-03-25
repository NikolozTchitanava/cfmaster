import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/session";

export async function GET() {
  const user = await getCurrentUser();

  return NextResponse.json({
    user: user
      ? {
          id: user.id,
          handle: user.handle
        }
      : null
  });
}
