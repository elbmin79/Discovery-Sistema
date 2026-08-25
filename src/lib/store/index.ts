import { createSeedSnapshot } from "@/lib/seed/demo-data";
import { getSupabaseAdmin, isSupabaseConfigured, supabaseUrl } from "@/lib/supabase/admin";
import type { Snapshot } from "@/lib/types";
import { MemoryPickupStore } from "./memory-store";

const STATE_ID = "live";
const MAX_RETRIES = 8;

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
    return getMemoryStore().snapshot();
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

export async function mutateStore<T>(fn: (store: MemoryPickupStore) => T): Promise<T> {
  if (supabaseUrl() && !isSupabaseConfigured()) {
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en el servidor.");
  }
  if (!isSupabaseConfigured()) {
    return fn(getMemoryStore());
  }

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    const row = await loadRow();
    const store = new MemoryPickupStore(row.snapshot);
    const result = fn(store);
    const next = store.snapshot();
    const saved = await saveVersioned(next, row.version);
    if (saved) return result;
    lastError = new Error("El sistema está ocupado. Intenta de nuevo.");
    await wait(40 * (attempt + 1));
  }
  throw lastError ?? new Error("No se pudo guardar el cambio.");
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
  return snapshot;
}

async function saveVersioned(snapshot: Snapshot, version: number) {
  const supabase = getSupabaseAdmin();
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
