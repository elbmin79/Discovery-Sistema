import { serverSession } from "@/lib/auth/server-session";
import { broadcastSchoolPush } from "@/lib/broadcast-push";
import { mutateStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = serverSession(request);
  if (session?.role !== "staff" || !session.isAdmin) {
    return Response.json({ error: "Solo administración puede publicar avisos." }, { status: 401 });
  }
  try {
    const body = (await request.json().catch(() => ({}))) as {
      title?: string;
      subtitle?: string;
      body?: string;
      photoUrl?: string;
    };
    const snapshot = await mutateStore((store) =>
      store.createAnnouncement({
        title: body.title ?? "",
        subtitle: body.subtitle,
        body: body.body ?? "",
        photoUrl: body.photoUrl,
        authorName: session.name,
      }),
    );
    const notice = snapshot.announcements[0];
    if (notice) {
      void broadcastSchoolPush({
        kind: "announcement",
        tag: `aviso-${notice.id}`,
        title: notice.title,
        body: notice.subtitle || notice.body.slice(0, 120),
        url: "/familia",
      });
    }
    return Response.json(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo publicar el aviso.";
    return Response.json({ error: message }, { status: 400 });
  }
}
