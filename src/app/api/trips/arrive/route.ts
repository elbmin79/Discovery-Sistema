import { mutateStore } from "@/lib/store";
import { storeArrivalPhoto } from "@/lib/arrival-photos";
import type { ArrivalVia } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      code?: string;
      token?: string;
      photo?: string;
      via?: ArrivalVia;
    };
    const key = body.code || body.token;
    if (!key) {
      return Response.json({ error: "Ingresa el código de llegada." }, { status: 400 });
    }
    return Response.json(
      await mutateStore(async (store) => {
        const snapshot = store.arriveByCode(key, { via: body.via });
        const trip = snapshot.trips.find((item) => item.code === key || item.qrToken === key)!;
        const photo = await storeArrivalPhoto(body.photo, trip.id, trip.arrivedAt!);
        return photo ? store.setArrivalPhoto(trip.id, photo) : snapshot;
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo registrar la llegada.";
    return Response.json({ error: message }, { status: 400 });
  }
}
