"use client";

import Link from "next/link";
import { useState } from "react";
import { ClipboardList, MonitorSmartphone, Smartphone, TabletSmartphone } from "lucide-react";
import { BrandMark } from "@/components/brand/brand-mark";
import { postJson } from "@/hooks/use-snapshot";

const EXPERIENCES = [
  {
    href: "/familia",
    title: "Familia",
    person: "Padres y tutores",
    detail: "Avisa que vas en camino y sigue la salida de tus hijos.",
    icon: Smartphone,
  },
  {
    href: "/kiosco",
    title: "Kiosco",
    person: "Entrada de la escuela",
    detail: "Identifica la llegada y registra la recogida.",
    icon: TabletSmartphone,
  },
  {
    href: "/personal",
    title: "Tablero de salida",
    person: "Maestro de turno",
    detail: "Ve quién llegó y despacha a cada alumno con un toque.",
    icon: MonitorSmartphone,
  },
  {
    href: "/bitacora",
    title: "Bitácora",
    person: "Registro y auditoría",
    detail: "Historial del día: entregas, tiempos y quién hizo qué.",
    icon: ClipboardList,
  },
];

export function DemoHub() {
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function resetDemo() {
    setResetting(true);
    setMessage(null);
    try {
      await postJson("/api/demo/reset");
      setMessage("La jornada se reinició.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo reiniciar.");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-5 py-5 md:px-8 md:py-10">
      <div className="flex flex-1 flex-col justify-start gap-5 md:justify-center md:gap-10">
        <div className="flex flex-col items-center text-center">
          <BrandMark hero />
          <h1 className="mt-3 font-serif text-2xl text-forest md:mt-8 md:text-5xl">Salida escolar</h1>
          <p className="mt-1 max-w-xl text-sm text-muted md:mt-3 md:text-base">
            Sistema de salida de Discovery American Preschool & Academy.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-4">
          {EXPERIENCES.map((experience) => {
            const Icon = experience.icon;
            return (
              <Link
                key={experience.href}
                href={experience.href}
                className="group rounded-2xl border border-line bg-paper p-4 transition hover:-translate-y-0.5 hover:border-gold md:rounded-3xl md:p-6"
              >
                <Icon className="h-5 w-5 text-forest md:h-6 md:w-6" />
                <h2 className="mt-2 font-serif text-xl text-forest md:mt-5 md:text-2xl">{experience.title}</h2>
                <p className="mt-0.5 text-sm font-medium text-gold-deep">{experience.person}</p>
                <p className="mt-1 text-sm leading-5 text-muted md:mt-3 md:leading-6">{experience.detail}</p>
                <p className="mt-3 text-sm font-semibold text-forest group-hover:text-forest-soft md:mt-6">
                  Abrir →
                </p>
              </Link>
            );
          })}
        </div>

        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={resetDemo}
            disabled={resetting}
            className="rounded-full border border-line bg-paper px-5 py-2 text-sm font-medium text-forest disabled:opacity-60 md:py-2.5"
          >
            {resetting ? "Reiniciando…" : "Nueva jornada"}
          </button>
          {message ? <p className="text-sm text-muted">{message}</p> : null}
        </div>
      </div>
      </main>
      <footer className="bg-cream-footer px-6 py-4 text-center md:py-8">
        <div className="mb-4 hidden justify-center md:flex">
          <BrandMark size={56} />
        </div>
        <p className="text-sm text-forest/80">
          Mexicali, B.C. · Calzada CETYS & Del Sol Oeste
        </p>
        <p className="mt-3 text-sm text-forest/70">
          © 2026 All rights reserved. Digital solution by{" "}
          <a
            href="https://bandiasolutions.com.mx"
            target="_blank"
            rel="noreferrer"
            className="bandia-glow font-semibold tracking-wide"
          >
            BANDIA Solutions
          </a>
        </p>
      </footer>
    </div>
  );
}
