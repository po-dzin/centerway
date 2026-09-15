"use client";

import Link from "next/link";
import { useState } from "react";

import offerStyles from "@/components/platform/PlatformOfferStyles";
import styles from "@/components/platform/PlatformOfferCommerce.module.css";
import { SUPPORT_BOT_URL } from "@/lib/telegram/tgSupportBotCopy";

type State = "ask" | "unsubscribed" | "resubscribed" | "error";

export function UnsubscribeActions({ token, maskedAddress }: { token: string | null; maskedAddress: string | null }) {
  const [state, setState] = useState<State>("ask");
  const [busy, setBusy] = useState(false);

  if (!token || !maskedAddress) {
    return (
      <>
        <p className={offerStyles.label}>Розсилка CenterWay</p>
        <h1 className={offerStyles.title}>Посилання не спрацювало</h1>
        <p className={offerStyles.lead}>
          Можливо, поштова програма обрізала його. Напишіть нам, і ми приберемо вашу адресу з розсилки вручну.
        </p>
        <div className={styles.statusActions}>
          <a className={styles.statusPrimaryAction} href={SUPPORT_BOT_URL} target="_blank" rel="noopener noreferrer">
            Написати в підтримку
          </a>
        </div>
      </>
    );
  }

  const act = async (action: "unsubscribe" | "resubscribe") => {
    setBusy(true);
    try {
      const res = await fetch("/api/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ t: token, action }),
      });
      setState(res.ok ? (action === "unsubscribe" ? "unsubscribed" : "resubscribed") : "error");
    } catch {
      setState("error");
    } finally {
      setBusy(false);
    }
  };

  const copy = {
    ask: {
      title: "Відписатися від листів?",
      lead: `Ми більше не надсилатимемо розсилку на ${maskedAddress}. Листи про ваші оплати й доступ до курсів приходитимуть і далі.`,
    },
    unsubscribed: {
      title: "Ви відписані",
      lead: `Адресу ${maskedAddress} прибрано з розсилки. Якщо це сталося випадково, підписку можна повернути.`,
    },
    resubscribed: {
      title: "Підписку повернено",
      lead: `Листи CenterWay знову надходитимуть на ${maskedAddress}.`,
    },
    error: {
      title: "Не вдалося зберегти",
      lead: "Спробуйте ще раз за хвилину або напишіть нам, і ми відпишемо вас вручну.",
    },
  }[state];

  return (
    <>
      <p className={offerStyles.label}>Розсилка CenterWay</p>
      <h1 className={offerStyles.title}>{copy.title}</h1>
      <p className={offerStyles.lead} aria-live="polite">
        {copy.lead}
      </p>
      <div className={styles.statusActions}>
        {state === "ask" || state === "error" ? (
          <button type="button" className={styles.statusPrimaryAction} disabled={busy} onClick={() => act("unsubscribe")}>
            Відписатися
          </button>
        ) : state === "unsubscribed" ? (
          <button type="button" className={styles.statusSecondaryAction} disabled={busy} onClick={() => act("resubscribe")}>
            Повернути підписку
          </button>
        ) : null}
        <Link className={styles.statusSecondaryAction} href="/">
          На головну
        </Link>
      </div>
    </>
  );
}
