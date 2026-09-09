import { isArchiveStoreReady, mutateStore, readSnapshot } from "@/lib/store";
import { MemoryPickupStore } from "@/lib/store/memory-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await readSnapshot();
  // Sin procesos en segundo plano, el cierre automático a los 30 min se aplica
  // de forma perezosa cuando algún cliente consulta el estado.
  const store = new MemoryPickupStore(snapshot);
  const archiveReady = await isArchiveStoreReady();
  if (
    store.hasExpiredTrips() ||
    store.hasSimulationDue() ||
    (archiveReady && (store.hasDailyArchives() || store.hasClosedTrips()))
  ) {
    try {
      return Response.json(
        await mutateStore((store) => {
          store.closeExpiredTrips();
          store.archiveDailyLates();
          store.archiveClosedTrips();
          store.tickSimulation();
          return store.snapshot();
        }),
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch (error) {
      console.error("No se pudo aplicar el mantenimiento al consultar el estado.", error);
    }
  }
  return Response.json(snapshot, { headers: { "Cache-Control": "no-store" } });
}
