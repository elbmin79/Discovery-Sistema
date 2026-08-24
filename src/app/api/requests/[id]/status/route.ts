import { getStore } from "@/lib/store";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      action: "advance" | "undo" | "cancel";
      staffName?: string;
    };
    return Response.json(getStore().setRequestStatus(id, body.action, body.staffName));
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo actualizar el estado.";
    return Response.json({ error: message }, { status: 400 });
  }
}
