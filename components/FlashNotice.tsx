"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { getSearchParam } from "@/lib/utils";

function FlashNoticeBody() {
  const searchParams = useSearchParams();
  const message = getSearchParam(searchParams.get("message") ?? undefined);
  const type = getSearchParam(searchParams.get("type") ?? undefined);

  if (!message) {
    return null;
  }

  return <div className={`flash flash-${type === "success" ? "success" : "error"}`}>{message}</div>;
}

export function FlashNotice() {
  return (
    <Suspense fallback={null}>
      <FlashNoticeBody />
    </Suspense>
  );
}
