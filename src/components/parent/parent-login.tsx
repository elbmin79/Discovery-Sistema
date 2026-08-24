"use client";

import { useState, type FormEvent } from "react";
import { BrandMark } from "@/components/brand/brand-mark";
import { FAMILY_ACCOUNTS } from "@/lib/auth/accounts";
import { postJson } from "@/hooks/use-snapshot";
import type { DemoSession } from "@/lib/types";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function ParentLogin({
  t,
  onSignedIn,
}: {
  t: Dictionary;
  onSignedIn: (session: DemoSession) => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const session = await postJson<DemoSession>("/api/auth/login", { username, password });
      if (session.role !== "parent") {
        setError("Esta cuenta es del personal, no de familia.");
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
    <div className="flex min-h-full flex-col justify-center gap-8 py-6">
      <BrandMark size={72} />
      <div>
        <h1 className="font-serif text-3xl text-forest">{t.loginTitle}</h1>
        <p className="mt-2 text-sm text-muted">{t.loginHint}</p>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <label className="block text-sm font-medium text-ink">
          {t.loginUser}
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            className="mt-1 w-full rounded-2xl border border-line bg-paper px-4 py-3 text-base outline-none focus:border-forest"
          />
        </label>
        <label className="block text-sm font-medium text-ink">
          {t.loginPassword}
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            className="mt-1 w-full rounded-2xl border border-line bg-paper px-4 py-3 text-base outline-none focus:border-forest"
          />
        </label>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-forest py-4 text-lg font-semibold text-paper disabled:opacity-50"
        >
          {t.loginAction}
        </button>
      </form>

      <div className="rounded-3xl bg-paper px-4 py-4 text-sm">
        {FAMILY_ACCOUNTS.map((account) => (
          <button
            key={account.username}
            type="button"
            onClick={() => {
              setUsername(account.username);
              setPassword(account.password);
            }}
            className="flex w-full items-center justify-between border-b border-line py-3 last:border-b-0"
          >
            <span>
              <span className="block font-medium text-ink">{account.name}</span>
              <span className="text-muted">Familia {account.name.split(" ").slice(-1)}</span>
            </span>
            <span className="text-forest">Entrar</span>
          </button>
        ))}
      </div>
    </div>
  );
}
