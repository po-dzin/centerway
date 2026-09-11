import { listJobs } from "@/lib/admin/jobs";

import { JobsList } from "./JobsList";

export default async function JobsPage() {
  const initial = await listJobs({ limit: 50, offset: 0 });
  return <JobsList initial={initial} />;
}
