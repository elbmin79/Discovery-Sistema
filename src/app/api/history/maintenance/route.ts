import { timingSafeEqual } from "node:crypto";
import { maintainHistory } from "@/lib/store/history-maintenance";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || received.length !== expected.length || !timingSafeEqual(received, expected)) return new Response(null, { status: 401 });
  try {
    const result = await maintainHistory();
    console.info("Mantenimiento histórico", JSON.stringify(result));
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    console.error("Falló el mantenimiento del histórico");
    return Response.json({ error: "Falló el mantenimiento del histórico." }, { status: 500 });
  }
}
