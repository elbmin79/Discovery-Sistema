import { mutateStore, readSnapshot } from "@/lib/store";
import { MemoryPickupStore } from "@/lib/store/memory-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await readSnapshot();
  // Sin procesos en segundo plano, el cierre automático a los 30 min se aplica
  // de forma perezosa cuando algún cliente consulta el estado.
  if (new MemoryPickupStore(snapshot).hasExpiredTrips()) {
    return Response.json(
      await mutateStore((store) => {
        store.closeExpiredTrips();
        return store.snapshot();
      }),
    );
  }
  return Response.json(snapshot);
}
