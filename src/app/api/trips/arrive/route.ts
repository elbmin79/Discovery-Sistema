import { getStore } from "@/lib/store";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { code?: string; token?: string; photo?: string };
    const key = body.code || body.token;
    if (!key) {
      return Response.json({ error: "Ingresa el código de llegada." }, { status: 400 });
    }
    return Response.json(getStore().arriveByCode(key, { photo: body.photo }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo registrar la llegada.";
    return Response.json({ error: message }, { status: 400 });
  }
}
