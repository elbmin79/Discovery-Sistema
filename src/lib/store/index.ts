import { MemoryPickupStore } from "./memory-store";

const globalForStore = globalThis as typeof globalThis & {
  __discoveryStore?: MemoryPickupStore;
};

export function getStore() {
  if (!globalForStore.__discoveryStore) {
    globalForStore.__discoveryStore = new MemoryPickupStore();
  }
  return globalForStore.__discoveryStore;
}

export type { MemoryPickupStore };
