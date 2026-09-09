import { buildLateHistoryRow, buildLiveHistoryRows, historyPage, matchesHistoryStatus, type HistoryStatusFilter } from "../history";
import { todayJornada } from "../school";
import { getSupabaseAdmin, isSupabaseConfigured } from "../supabase/admin";
import type { ArchivedLatePickup, HistoryPage, HistoryRow } from "../types";
import { getMemoryStore, isArchiveStoreReady, mutateStore, readSnapshot } from "./index";
import { MemoryPickupStore } from "./memory-store";

/** Avisos "announced" de hoy solo viven en el snapshot; el archivo puede tener fantasmas. */
function mergeLatePickups(archived: ArchivedLatePickup[], live: ArchivedLatePickup[], today: string) {
  const liveIds = new Set(live.map((item) => item.id));
  const fromArchive = archived.filter(
    (item) => !(item.jornada === today && (item.notice.status === "announced" || liveIds.has(item.id))),
  );
  return [...fromArchive, ...live];
}

function dropGhostAnnounced(lates: ArchivedLatePickup[], liveIds: Set<string>, today: string) {
  return lates.filter(
    (item) => !(item.jornada === today && item.notice?.status === "announced" && !liveIds.has(item.id)),
  );
}

export async function queryHistory(from: string, to: string, limit = 200, offset = 0, status: HistoryStatusFilter = "all", zone = ""): Promise<HistoryPage> {
  const today = todayJornada();
  const includesToday = from <= today && to >= today;
  let liveRows: HistoryRow[] = [];
  let liveLates: ArchivedLatePickup[] = [];
  if (includesToday) {
    let snapshot = await readSnapshot();
    const store = new MemoryPickupStore(snapshot);
    if (store.hasDailyArchives() || store.hasExpiredTrips()) {
      snapshot = await mutateStore((current) => {
        current.closeExpiredTrips();
        current.archiveDailyLates();
        return current.snapshot();
      });
    }
    liveRows = buildLiveHistoryRows(snapshot, today);
    liveLates = snapshot.latePickups
      .map((notice) => buildLateHistoryRow(snapshot, notice))
      .filter((row) => row.jornada === today);
  }
  if (isSupabaseConfigured() && await isArchiveStoreReady()) {
    const { data, error } = await getSupabaseAdmin().rpc("query_pickup_history", {
      range_from: from,
      range_to: to,
      page_limit: limit,
      page_offset: offset,
      live_rows: liveRows,
      live_lates: liveLates,
      pickup_status: status,
      pickup_zone: zone,
    });
    if (error) throw new Error(`No se pudo consultar el histórico: ${error.message}`);
    const page = data as HistoryPage;
    if (page.summary.averageWait === null) delete page.summary.averageWait;
    page.days.forEach((day) => {
      if (day.summary.averageWait === null) delete day.summary.averageWait;
    });
    const liveIds = new Set(liveLates.map((item) => item.id));
    page.latePickups = dropGhostAnnounced(page.latePickups ?? [], liveIds, today);
    page.days = (page.days ?? []).map((day) => ({
      ...day,
      latePickups: dropGhostAnnounced(day.latePickups ?? [], liveIds, today),
    }));
    return { ...page, includesToday };
  }
  if (isSupabaseConfigured()) {
    return historyPage(
      liveRows.filter(
        (row) => matchesHistoryStatus(row, status) && (!zone || row.zoneName?.split(", ").includes(zone)),
      ),
      from,
      to,
      limit,
      offset,
      liveLates.filter((late) => late.jornada >= from && late.jornada <= to),
    );
  }
  const store = getMemoryStore();
  const archived = store.historyRows();
  return historyPage(
    [...archived, ...liveRows.filter((row) => !archived.some((item) => item.tripId === row.tripId))].filter(
      (row) => matchesHistoryStatus(row, status) && (!zone || row.zoneName?.split(", ").includes(zone)),
    ),
    from,
    to,
    limit,
    offset,
    mergeLatePickups(store.lateHistoryRows(), liveLates, today).filter(
      (late) => late.jornada >= from && late.jornada <= to,
    ),
  );
}
