import { pushFriendPickupDelivered } from "@/lib/friend-push";
import { mutateStore, readSnapshot } from "@/lib/store";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { staffName?: string };
    const before = await readSnapshot();
    const friendIds = before.requests
      .filter(
        (item) =>
          item.tripId === id &&
          item.authorization &&
          item.status !== "cancelled" &&
          item.status !== "delivered",
      )
      .map((item) => item.studentId);
    const snapshot = await mutateStore((store) => store.deliverTrip(id, body.staffName));
    await pushFriendPickupDelivered(snapshot, id, friendIds);
    return Response.json(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo entregar a la familia.";
    return Response.json({ error: message }, { status: 400 });
  }
}
