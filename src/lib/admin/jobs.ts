import { serviceClient } from "@/lib/db/server";

/** The background-job queue as the admin sees it; shared by the route and the page. */
export type JobStatus = "pending" | "running" | "success" | "failed";
export type JobListItem = {
  id: string;
  type: string;
  payload: unknown;
  status: JobStatus;
  error_text: string | null;
  attempts: number;
  run_at: string;
  created_at: string;
  updated_at: string;
};
export type JobsPage = { data: JobListItem[]; count: number };

export async function listJobs(input: { q?: string; status?: string; type?: string; limit: number; offset: number }): Promise<JobsPage> {
  const q = input.q?.trim() ?? "";
  let query = serviceClient()
    .from("jobs")
    .select("*", { count: "exact" })
    .range(input.offset, input.offset + input.limit - 1)
    .order("created_at", { ascending: false });
  if (input.status) query = query.eq("status", input.status);
  if (input.type) query = query.eq("type", input.type);
  if (q) query = query.or(`error_text.ilike.%${q}%,payload::text.ilike.%${q}%`);
  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return {
    data: (data ?? []).map((row) => {
      // The columns are nullable in the schema; the list treats them as dates.
      const createdAt = row.created_at ?? new Date(0).toISOString();
      return {
        id: String(row.id),
        type: row.type,
        payload: row.payload,
        status: row.status as JobStatus,
        error_text: row.error_text ?? null,
        attempts: row.attempts ?? 0,
        run_at: row.run_at ?? createdAt,
        created_at: createdAt,
        updated_at: row.updated_at ?? createdAt,
      };
    }),
    count: count ?? 0,
  };
}
