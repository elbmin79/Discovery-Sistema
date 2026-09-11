import { pushFriendPickupDelivered } from "@/lib/friend-push";
import { mutateStore, readSnapshot } from "@/lib/store";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      action: "advance" | "undo" | "complete";
      staffName?: string;
    };
    const before = await readSnapshot();
    const friendIds =
      body.action === "complete"
        ? before.requests
            .filter(
              (item) =>
                item.tripId === id &&
                item.authorization &&
                item.status !== "cancelled" &&
                item.status !== "delivered",
            )
            .map((item) => item.studentId)
        : [];
    const snapshot = await mutateStore((store) => store.setTripStatus(id, body.action, body.staffName));
    if (body.action === "complete" && friendIds.length) {
      await pushFriendPickupDelivered(snapshot, id, friendIds);
    }
    return Response.json(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo actualizar la familia.";
    return Response.json({ error: message }, { status: 400 });
  }
}
