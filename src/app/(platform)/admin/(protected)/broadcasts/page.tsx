import { staffFromCookies } from "@/lib/auth/serverSession";
import { listBroadcasts } from "@/lib/broadcasts/server";

import { BroadcastsHome } from "./BroadcastsHome";

/** First page of campaigns on the server; the base tab loads through the API. */
export default async function BroadcastsPage() {
  const [staff, initial] = await Promise.all([staffFromCookies(), listBroadcasts({ limit: 50, offset: 0 })]);
  return <BroadcastsHome initial={initial} canWrite={staff?.role === "admin"} />;
}
