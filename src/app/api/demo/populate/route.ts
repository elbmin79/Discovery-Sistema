import { mutateStore } from "@/lib/store";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { count?: number };
    const count =
      body.count && body.count > 0 ? Math.min(Math.floor(body.count), 10) : 1 + Math.floor(Math.random() * 6);
    return Response.json(await mutateStore((store) => store.addRandomArrivals(count)));
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudieron simular llegadas.";
    return Response.json({ error: message }, { status: 400 });
  }
}
