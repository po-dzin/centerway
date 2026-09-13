"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useI18n } from "@/components/I18nProvider";
import { useSession } from "@/components/auth/SessionProvider";
import { SignInOptions } from "@/components/auth/SignInOptions";
import controls from "@/components/admin/AdminControls.module.css";
import gate from "@/components/admin/AdminGate.module.css";
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
 * same move in reverse. The email code arrives the same way: a session appears
 * in this tab, and the same refresh answers it.
 *
 * TWO DOORS, LIKE EVERY OTHER GATE (2026-09-13). This card offered Google and
 * nothing else, while the cabinet, the builder and the account menu all offer
 * the email code first. Entitlement is matched by verified email, and an
 * operator's address is not always a Google account — nor is there a Google
 * provider on the local stack, which is how this was found: the panel was the
 * one surface in the product with no way in from a local build.
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
      <div className={gate.stageWide}>
        <div className={gate.cardCentered}>
          <h2 className={gate.title}>{t("admin_access_denied_title")}</h2>
          <p className={gate.subtitle}>{t("admin_access_denied_subtitle")}</p>
          <p className={gate.who}>{signedInAs}</p>
          <button onClick={signOut} className={`${controls.actionFill} cw-surface-2`}>
            {t("menu_signout")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={gate.stageNarrow}>
      <div className={gate.intro}>
        <h2 className={gate.title}>{t("login_title")}</h2>
        <p className={gate.subtitle}>{t("login_subtitle")}</p>
      </div>

      <div className={gate.card}>
        <div className={gate.cardHead}>
          <h3 className={gate.cardTitle}>{t("login_card_title")}</h3>
          <p className={gate.cardNote}>{t("login_card_subtitle")}</p>
        </div>

        <SignInOptions
          googleLabel={t("login_btn")}
          onGoogle={() => void handleSignIn()}
        />
      </div>
    </div>
  );
}
