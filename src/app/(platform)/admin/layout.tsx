import type { ReactNode } from "react";

import { I18nProvider } from "@/components/I18nProvider";

import { AdminShell } from "./AdminShell";

/**
 * The admin root: the chrome for the sign-in page and for every protected
 * page alike. The staff check is one level down, in `(protected)/layout.tsx`,
 * because the index page here is exactly the page a non-admin must be able
 * to reach — it is where they sign in, and where they are told no.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <AdminShell>{children}</AdminShell>
    </I18nProvider>
  );
}
