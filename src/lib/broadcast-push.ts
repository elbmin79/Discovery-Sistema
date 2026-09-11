import { mutateStore, readSnapshot } from "@/lib/store";
import { sendPushToSubscriptions, type PushPayload } from "@/lib/push";

export async function broadcastSchoolPush(payload: PushPayload) {
  try {
    const snapshot = await readSnapshot();
    const subscriptions = snapshot.pushSubscriptions ?? [];
    if (!subscriptions.length) return;
    const expired = await sendPushToSubscriptions(subscriptions, payload);
    if (expired.length) {
      await mutateStore((store) => {
        store.removePushEndpoints(expired);
        return store.snapshot();
      });
    }
  } catch (error) {
    console.error("No se pudo enviar push.", error);
  }
}
