"use client";

/**
 * The one place a finished sign-in is sent back where it began — on every
 * platform page, because a Google round trip may land on any of them. See
 * `useSignInReturn`.
 */

import { useSession } from "@/components/auth/SessionProvider";
import { useSignInReturn } from "@/components/auth/useSignInReturn";

export function SignInReturn() {
  const { session } = useSession();
  useSignInReturn(session);
  return null;
}
