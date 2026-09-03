import { mutateStore } from "@/lib/store";
import type { CreateLatePickupInput } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as CreateLatePickupInput | null;
    if (!body || !body.guardianId) {
      return Response.json({ error: "Faltan datos del aviso." }, { status: 400 });
    }
    return Response.json(await mutateStore((store) => store.createLatePickup(body)));
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo enviar el aviso.";
    return Response.json({ error: message }, { status: 400 });
  }
}
