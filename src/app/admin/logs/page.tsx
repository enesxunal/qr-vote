"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { DISPLAY_LABEL_BY_KEY, type VoteOptionKey } from "@/lib/vote";

type VoteEvent = { t: string; c: VoteOptionKey };

type Hourly = {
  hourUtc: string;
  total: number;
  pizza: number;
  pasta: number;
  burger: number;
  vegan: number;
};

const CHOICE_KEYS: VoteOptionKey[] = ["pizza", "pasta", "burger", "vegan"];

export default function AdminLogsPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Hourly[] | null>(null);
  const [events, setEvents] = useState<VoteEvent[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [days, setDays] = useState(14);

  const loadLog = useCallback(async () => {
    const res = await fetch(`/api/admin/vote-log?days=${days}&eventsLimit=2000`, {
      credentials: "include",
      cache: "no-store",
    });
    if (res.status === 401) {
      setAuthed(false);
      setRows(null);
      setEvents(null);
      return;
    }
    if (!res.ok) {
      setError("Log konnte nicht geladen werden.");
      return;
    }
    const data = (await res.json()) as { hourly?: Hourly[]; events?: VoteEvent[]; note?: string };
    setAuthed(true);
    setRows(data.hourly ?? []);
    setEvents(data.events ?? []);
    setNote(data.note ?? null);
    setError(null);
  }, [days]);

  useEffect(() => {
    void loadLog();
  }, [loadLog]);

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
      await loadLog();
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
    setAuthed(false);
    setRows(null);
    setEvents(null);
  }

  return (
    <div className="min-h-dvh w-full bg-[#070708] text-zinc-50">
      <div className="pointer-events-none fixed inset-0 opacity-70">
        <div className="absolute -top-24 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[#d6be86]/10 blur-3xl" />
      </div>

      <main className="relative mx-auto flex min-h-dvh w-full max-w-[960px] flex-col px-4 pb-10 pt-10">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-semibold tracking-tight">Stimmen · Verlauf</h1>
              {authed && (
                <Link
                  href="/admin"
                  className="rounded-full border border-[#d6be86]/25 bg-[#d6be86]/10 px-3 py-1 text-xs text-[#f3e7c7]/90"
                >
                  ← Zurück zu den Summen
                </Link>
              )}
            </div>
            <p className="mt-1 text-sm text-zinc-400">
              Oben: Summen pro Stunde (UTC). Unten: jede Stimme mit exaktem Zeitstempel — so erkennen Sie
              Sekunden-abständige Bot-Muster. Keine IP-Speicherung.
            </p>
            {note && <p className="mt-2 text-xs text-zinc-500">{note}</p>}
          </div>
          {authed && (
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="shrink-0 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-zinc-300"
            >
              Abmelden
            </button>
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

        {authed && rows && events && (
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-[#d6be86]/20 bg-white/[0.03] p-5 backdrop-blur-sm"
          >
            <h2 className="text-sm font-medium text-zinc-200">Stunden (aggregiert)</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Mehrere Stimmen in derselben Stunde erscheinen hier in einer Zeile zusammengezählt.
            </p>
            <div className="mb-4 mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-zinc-300">
                Zeitraum: letzte{" "}
                <select
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                  className="rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-[#f3e7c7]"
                >
                  <option value={7}>7 Tage</option>
                  <option value={14}>14 Tage</option>
                  <option value={30}>30 Tage</option>
                  <option value={90}>90 Tage</option>
                  <option value={365}>365 Tage</option>
                </select>
              </div>
              <button
                type="button"
                onClick={() => void loadLog()}
                className="rounded-full border border-[#d6be86]/20 bg-black/30 px-3 py-1 text-xs text-[#f3e7c7]/90"
              >
                Aktualisieren
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-xs text-zinc-500">
                    <th className="py-2 pr-3 font-medium">Stunde (UTC)</th>
                    <th className="py-2 pr-3 font-medium tabular-nums">Σ</th>
                    {CHOICE_KEYS.map((k) => (
                      <th key={k} className="py-2 pr-2 font-medium tabular-nums">
                        {DISPLAY_LABEL_BY_KEY[k]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-zinc-500">
                        Noch keine Einträge (nach erstem Stimme-Ereignis ab Update).
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => (
                      <tr key={r.hourUtc} className="border-b border-white/5 text-zinc-200">
                        <td className="py-2 pr-3 font-mono text-xs text-zinc-400">{r.hourUtc}</td>
                        <td className="py-2 pr-3 tabular-nums text-[#f3e7c7]">{r.total}</td>
                        {CHOICE_KEYS.map((k) => (
                          <td key={k} className="py-2 pr-2 tabular-nums text-zinc-300">
                            {r[k]}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-10 border-t border-white/10 pt-6">
              <h2 className="text-sm font-medium text-zinc-200">Einzelstimmen (UTC, chronologisch)</h2>
              <p className="mt-1 text-xs text-zinc-500">
                Neueste oben. Nur Stimmen nach Deployment dieser Funktion; ältere Stimmen fehlen.
              </p>
              <div className="mt-4 max-h-[min(480px,50vh)] overflow-auto rounded-xl border border-white/10">
                <table className="w-full min-w-[480px] border-collapse text-left text-sm">
                  <thead className="sticky top-0 bg-[#0b0b0c]/95 backdrop-blur">
                    <tr className="border-b border-white/10 text-xs text-zinc-500">
                      <th className="py-2 pl-3 pr-3 font-medium">Zeit (UTC)</th>
                      <th className="py-2 pr-3 font-medium">Wahl</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="px-3 py-6 text-center text-zinc-500">
                          Noch keine Einzelstimmen.
                        </td>
                      </tr>
                    ) : (
                      events.map((ev, idx) => (
                        <tr key={`${ev.t}-${idx}`} className="border-b border-white/5 text-zinc-200">
                          <td className="py-2 pl-3 pr-3 font-mono text-xs text-zinc-400">{ev.t}</td>
                          <td className="py-2 pr-3 text-zinc-300">{DISPLAY_LABEL_BY_KEY[ev.c]}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.section>
        )}

        {authed === null && (
          <div className="flex flex-1 items-center justify-center py-20">
            <div className="h-2 w-2 animate-pulse rounded-full bg-[#d6be86]" />
          </div>
        )}
      </main>
    </div>
  );
}
