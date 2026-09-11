import { serverSession } from "@/lib/auth/server-session";
import { mutateStore } from "@/lib/store";
import type { PushSubscriptionRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = serverSession(request);
  if (session?.role !== "parent") {
    return Response.json({ error: "Inicia sesión como familia." }, { status: 401 });
  }
  try {
    const body = (await request.json().catch(() => ({}))) as {
      action?: "subscribe" | "unsubscribe";
      subscription?: {
        endpoint?: string;
        keys?: { p256dh?: string; auth?: string };
      };
    };
    const endpoint = body.subscription?.endpoint?.trim();
    if (!endpoint) throw new Error("Falta la suscripción push.");

    if (body.action === "unsubscribe") {
      return Response.json(
        await mutateStore((store) => {
          store.removePushEndpoints([endpoint]);
          return store.snapshot();
        }),
      );
    }

    const p256dh = body.subscription?.keys?.p256dh?.trim();
    const auth = body.subscription?.keys?.auth?.trim();
    if (!p256dh || !auth) throw new Error("La suscripción push está incompleta.");

    const record: PushSubscriptionRecord = {
      endpoint,
      keys: { p256dh, auth },
      createdAt: new Date().toISOString(),
      userAgent: request.headers.get("user-agent") ?? undefined,
    };

    return Response.json(
      await mutateStore((store) => {
        store.upsertPushSubscription(record);
        return store.snapshot();
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo guardar la suscripción.";
    return Response.json({ error: message }, { status: 400 });
  }
}
