"use client";

import { PropsWithChildren, useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import type { ScreenRouteKey } from "@/lib/generator/types";
import { supabaseClient } from "@/lib/supabaseClient";

type RouteAuthGateProps = PropsWithChildren<{
  routeKey: ScreenRouteKey;
}>;

const ROUTE_COPY: Partial<Record<ScreenRouteKey, { title: string; subtitle: string }>> = {};

export function RouteAuthGate({ routeKey, children }: RouteAuthGateProps) {
  const [session, setSession] = useState<Session | null>(null);
  const isAuthEnabled = useMemo(
    () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    []
  );
  const [isLoading, setIsLoading] = useState(isAuthEnabled);

  const syncPlatformUser = useCallback(async (accessToken: string) => {
    await fetch("/api/platform/users/sync", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!isAuthEnabled) return;

    const boot = async () => {
      const { data } = await supabaseClient.auth.getSession();
      setSession(data.session);
      if (data.session?.access_token) {
        await syncPlatformUser(data.session.access_token);
      }
      setIsLoading(false);
    };
    void boot();

    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.access_token) {
        void syncPlatformUser(nextSession.access_token);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [isAuthEnabled, syncPlatformUser]);

  const signInWithGoogle = useCallback(async () => {
    const redirectTo =
      typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}${window.location.search}` : undefined;

    await supabaseClient.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
      },
    });
  }, []);

  if (!isAuthEnabled) return <>{children}</>;

  if (isLoading) {
    return (
      <main className="min-h-dvh px-6 py-10 md:flex md:items-center md:justify-center">
        <div className="mx-auto w-full max-w-lg rounded-3xl border p-6 sm:p-8" style={{ borderColor: "var(--cw-border)", background: "var(--cw-surface)" }}>
          <p className="text-sm animate-pulse" style={{ color: "var(--cw-muted)" }}>
            Перевіряємо сесію...
          </p>
        </div>
      </main>
    );
  }

  if (session?.user) return <>{children}</>;

  const copy = ROUTE_COPY[routeKey] ?? {
    title: "Увійдіть, щоб продовжити",
    subtitle: "Ця сторінка доступна після авторизації.",
  };

  return (
    <main className="min-h-dvh px-6 py-10 md:flex md:items-center md:justify-center">
      <section
        className="mx-auto w-full max-w-lg rounded-3xl border p-6 sm:p-8"
        style={{
          borderColor: "var(--cw-border)",
          background: "color-mix(in srgb, var(--cw-surface) 92%, #ffffff 8%)",
        }}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--cw-muted)" }}>
          CenterWay • Access
        </p>
        <h1 className="mt-2 text-2xl font-bold" style={{ color: "var(--cw-text)" }}>
          {copy.title}
        </h1>
        <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--cw-muted)" }}>
          {copy.subtitle}
        </p>
        <button
          type="button"
          onClick={() => {
            void signInWithGoogle();
          }}
          className="cw-btn-primary mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 px-4 py-3 text-sm font-semibold"
        >
          Увійти через Google
        </button>
      </section>
    </main>
  );
}
