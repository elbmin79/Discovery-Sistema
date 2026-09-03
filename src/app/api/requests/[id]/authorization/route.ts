import { mutateStore } from "@/lib/store";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as { guardianId?: string; decision?: "approved" | "denied" };
    if (!body.guardianId || (body.decision !== "approved" && body.decision !== "denied")) {
      return Response.json({ error: "Respuesta inválida." }, { status: 400 });
    }
    return Response.json(
      await mutateStore((store) => store.respondAuthorization(id, body.guardianId!, body.decision!)),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo guardar la respuesta.";
    return Response.json({ error: message }, { status: 400 });
  }
}
