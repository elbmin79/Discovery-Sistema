"use client";

import { useState, type FormEvent } from "react";
import { BrandMark } from "@/components/brand/brand-mark";
import { QuickAccountSelect } from "@/components/ui/quick-account-select";
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
  const [quickUsername, setQuickUsername] = useState("");
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
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex flex-1 flex-col justify-center gap-5 py-4">
        <BrandMark size={64} />
        <div>
          <h1 className="text-3xl text-forest">{t.loginTitle}</h1>
          <p className="mt-1 text-sm text-muted">{t.loginHint}</p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <label className="block text-sm font-medium text-ink">
            {t.loginUser}
            <input
              value={username}
              onChange={(event) => {
                setUsername(event.target.value);
                setQuickUsername("");
              }}
              autoComplete="username"
              className="mt-1 w-full rounded-2xl border border-line bg-paper px-4 py-3 text-base outline-none focus:border-forest"
            />
          </label>
          <label className="block text-sm font-medium text-ink">
            {t.loginPassword}
            <input
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setQuickUsername("");
              }}
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

        <QuickAccountSelect
          accounts={FAMILY_ACCOUNTS}
          value={quickUsername}
          familyHint
          label={t.quickAccount}
          placeholder={t.quickAccountPick}
          noneLabel={t.quickAccountNone}
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

      <footer className="mt-auto shrink-0 pb-3 pt-2 text-center text-[10px] leading-4 text-muted/70">
        <p>© 2026 Discovery · All rights reserved</p>
        <p>
          Digital solution by{" "}
          <a
            href="https://bandiasolutions.com.mx"
            target="_blank"
            rel="noreferrer"
            className="bandia-glow font-medium tracking-wide"
          >
            BANDIA
          </a>
        </p>
      </footer>
    </div>
  );
}
