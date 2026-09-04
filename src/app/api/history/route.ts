import { serverSession } from "@/lib/auth/server-session";
import { validJornada } from "@/lib/history";
import { queryHistory } from "@/lib/store/history-store";

export async function GET(request: Request) {
  const session = serverSession(request);
  if (!session) return Response.json({ error: "Inicia sesión para consultar el histórico." }, { status: 401 });
  if (session.role !== "staff" || !session.isAdmin) return Response.json({ error: "El histórico es de uso de administración." }, { status: 403 });
  const params = new URL(request.url).searchParams;
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const limit = Number(params.get("limit") ?? 200);
  const offset = Number(params.get("offset") ?? 0);
  if (!validJornada(from) || !validJornada(to) || from > to || !Number.isInteger(limit) || limit < 1 || limit > 1000 || !Number.isInteger(offset) || offset < 0) {
    return Response.json({ error: "El rango o la paginación no son válidos." }, { status: 400 });
  }
  try {
    return Response.json(await queryHistory(from, to, limit, offset), { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: "No se pudo cargar el histórico. Intenta de nuevo." }, { status: 503 });
  }
}
