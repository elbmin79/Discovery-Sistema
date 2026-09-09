import { mutateStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { mode?: "simulated" | "all" };
    const mode = body.mode === "all" ? "all" : "simulated";
    return Response.json(
      await mutateStore((store) =>
        mode === "all" ? store.clearAllArrivals() : store.clearSimulatedArrivals(),
      ),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo limpiar.";
    return Response.json({ error: message }, { status: 400 });
  }
}
