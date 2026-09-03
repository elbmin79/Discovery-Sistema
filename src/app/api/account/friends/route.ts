import { mutateStore } from "@/lib/store";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action?: "add" | "remove";
      guardianId?: string;
      code?: string;
      friendId?: string;
    };
    if (!body.guardianId) {
      return Response.json({ error: "Falta la cuenta." }, { status: 400 });
    }
    if (body.action === "remove") {
      if (!body.friendId) return Response.json({ error: "Falta la familia." }, { status: 400 });
      return Response.json(await mutateStore((store) => store.removeFriend(body.guardianId!, body.friendId!)));
    }
    if (!body.code?.trim()) {
      return Response.json({ error: "Escribe el código de la otra familia." }, { status: 400 });
    }
    return Response.json(await mutateStore((store) => store.addFriend(body.guardianId!, body.code!)));
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo actualizar amigos.";
    return Response.json({ error: message }, { status: 400 });
  }
}
