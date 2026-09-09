import { serverSession } from "@/lib/auth/server-session";
import { mutateStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = serverSession(request);
  if (session?.role !== "staff" || !session.isAdmin) {
    return Response.json({ error: "Solo administración puede editar el calendario." }, { status: 401 });
  }
  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      action?: "update" | "delete";
      title?: string;
      description?: string;
      date?: string;
      time?: string | null;
      color?: string;
    };
    return Response.json(
      await mutateStore((store) => {
        if (body.action === "delete") return store.deleteCalendarEvent(id);
        if (body.action === "update") {
          return store.updateCalendarEvent(id, {
            title: body.title ?? "",
            description: body.description,
            date: body.date ?? "",
            time: body.time,
            color: body.color,
          });
        }
        throw new Error("Acción no reconocida.");
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo actualizar el evento.";
    return Response.json({ error: message }, { status: 400 });
  }
}
