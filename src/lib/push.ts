import webpush from "web-push";
import type { PushSubscriptionRecord, Snapshot } from "./types";

/** Claves demo (rotables con VAPID_* en env). */
const DEMO_PUBLIC =
  "BP6gOtTwpsE1lMYRLzfpw9xpMCYxxHlh2oviGLt3iACH_udkmIx2LnnMvqROdxRI333x4MeuSRa97jHNv2wSsn8";
const DEMO_PRIVATE = "TUjovgdMrjHLk5v-z6cF2sfEjwVfZcUdGYnM8IfsoAs";

export function vapidPublicKey() {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || DEMO_PUBLIC;
}

function vapidPrivateKey() {
  return process.env.VAPID_PRIVATE_KEY?.trim() || DEMO_PRIVATE;
}

function vapidSubject() {
  return process.env.VAPID_SUBJECT?.trim() || "mailto:admin@example.com";
}

let configuredSubject: string | null = null;

function ensureVapid() {
  const subject = vapidSubject();
  if (configuredSubject === subject) return;
  webpush.setVapidDetails(subject, vapidPublicKey(), vapidPrivateKey());
  configuredSubject = subject;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  kind?: "announcement" | "calendar";
};

export async function sendPushToSubscriptions(
  subscriptions: PushSubscriptionRecord[],
  payload: PushPayload,
) {
  if (!subscriptions.length) return [] as string[];
  ensureVapid();
  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/familia",
    tag: payload.tag ?? payload.kind ?? "discovery",
    kind: payload.kind ?? "announcement",
    icon: "/brand/favicon-d.png",
    badge: "/brand/favicon-d.png",
  });
  const expired: string[] = [];
  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: sub.keys,
          },
          body,
          { TTL: 60 * 60 * 12, urgency: "high" },
        );
      } catch (error) {
        const status = (error as { statusCode?: number; body?: string; message?: string }).statusCode;
        if (status === 404 || status === 410) expired.push(sub.endpoint);
        else {
          console.error(
            "Fallo al enviar push",
            status,
            (error as { body?: string; message?: string }).body ||
              (error as { message?: string }).message ||
              error,
          );
        }
      }
    }),
  );
  return expired;
}

export function upsertPushSubscription(
  snapshot: Snapshot,
  record: PushSubscriptionRecord,
) {
  const list = [...(snapshot.pushSubscriptions ?? [])].filter((item) => item.endpoint !== record.endpoint);
  list.unshift(record);
  snapshot.pushSubscriptions = list.slice(0, 200);
}

export function removePushSubscriptions(snapshot: Snapshot, endpoints: string[]) {
  if (!endpoints.length) return;
  const drop = new Set(endpoints);
  snapshot.pushSubscriptions = (snapshot.pushSubscriptions ?? []).filter((item) => !drop.has(item.endpoint));
}
