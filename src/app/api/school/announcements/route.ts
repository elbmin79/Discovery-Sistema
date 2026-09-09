import { serverSession } from "@/lib/auth/server-session";
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
    return Response.json(
      await mutateStore((store) =>
        store.createAnnouncement({
          title: body.title ?? "",
          subtitle: body.subtitle,
          body: body.body ?? "",
          photoUrl: body.photoUrl,
          authorName: session.name,
        }),
      ),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo publicar el aviso.";
    return Response.json({ error: message }, { status: 400 });
  }
}
