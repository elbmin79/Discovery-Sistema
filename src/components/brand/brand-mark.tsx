"use client";

import Image from "next/image";
import { useBrand } from "@/hooks/use-brand";

export function BrandMark({
  size = 72,
  light = false,
  hero = false,
}: {
  size?: number;
  light?: boolean;
  hero?: boolean;
}) {
  const { profile } = useBrand();
  const markSize = hero ? 176 : size;

  return (
    <div className={`flex flex-col items-center ${hero ? "gap-2 md:gap-5" : "gap-2"}`}>
      <Image
        src={profile.logoSrc}
        alt={profile.name}
        width={markSize}
        height={markSize}
        className={`rounded-full bg-paper object-contain ${hero ? "h-16 w-16 md:h-44 md:w-44" : ""}`}
        priority
      />
      <div className="text-center">
        <p
          className={`font-serif leading-none ${hero ? "text-2xl md:text-6xl" : "text-2xl"} ${
            light ? "text-paper" : "text-forest"
          }`}
        >
          {profile.shortName}
        </p>
        <p
          className={`uppercase ${
            hero
              ? "mt-1 text-[10px] tracking-[0.18em] md:mt-2 md:text-base md:tracking-[0.28em]"
              : "mt-1 text-[10px] tracking-[0.22em]"
          } ${light ? "text-gold" : "text-gold-deep"}`}
        >
          {profile.tagline}
        </p>
      </div>
    </div>
  );
}

export function BrandRow({ light = false }: { light?: boolean }) {
  const { profile } = useBrand();

  return (
    <div className="flex items-center gap-3">
      <Image
        src={profile.logoSrc}
        alt={profile.shortName}
        width={40}
        height={40}
        className="rounded-full bg-paper object-contain"
      />
      <div>
        <p className={`font-serif text-lg leading-none ${light ? "text-paper" : "text-forest"}`}>
          {profile.shortName}
        </p>
        <p className={`text-[10px] tracking-[0.16em] uppercase ${light ? "text-gold" : "text-muted"}`}>
          {profile.taglineRow}
        </p>
      </div>
    </div>
  );
}
