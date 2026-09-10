"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useI18n } from "@/components/I18nProvider";
import { useSession } from "@/components/auth/SessionProvider";
import { supabaseClient } from "@/lib/supabaseClient";

/**
 * What /admin shows a person who is not (yet) staff: the sign-in card, or the
 * refusal with their address and a way out. The SERVER decided which — see
 * page.tsx — so there is no loading state here and no role fetch.
 *
 * The one job left to the client is timing. After Google returns, the browser
 * client exchanges the code and writes the cookies AFTER this page has been
 * served, so the server saw no session and rendered the card. When the
 * session appears, `router.refresh()` re-runs the server page, which now
 * reads the cookie and redirects staff or shows the refusal. Sign-out is the
 * same move in reverse.
 */
export function AdminGate({ signedInAs }: { signedInAs: string | null }) {
  const { t } = useI18n();
  const router = useRouter();
  const { status } = useSession();

  useEffect(() => {
    if (status === "signed-in" && !signedInAs) router.refresh();
  }, [status, signedInAs, router]);

  const handleSignIn = async () => {
      await supabaseClient.auth.signInWithOAuth({
          provider: "google",
          options: {
              redirectTo: `${window.location.origin}/admin`,
          },
      });
  };

  if (signedInAs) {
    const signOut = async () => {
      await supabaseClient.auth.signOut();
      router.refresh();
    };
    return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] w-full max-w-md mx-auto">
            <div className="w-full cw-surface border cw-border rounded-2xl cw-shadow p-8 text-center space-y-4">
                <h2 className="cw-page-title">{t("admin_access_denied_title")}</h2>
                <p className="cw-page-subtitle">{t("admin_access_denied_subtitle")}</p>
                <p className="text-sm cw-muted">{signedInAs}</p>
                <button
                    onClick={signOut}
                    className="w-full cw-btn cw-surface-2 font-semibold py-3 px-4"
                >
                    {t("menu_signout")}
                </button>
            </div>
        </div>
    );
  }

  return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] w-full max-w-sm mx-auto">
          <div className="w-full text-center mb-8">
              <h2 className="cw-page-title mb-2">{t("login_title")}</h2>
              <p className="cw-page-subtitle">{t("login_subtitle")}</p>
          </div>

          <div className="w-full cw-surface border cw-border rounded-2xl cw-shadow p-8 transition-colors duration-300">
              <div className="space-y-6">
                  <div className="space-y-1">
                      <h3 className="text-lg font-medium cw-text">{t("login_card_title")}</h3>
                      <p className="text-xs cw-muted">{t("login_card_subtitle")}</p>
                  </div>

                  <button
                      onClick={handleSignIn}
                      className="w-full cw-btn cw-surface-2 font-semibold py-3 px-4 flex items-center justify-center gap-3"
                  >
                      <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                      </svg>
                      {t("login_btn")}
                  </button>
              </div>
          </div>
      </div>
  );
}
