import { createSeedSnapshot } from "@/lib/seed/demo-data";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
import type { Snapshot } from "@/lib/types";
import { MemoryPickupStore } from "./memory-store";

const STATE_ID = "live";

const globalForStore = globalThis as typeof globalThis & {
  __discoveryStore?: MemoryPickupStore;
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
  if (!isSupabaseConfigured()) {
    return getMemoryStore().snapshot();
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("pickup_state")
    .select("snapshot")
    .eq("id", STATE_ID)
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo leer el estado: ${error.message}`);
  }

  if (!data?.snapshot) {
    const seed = createSeedSnapshot();
    await saveSnapshot(seed);
    return seed;
  }

  return data.snapshot as Snapshot;
}

export async function saveSnapshot(snapshot: Snapshot) {
  if (!isSupabaseConfigured()) return;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("pickup_state").upsert({
    id: STATE_ID,
    snapshot,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(`No se pudo guardar el estado: ${error.message}`);
  }
}

export async function mutateStore<T>(fn: (store: MemoryPickupStore) => T): Promise<T> {
  if (!isSupabaseConfigured()) {
    return fn(getMemoryStore());
  }

  const store = new MemoryPickupStore(await readSnapshot());
  const result = fn(store);
  await saveSnapshot(store.snapshot());
  return result;
}

export type { MemoryPickupStore };
