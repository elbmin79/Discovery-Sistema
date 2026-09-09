import { serverSession } from "@/lib/auth/server-session";
import { mutateStore } from "@/lib/store";
import type { CreateLatePickupInput } from "@/lib/types";

export async function POST(request: Request) {
  const session = serverSession(request);
  if (session?.role !== "parent" || !session.guardianId) {
    return Response.json({ error: "Inicia sesión como padre." }, { status: 401 });
  }
  try {
    const body = (await request.json().catch(() => null)) as CreateLatePickupInput | null;
    if (!body || !body.guardianId) {
      return Response.json({ error: "Faltan datos del aviso." }, { status: 400 });
    }
    if (body.guardianId !== session.guardianId) {
      return Response.json({ error: "No puedes enviar avisos de otro tutor." }, { status: 403 });
    }
    return Response.json(await mutateStore((store) => store.createLatePickup(body)));
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo enviar el aviso.";
    return Response.json({ error: message }, { status: 400 });
  }
}
