import { getStore } from "@/lib/store";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (body.action === "remove") {
      return Response.json(getStore().removeAuthorized(body.id));
    }
    return Response.json(getStore().saveAuthorized(body));
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo guardar a la persona.";
    return Response.json({ error: message }, { status: 400 });
  }
}
