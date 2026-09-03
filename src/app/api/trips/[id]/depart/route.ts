import { mutateStore } from "@/lib/store";
import type { DepartureVia } from "@/lib/types";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { via?: DepartureVia; staffName?: string };
    const via: DepartureVia =
      body.via === "tag" || body.via === "parent" || body.via === "staff" ? body.via : "parent";
    return Response.json(await mutateStore((store) => store.closeTrip(id, via, undefined, body.staffName)));
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo cerrar la solicitud.";
    return Response.json({ error: message }, { status: 400 });
  }
}
