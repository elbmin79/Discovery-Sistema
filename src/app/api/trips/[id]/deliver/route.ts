import { mutateStore } from "@/lib/store";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { staffName?: string };
    return Response.json(await mutateStore((store) => store.deliverTrip(id, body.staffName)));
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo entregar a la familia.";
    return Response.json({ error: message }, { status: 400 });
  }
}
