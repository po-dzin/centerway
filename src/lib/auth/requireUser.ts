import { verifyBearer } from "@/lib/db/server";

/** The user behind a Bearer header, or null. See `verifyBearer`. */
export async function requireUserFromBearer(authHeader: string | null) {
  return verifyBearer(authHeader);
}
