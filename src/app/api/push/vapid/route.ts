import { serverSession } from "@/lib/auth/server-session";
import { vapidPublicKey } from "@/lib/push";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = serverSession(request);
  if (session?.role !== "parent") {
    return Response.json({ error: "Inicia sesión como familia." }, { status: 401 });
  }
  return Response.json({ publicKey: vapidPublicKey() });
}
