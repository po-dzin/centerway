/**
 * Notification dispatcher for learning reminders.
 *
 * Reminders are addressed to a LEARNER, not to Telegram. The channel is looked
 * up on the profile, so adding email (the EN expansion, docs §3A.2) or web push
 * (PWA) means registering a sender here — not rewriting the reminder logic.
 *
 * H1 registers exactly one channel: telegram. `email` and `webpush` are declared
 * so the shape is real, and refuse to pretend they delivered anything.
 */

import { adminClient } from "@/lib/auth/adminClient";
import { surfaceUrl } from "@/lib/surfaces/catalog";
import { sendTelegramMessage } from "@/lib/tg";

export type NotificationChannel = "telegram" | "email" | "webpush";

export type LearnerNotification = {
  authUserId: string;
  /** Short plain-text body. Channel senders may decorate it. */
  text: string;
  /** Site-relative path to the thing being nudged; senders absolutise it. */
  href?: string;
};

export type DeliveryResult =
  | { delivered: true; channel: NotificationChannel }
  | { delivered: false; channel: NotificationChannel | null; reason: string };

type ChannelSender = (notification: LearnerNotification, address: string) => Promise<void>;

const senders: Partial<Record<NotificationChannel, ChannelSender>> = {
  telegram: async (notification, chatId) => {
    // Absolute, always. `href` is written site-relative by the callers (that is
    // the right shape for a link the web app also renders), and Telegram does
    // not linkify "/learn/way21" — it prints it as text. Every reminder we have
    // ever queued points at a lesson, so this is the difference between a nudge
    // that is one tap away and one that is a path the reader has to retype.
    const body = notification.href
      ? `${notification.text}\n\n${surfaceUrl(notification.href)}`
      : notification.text;
    await sendTelegramMessage(chatId, body);
  },
  // email / webpush intentionally unimplemented on H1 — see file header.
};

/**
 * Resolves which channels a learner accepts and where to reach them.
 * Telegram address comes from `customers.tg_id`, the identity the funnel already owns.
 */
async function resolveChannels(authUserId: string): Promise<Array<{ channel: NotificationChannel; address: string }>> {
  const db = adminClient();

  const [{ data: profile }, { data: customer }] = await Promise.all([
    db.from("platform_users").select("notification_channels").eq("auth_user_id", authUserId).maybeSingle(),
    db.from("customers").select("tg_id").eq("auth_user_id", authUserId).maybeSingle(),
  ]);

  const preferred = (profile?.notification_channels ?? ["telegram"]) as NotificationChannel[];
  const resolved: Array<{ channel: NotificationChannel; address: string }> = [];

  for (const channel of preferred) {
    if (channel === "telegram" && customer?.tg_id) {
      resolved.push({ channel, address: String(customer.tg_id) });
    }
    // Other channels resolve to nothing until their sender exists.
  }

  return resolved;
}

/**
 * Sends to the first channel that can actually deliver.
 *
 * Not a fan-out: a learner should get one nudge, not one per channel.
 */
export async function notifyLearner(notification: LearnerNotification): Promise<DeliveryResult> {
  const channels = await resolveChannels(notification.authUserId);

  if (channels.length === 0) {
    return { delivered: false, channel: null, reason: "no_reachable_channel" };
  }

  for (const { channel, address } of channels) {
    const sender = senders[channel];
    if (!sender) continue;

    try {
      await sender(notification, address);
      return { delivered: true, channel };
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown_error";
      return { delivered: false, channel, reason: message };
    }
  }

  return { delivered: false, channel: null, reason: "no_sender_for_preferred_channels" };
}
