import { mutateStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { running?: boolean };
    const running = Boolean(body.running);
    return Response.json(
      await mutateStore((store) => {
        store.setSimulationRunning(running);
        if (running) store.tickSimulation();
        return store.snapshot();
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo cambiar la simulación.";
    return Response.json({ error: message }, { status: 400 });
  }
}
