"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { postJson, rememberSnapshot, useSnapshot } from "@/hooks/use-snapshot";
import {
  applySchoolBrand,
  normalizeSchoolBrand,
  persistBrand,
  SCHOOL_BRANDS,
  schoolBrandProfile,
} from "@/lib/school-brand";
import type { SchoolBrandId, Snapshot } from "@/lib/types";

type BrandContextValue = {
  brand: SchoolBrandId;
  profile: (typeof SCHOOL_BRANDS)[SchoolBrandId];
  setBrand: (brand: SchoolBrandId) => Promise<void>;
  busy: boolean;
};

const BrandContext = createContext<BrandContextValue>({
  brand: "discovery",
  profile: SCHOOL_BRANDS.discovery,
  setBrand: async () => undefined,
  busy: false,
});

export function BrandProvider({ children }: { children: ReactNode }) {
  const { snapshot } = useSnapshot();
  const [pending, setPending] = useState<SchoolBrandId | null>(null);
  const snapshotBrand = snapshot ? normalizeSchoolBrand(snapshot.school.brand) : null;
  const brand = pending ?? snapshotBrand ?? "discovery";

  useEffect(() => {
    applySchoolBrand(brand);
    persistBrand(brand);
  }, [brand]);

  const setBrand = useCallback(
    async (next: SchoolBrandId) => {
      const fallback = snapshotBrand ?? "discovery";
      setPending(next);
      applySchoolBrand(next);
      persistBrand(next);
      try {
        const data = await postJson<Snapshot>("/api/school/brand", { brand: next });
        rememberSnapshot(data);
        setPending(null);
      } catch {
        setPending(null);
        applySchoolBrand(fallback);
        persistBrand(fallback);
      }
    },
    [snapshotBrand],
  );

  const value = useMemo(
    () => ({ brand, profile: schoolBrandProfile(brand), setBrand, busy: pending !== null }),
    [brand, pending, setBrand],
  );

  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

export function useBrand() {
  return useContext(BrandContext);
}
