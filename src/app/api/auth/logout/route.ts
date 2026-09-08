import { clearSessionCookie } from "@/lib/auth/server-session";

export async function POST() {
  return Response.json({ ok: true }, { headers: { "Set-Cookie": clearSessionCookie() } });
}
