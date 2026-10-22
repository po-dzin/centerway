/**
 * Карта сфер — the database half. One row per account in
 * `profile_sphere_maps`, read and written through the service role for the
 * signed-in caller only: the route resolves the caller and passes the id, and
 * nothing here takes an id from a request body.
 *
 * The client sends the whole map on every save (it is seven small rows), so a
 * write is an upsert of the full state plus the history recomputed from what
 * was stored. Read-modify-write is acceptable here: a map has one writer, its
 * owner, and the worst a race between two of their own tabs can do is merge
 * two same-day snapshots into one.
 */

import type { Database } from "@/lib/db/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  nextSphereHistory,
  nowScores,
  readStoredSphereMap,
  type SphereMap,
  type SphereMapInput,
} from "./sphereMap";

export type SphereMapDb = SupabaseClient<Database>;

const COLUMNS = "spheres, focus, history, updated_at";

export async function getSphereMap(db: SphereMapDb, authUserId: string): Promise<SphereMap> {
  const { data, error } = await db
    .from("profile_sphere_maps")
    .select(COLUMNS)
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return readStoredSphereMap(data);
}

export async function saveSphereMap(
  db: SphereMapDb,
  authUserId: string,
  input: SphereMapInput,
  at: Date = new Date(),
): Promise<SphereMap> {
  const current = await getSphereMap(db, authUserId);
  const history = nextSphereHistory(current.history, nowScores(input.spheres), at, input.phase);

  const { data, error } = await db
    .from("profile_sphere_maps")
    .upsert(
      {
        auth_user_id: authUserId,
        spheres: input.spheres,
        focus: input.focus,
        history,
      },
      { onConflict: "auth_user_id" },
    )
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return readStoredSphereMap(data);
}
