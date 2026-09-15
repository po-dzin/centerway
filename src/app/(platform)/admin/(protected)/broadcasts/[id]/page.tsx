import { notFound } from "next/navigation";

import { staffFromCookies } from "@/lib/auth/serverSession";
import { isUuid } from "@/lib/broadcasts/http";
import { getBroadcast } from "@/lib/broadcasts/server";

import { BroadcastEditor } from "./BroadcastEditor";

export default async function BroadcastPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [staff, found] = await Promise.all([staffFromCookies(), getBroadcast(id)]);
  if (!found) notFound();
  return <BroadcastEditor initial={found} canWrite={staff?.role === "admin"} />;
}
