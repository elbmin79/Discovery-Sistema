"use client";

import { useMemo, useState, type FormEvent } from "react";
import { BrandMark } from "@/components/brand/brand-mark";
import { QuickAccountSelect } from "@/components/ui/quick-account-select";
import { STAFF_ACCOUNTS } from "@/lib/auth/accounts";
import { postJson } from "@/hooks/use-snapshot";
import type { DemoSession } from "@/lib/types";

export function StaffLogin({ onSignedIn, adminOnly = false }: { onSignedIn: (session: DemoSession) => void; adminOnly?: boolean }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [quickUsername, setQuickUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const accounts = useMemo(
    () => STAFF_ACCOUNTS.filter((account) => !adminOnly || account.isAdmin),
    [adminOnly],
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const session = await postJson<DemoSession>("/api/auth/login", { username, password });
      if (session.role !== "staff") {
        setError("Esta cuenta es de familia, no de personal.");
        return;
      }
      if (adminOnly && !session.isAdmin) {
        setError("Ingresa con una cuenta de administración de oficina.");
        return;
      }
      onSignedIn(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo entrar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6 py-10">
      <BrandMark size={80} />
      <h1 className="mt-8 font-serif text-4xl text-forest">{adminOnly ? "Administración" : "Personal de salida"}</h1>
      <p className="mt-2 text-muted">{adminOnly ? "Ingresa para consultar el Admin Dashboard." : "Ingresa para abrir el tablero de salida."}</p>

      <form onSubmit={submit} className="mt-8 space-y-3">
        <input
          value={username}
          onChange={(event) => {
            setUsername(event.target.value);
            setQuickUsername("");
          }}
          placeholder="Usuario"
          className="w-full rounded-2xl border border-line bg-paper px-4 py-4 text-lg"
        />
        <input
          type="password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setQuickUsername("");
          }}
          placeholder="Contraseña"
          className="w-full rounded-2xl border border-line bg-paper px-4 py-4 text-lg"
        />
        {error ? <p className="text-danger">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-forest py-4 text-lg font-semibold text-paper"
        >
          Entrar al tablero
        </button>
      </form>

      <div className="mt-8">
        <QuickAccountSelect
          accounts={accounts}
          value={quickUsername}
          label="Cuenta rápida"
          placeholder="Elige una cuenta…"
          noneLabel="Ninguna"
          onChange={(account) => {
            if (!account) {
              setQuickUsername("");
              setUsername("");
              setPassword("");
              setError(null);
              return;
            }
            setQuickUsername(account.username);
            setUsername(account.username);
            setPassword(account.password);
            setError(null);
          }}
        />
      </div>
    </main>
  );
}
