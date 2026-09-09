import { serverSession } from "@/lib/auth/server-session";
import { mutateStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = serverSession(request);
  if (!session) return Response.json({ error: "Inicia sesión." }, { status: 401 });
  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      action?: "read" | "update" | "delete";
      title?: string;
      subtitle?: string;
      body?: string;
      photoUrl?: string | null;
    };
    return Response.json(
      await mutateStore((store) => {
        if (body.action === "read") {
          if (session.role !== "parent" || !session.guardianId) {
            throw new Error("Inicia sesión como padre.");
          }
          return store.markAnnouncementRead(session.guardianId, id);
        }
        if (session.role !== "staff" || !session.isAdmin) {
          throw new Error("Solo administración puede editar avisos.");
        }
        if (body.action === "delete") return store.deleteAnnouncement(id);
        if (body.action === "update") {
          return store.updateAnnouncement(id, {
            title: body.title ?? "",
            subtitle: body.subtitle,
            body: body.body ?? "",
            photoUrl: body.photoUrl,
          });
        }
        throw new Error("Acción no reconocida.");
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo actualizar el aviso.";
    return Response.json({ error: message }, { status: 400 });
  }
}
