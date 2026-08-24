import { mutateStore } from "@/lib/store";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    return Response.json(await mutateStore((store) => store.cancelTrip(id)));
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo cancelar.";
    return Response.json({ error: message }, { status: 400 });
  }
}
