import { ARRIVAL_BUCKET, storeArrivalPhoto } from "../arrival-photos";
import { validJornada } from "../history";
import { todayJornada } from "../school";
import { getSupabaseAdmin, isSupabaseConfigured } from "../supabase/admin";
import { getMemoryStore, mutateStore } from "./index";

export const HISTORY_RETENTION_DAYS = 90;

export function retentionCutoff(today = todayJornada()) {
  if (!validJornada(today)) throw new Error("La fecha de retención no es válida.");
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - HISTORY_RETENTION_DAYS);
  return date.toISOString().slice(0, 10);
}

export async function backfillHistory() {
  return mutateStore(async (store) => {
    let migratedPhotos = 0;
    for (const trip of store.snapshot().trips) {
      if (!trip.arrivalPhoto?.startsWith("data:image/jpeg")) continue;
      const path = await storeArrivalPhoto(trip.arrivalPhoto, trip.id, trip.arrivedAt ?? trip.createdAt);
      if (isSupabaseConfigured() && !path) throw new Error("No se pudo migrar una foto; se conserva el snapshot original.");
      if (path) { store.setArrivalPhoto(trip.id, path, false); migratedPhotos += 1; }
    }
    store.closeExpiredTrips();
    store.archiveClosedTrips();
    store.archiveDailyLates();
    return { migratedPhotos, archivedTrips: store.historyRows().length, archivedLates: store.lateHistoryRows().length };
  });
}

export async function maintainHistory() {
  const cutoff = retentionCutoff();
  await mutateStore((store) => { store.closeExpiredTrips(); store.archiveClosedTrips(); store.archiveDailyLates(); });
  if (!isSupabaseConfigured()) {
    getMemoryStore().pruneHistory(cutoff);
    return { cutoff, deletedPhotos: 0, photos: 0, bytes: 0 };
  }
  const client = getSupabaseAdmin();
  const bucket = client.storage.from(ARRIVAL_BUCKET);
  const prefixes: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await bucket.list("", { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`No se pudo revisar el bucket: ${error.message}`);
    prefixes.push(...(data ?? []).filter((item) => validJornada(item.name)).map((item) => item.name));
    if (!data || data.length < 1000) break;
  }
  let deletedPhotos = 0;
  let photos = 0;
  let bytes = 0;
  for (const prefix of prefixes) {
    let offset = 0;
    for (;;) {
      const { data, error } = await bucket.list(prefix, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
      if (error) throw new Error(`No se pudo revisar las fotos: ${error.message}`);
      const objects = (data ?? []).filter((item) => Boolean(item.id));
      if (prefix < cutoff && objects.length) {
        const { error: removeError } = await bucket.remove(objects.map((item) => `${prefix}/${item.name}`));
        if (removeError) throw new Error(`No se pudo aplicar la retención: ${removeError.message}`);
        deletedPhotos += objects.length;
      } else {
        photos += objects.length;
        bytes += objects.reduce((sum, item) => sum + Number(item.metadata?.size ?? 0), 0);
        offset += 1000;
      }
      if (!data || data.length < 1000) break;
    }
  }
  for (const table of ["pickup_history", "pickup_late_history"]) {
    const { error } = await client.from(table).delete().lt("jornada", cutoff);
    if (error) throw new Error(`No se pudo depurar el histórico: ${error.message}`);
  }
  return { cutoff, deletedPhotos, photos, bytes };
}
