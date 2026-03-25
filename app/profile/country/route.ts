import { NextResponse } from "next/server";

import { resolveCountryMetadata } from "@/lib/geo";
import { requireCurrentUser } from "@/lib/session";
import { updateUserCountry } from "@/lib/store";
import { withMessage } from "@/lib/utils";

export async function POST(request: Request) {
  const user = await requireCurrentUser();
  const formData = await request.formData();
  const rawCountry = String(formData.get("country") ?? "").trim();
  const resolved = resolveCountryMetadata(rawCountry);

  await updateUserCountry(user.id, resolved.country ?? (rawCountry || null));

  return NextResponse.redirect(
    new URL(
      withMessage(
        "/profile",
        "success",
        resolved.country ? `Country set to ${resolved.country}.` : "Country updated."
      ),
      request.url
    ),
    { status: 303 }
  );
}
