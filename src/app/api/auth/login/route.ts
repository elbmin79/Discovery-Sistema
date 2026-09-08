import { authenticate } from "@/lib/auth/accounts";
import { sessionCookie } from "@/lib/auth/server-session";

export async function POST(request: Request) {
  const body = (await request.json()) as { username?: string; password?: string };
  const session = authenticate(body.username ?? "", body.password ?? "");
  if (!session) {
    return Response.json({ error: "Usuario o contraseña incorrectos." }, { status: 401 });
  }
  return Response.json(session, { headers: { "Set-Cookie": sessionCookie(session, new URL(request.url).protocol === "https:"), "Cache-Control": "no-store" } });
}
