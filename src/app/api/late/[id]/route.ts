import { mutateStore } from "@/lib/store";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      action: "eta" | "cancel";
      etaAt?: string;
      staffName?: string;
    };
    return Response.json(
      await mutateStore((store) => {
        switch (body.action) {
          case "eta":
            if (!body.etaAt) throw new Error("Indica la nueva hora estimada.");
            return store.updateLateEta(id, body.etaAt);
          case "cancel":
            return store.cancelLate(id);
          default:
            throw new Error("Acción no reconocida.");
        }
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo actualizar el aviso.";
    return Response.json({ error: message }, { status: 400 });
  }
}
