import { serverSession } from "@/lib/auth/server-session";
import { mutateStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = serverSession(request);
  if (session?.role !== "staff" || !session.isAdmin) {
    return Response.json({ error: "Solo administración puede crear eventos." }, { status: 401 });
  }
  try {
    const body = (await request.json().catch(() => ({}))) as {
      title?: string;
      description?: string;
      date?: string;
      time?: string;
      color?: string;
    };
    return Response.json(
      await mutateStore((store) =>
        store.createCalendarEvent({
          title: body.title ?? "",
          description: body.description,
          date: body.date ?? "",
          time: body.time,
          color: body.color,
          authorName: session.name,
        }),
      ),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo crear el evento.";
    return Response.json({ error: message }, { status: 400 });
  }
}
