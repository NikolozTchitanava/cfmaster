import { getSearchParam } from "@/lib/utils";

type FlashNoticeProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export function FlashNotice({ searchParams }: FlashNoticeProps) {
  const message = getSearchParam(searchParams?.message);
  const type = getSearchParam(searchParams?.type);

  if (!message) {
    return null;
  }

  return <div className={`flash flash-${type === "success" ? "success" : "error"}`}>{message}</div>;
}
