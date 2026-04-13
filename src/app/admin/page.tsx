"use client";

import { motion } from "framer-motion";
import { Drumstick, Leaf, Pizza, UtensilsCrossed, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { DISPLAY_LABEL_BY_KEY, VOTE_OPTIONS, type VoteOptionKey } from "@/lib/vote";

const ICONS: Record<VoteOptionKey, LucideIcon> = {
  pizza: Pizza,
  pasta: UtensilsCrossed,
  burger: Drumstick,
  vegan: Leaf,
};

type Votes = Record<VoteOptionKey, number>;

function pct(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [votes, setVotes] = useState<Votes | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadStats = useCallback(async () => {
    const res = await fetch("/api/admin/stats", { credentials: "include", cache: "no-store" });
    if (res.status === 401) {
      setAuthed(false);
      setVotes(null);
      return;
    }
    if (!res.ok) {
      setError("Daten konnten nicht geladen werden.");
      return;
    }
    const data = (await res.json()) as { votes: Votes; total: number };
    setAuthed(true);
    setVotes(data.votes);
    setTotal(data.total);
    setError(null);
  }, []);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (!authed) return;
    const id = window.setInterval(() => void loadStats(), 4000);
    return () => window.clearInterval(id);
  }, [authed, loadStats]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        setError("Zugangsdaten ungültig.");
        setLoading(false);
        return;
      }
      setPassword("");
      await loadStats();
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
    setAuthed(false);
    setVotes(null);
  }

  return (
    <div className="min-h-dvh w-full bg-[#070708] text-zinc-50">
      <div className="pointer-events-none fixed inset-0 opacity-70">
        <div className="absolute -top-24 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[#d6be86]/10 blur-3xl" />
      </div>

      <main className="relative mx-auto flex min-h-dvh w-full max-w-[560px] flex-col px-4 pb-10 pt-10">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Intern · echte Stimmen</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Nur gewählte Kategorien — ohne Anzeige-Korrektur.
            </p>
          </div>
          {authed && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Link
                href="/admin/logs"
                className="rounded-full border border-[#d6be86]/25 bg-[#d6be86]/10 px-3 py-1.5 text-xs text-[#f3e7c7]/90"
              >
                Stunden-Verlauf
              </Link>
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-zinc-300"
              >
                Abmelden
              </button>
            </div>
          )}
        </div>

        {authed === false && (
          <motion.form
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleLogin}
            className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm"
          >
            <label className="block text-xs font-medium text-zinc-400">Benutzername</label>
            <input
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none ring-[#d6be86]/30 focus:ring-2"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
            <label className="mt-4 block text-xs font-medium text-zinc-400">Passwort</label>
            <input
              type="password"
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none ring-[#d6be86]/30 focus:ring-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            {error && <p className="mt-3 text-sm text-amber-200/90">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="mt-5 w-full rounded-2xl border border-[#d6be86]/25 bg-[#d6be86]/15 py-3 text-sm font-medium text-[#f3e7c7] disabled:opacity-60"
            >
              {loading ? "…" : "Anmelden"}
            </button>
          </motion.form>
        )}

        {authed && votes && (
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-[#d6be86]/20 bg-white/[0.03] p-5 backdrop-blur-sm"
          >
            <div className="flex items-baseline justify-between gap-3">
              <div className="text-sm text-zinc-300">
                Gesamt echte Stimmen:{" "}
                <span className="font-semibold tabular-nums text-[#f3e7c7]">{total}</span>
              </div>
              <button
                type="button"
                onClick={() => void loadStats()}
                className="rounded-full border border-[#d6be86]/20 bg-black/30 px-3 py-1 text-xs text-[#f3e7c7]/90"
              >
                Aktualisieren
              </button>
            </div>

            <div className="mt-6 space-y-5">
              {VOTE_OPTIONS.map(({ key }) => {
                const Icon = ICONS[key];
                const value = votes[key] ?? 0;
                const p = pct(value, total);
                return (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-sm text-zinc-100">
                        <Icon className="h-4 w-4 shrink-0 text-[#d6be86]" aria-hidden />
                        {DISPLAY_LABEL_BY_KEY[key]}
                      </div>
                      <div className="text-xs tabular-nums text-zinc-300">
                        {value} · {total ? `${p}%` : "—"}
                      </div>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                      <motion.div
                        key={`${key}-${value}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${p}%` }}
                        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                        className="h-full rounded-full bg-gradient-to-r from-[#d6be86] to-[#f3e7c7]"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.section>
        )}

        {authed === null && (
          <div className="flex flex-1 items-center justify-center py-20">
            <div className="h-2 w-2 animate-pulse rounded-full bg-[#d6be86]" />
          </div>
        )}
      </main>

      <div className="fixed bottom-3 right-3 h-1.5 w-1.5 rounded-full bg-[#d6be86] opacity-90" title="Interne Ansicht" />
    </div>
  );
}
