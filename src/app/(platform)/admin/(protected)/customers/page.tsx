import { listCustomers } from "@/lib/admin/customers";

import { CustomersList } from "./CustomersList";

/** First page on the server, the rest through the API from the list itself. */
export default async function CustomersPage() {
  const initial = await listCustomers({ limit: 50, offset: 0 });
  return <CustomersList initial={initial} />;
}
