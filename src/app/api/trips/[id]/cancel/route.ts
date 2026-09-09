import { serverSession } from "@/lib/auth/server-session";
import { mutateStore } from "@/lib/store";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = serverSession(request);
  if (session?.role !== "parent" || !session.guardianId) {
    return Response.json({ error: "Inicia sesión como padre." }, { status: 401 });
  }
  try {
    const { id } = await context.params;
    return Response.json(await mutateStore((store) => {
      if (!store.snapshot().trips.some((trip) => trip.id === id && trip.guardianId === session.guardianId)) {
        throw new Error("No puedes cancelar esta recogida.");
      }
      return store.cancelTrip(id);
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo cancelar.";
    return Response.json({ error: message }, { status: 400 });
  }
}
