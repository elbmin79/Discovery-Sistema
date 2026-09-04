import { buildHistoryRow, buildLateHistoryRow, historyPage } from "../history";
import { todayJornada } from "../school";
import { getSupabaseAdmin, isSupabaseConfigured } from "../supabase/admin";
import type { ArchivedLatePickup, HistoryPage, HistoryRow } from "../types";
import { getMemoryStore, mutateStore, readSnapshot } from "./index";
import { MemoryPickupStore } from "./memory-store";

export async function queryHistory(from: string, to: string, limit = 200, offset = 0): Promise<HistoryPage> {
  const today = todayJornada();
  const includesToday = from <= today && to >= today;
  let liveRows: HistoryRow[] = [];
  let liveLates: ArchivedLatePickup[] = [];
  if (includesToday) {
    let snapshot = await readSnapshot();
    const store = new MemoryPickupStore(snapshot);
    if (store.hasDailyArchives() || store.hasExpiredTrips()) {
      snapshot = await mutateStore((current) => { current.closeExpiredTrips(); current.archiveDailyLates(); return current.snapshot(); });
    }
    liveRows = snapshot.trips.map((trip) => buildHistoryRow(snapshot, trip, true)).filter((row) => row.jornada === today);
    liveLates = snapshot.latePickups.map((notice) => buildLateHistoryRow(snapshot, notice)).filter((row) => row.jornada === today);
  }
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseAdmin().rpc("query_pickup_history", {
      range_from: from, range_to: to, page_limit: limit, page_offset: offset, live_rows: liveRows, live_lates: liveLates,
    });
    if (error) throw new Error(`No se pudo consultar el histórico: ${error.message}`);
    const page = data as HistoryPage;
    if (page.summary.averageWait === null) delete page.summary.averageWait;
    page.days.forEach((day) => { if (day.summary.averageWait === null) delete day.summary.averageWait; });
    return { ...page, includesToday };
  }
  const store = getMemoryStore();
  const archived = store.historyRows();
  return historyPage([...archived, ...liveRows.filter((row) => !archived.some((item) => item.tripId === row.tripId))], from, to, limit, offset,
    [...store.lateHistoryRows(), ...liveLates].filter((late) => late.jornada >= from && late.jornada <= to));
}
