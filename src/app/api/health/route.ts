import { isArchiveStoreReady, readSnapshot } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await readSnapshot();
    const archiveReady = await isArchiveStoreReady();
    return Response.json({
      status: archiveReady ? "ready" : "degraded",
      state: "ready",
      history: archiveReady ? "ready" : "deferred",
    }, {
      status: archiveReady ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("La verificación de disponibilidad falló.", error);
    return Response.json({ status: "unavailable", state: "unavailable", history: "unknown" }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
