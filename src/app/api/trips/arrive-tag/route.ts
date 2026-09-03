import { mutateStore } from "@/lib/store";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { tagId?: string; photo?: string; createIfMissing?: boolean };
    if (!body.tagId) {
      return Response.json({ error: "Falta el tag del vehículo." }, { status: 400 });
    }
    return Response.json(
      await mutateStore((store) =>
        store.arriveByTag(body.tagId!, { photo: body.photo, createIfMissing: body.createIfMissing }),
      ),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo registrar la llegada.";
    return Response.json({ error: message }, { status: 400 });
  }
}
