import { mutateStore } from "@/lib/store";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (body.action === "remove") {
      return Response.json(await mutateStore((store) => store.removeAuthorized(body.id)));
    }
    return Response.json(await mutateStore((store) => store.saveAuthorized(body)));
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo guardar a la persona.";
    return Response.json({ error: message }, { status: 400 });
  }
}
