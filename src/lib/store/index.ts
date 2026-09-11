import { hydrateStudentSurnames } from "../student-surnames";
import { createSeedSnapshot } from "@/lib/seed/demo-data";
import { getSupabaseAdmin, isSupabaseConfigured, supabaseUrl } from "@/lib/supabase/admin";
import type { ArchivedLatePickup, HistoryRow, Snapshot } from "@/lib/types";
import { MemoryPickupStore } from "./memory-store";

const STATE_ID = "live";
const MAX_RETRIES = 8;
const ARCHIVE_CHECK_TTL_MS = 30_000;

let archiveCheck: { ready: boolean; checkedAt: number } | null = null;

const globalForStore = globalThis as typeof globalThis & {
  __discoveryStore?: MemoryPickupStore;
};

type StateRow = {
  snapshot: Snapshot;
  version: number;
};

export function isStoreShared() {
  return isSupabaseConfigured();
}

export function getMemoryStore() {
  if (!globalForStore.__discoveryStore) {
    globalForStore.__discoveryStore = new MemoryPickupStore();
  }
  return globalForStore.__discoveryStore;
}

export async function readSnapshot(): Promise<Snapshot> {
  if (supabaseUrl() && !isSupabaseConfigured()) {
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en el servidor.");
  }
  if (!isSupabaseConfigured()) {
    return hydrateStudentSurnames(getMemoryStore().snapshot());
  }
  return (await loadRow()).snapshot;
}

export async function saveSnapshot(snapshot: Snapshot) {
  if (!isSupabaseConfigured()) return;
  const row = await loadRow();
  const saved = await saveVersioned(snapshot, row.version);
  if (!saved) {
    throw new Error("El estado cambió al guardar. Intenta de nuevo.");
  }
}

export async function mutateStore<T>(fn: (store: MemoryPickupStore) => T | Promise<T>): Promise<T> {
  if (supabaseUrl() && !isSupabaseConfigured()) {
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en el servidor.");
  }
  if (!isSupabaseConfigured()) {
    return fn(getMemoryStore());
  }

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    const row = await loadRow();
    const store = new MemoryPickupStore(row.snapshot, Infinity, await isArchiveStoreReady());
    const result = await fn(store);
    const next = store.snapshot();
    const saved = await saveVersioned(next, row.version, store.historyRows(), store.lateHistoryRows());
    if (saved) return result;
    lastError = new Error("El sistema está ocupado. Intenta de nuevo.");
    await wait(40 * (attempt + 1));
  }
  throw lastError ?? new Error("No se pudo guardar el cambio.");
}

export async function isArchiveStoreReady() {
  if (!isSupabaseConfigured()) return true;
  if (archiveCheck && Date.now() - archiveCheck.checkedAt < ARCHIVE_CHECK_TTL_MS) {
    return archiveCheck.ready;
  }

  try {
    const supabase = getSupabaseAdmin();
    const [tripHistory, lateHistory, commit, query] = await Promise.all([
      supabase.from("pickup_history").select("trip_id").limit(1),
      supabase.from("pickup_late_history").select("id").limit(1),
      supabase.rpc("commit_pickup_state", {
        expected_version: -1,
        next_snapshot: {},
        archive_rows: [],
        late_rows: [],
      }),
      supabase.rpc("query_pickup_history", {
        range_from: "1970-01-01",
        range_to: "1970-01-01",
        page_limit: 1,
        page_offset: 0,
        live_rows: [],
        live_lates: [],
        pickup_status: "all",
        pickup_zone: "",
      }),
    ]);
    const errors = [tripHistory.error, lateHistory.error, commit.error, query.error].filter(Boolean);
    archiveCheck = { ready: errors.length === 0, checkedAt: Date.now() };
    if (errors.length) {
      console.error("El archivo histórico de Supabase no está disponible.", errors.map((error) => error?.message));
    }
  } catch (error) {
    archiveCheck = { ready: false, checkedAt: Date.now() };
    console.error("No se pudo verificar el archivo histórico de Supabase.", error);
  }
  return archiveCheck.ready;
}

async function loadRow(): Promise<StateRow> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("pickup_state")
    .select("snapshot, version")
    .eq("id", STATE_ID)
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo leer el estado: ${error.message}`);
  }

  if (!data?.snapshot) {
    const seed = createSeedSnapshot();
    const { error: insertError } = await supabase.from("pickup_state").upsert({
      id: STATE_ID,
      snapshot: seed,
      version: 1,
      updated_at: seed.updatedAt,
    });
    if (insertError) {
      throw new Error(`No se pudo iniciar el estado: ${insertError.message}`);
    }
    return { snapshot: seed, version: 1 };
  }

  return { snapshot: normalizeSnapshot(data.snapshot as Snapshot), version: data.version ?? 1 };
}

function normalizeSnapshot(snapshot: Snapshot): Snapshot {
  if (!Array.isArray(snapshot.events)) {
    snapshot.events = [];
  }
  if (!Array.isArray(snapshot.latePickups)) {
    snapshot.latePickups = [];
  }
  if (!Array.isArray(snapshot.announcements)) {
    snapshot.announcements = [];
  }
  if (!Array.isArray(snapshot.calendarEvents)) {
    snapshot.calendarEvents = [];
  }
  if (!snapshot.simulation) {
    snapshot.simulation = { running: false };
  }
  for (const guardian of snapshot.guardians ?? []) {
    if (!Array.isArray(guardian.readAnnouncementIds)) {
      guardian.readAnnouncementIds = [];
    }
  }
  return hydrateStudentSurnames(snapshot);
}

async function saveVersioned(snapshot: Snapshot, version: number, archiveRows: HistoryRow[] = [], lateRows: ArchivedLatePickup[] = []) {
  const supabase = getSupabaseAdmin();
  if (archiveRows.length || lateRows.length) {
    const { data, error } = await supabase.rpc("commit_pickup_state", {
      expected_version: version, next_snapshot: snapshot, archive_rows: archiveRows, late_rows: lateRows,
    });
    if (error) throw new Error(`No se pudo archivar la recogida: ${error.message}`);
    return data === true;
  }
  const { data, error } = await supabase
    .from("pickup_state")
    .update({
      snapshot,
      version: version + 1,
      updated_at: snapshot.updatedAt,
    })
    .eq("id", STATE_ID)
    .eq("version", version)
    .select("id");

  if (error) {
    throw new Error(`No se pudo guardar el estado: ${error.message}`);
  }

  return Boolean(data?.length);
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type { MemoryPickupStore };
