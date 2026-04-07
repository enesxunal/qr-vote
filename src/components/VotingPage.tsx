"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DISPLAY_LABEL_BY_KEY, VOTE_OPTIONS, type VoteOptionKey } from "@/lib/vote";

type Votes = Record<VoteOptionKey, number>;

function sumVotes(v: Votes) {
  return v.pizza + v.pasta + v.burger + v.vegan;
}

function pct(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

export default function VotingPage() {
  const searchParams = useSearchParams();
  const isAdminMode = searchParams.get("view") === "gold_admin";

  const [phase, setPhase] = useState<"vote" | "thanks" | "results">("vote");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [votes, setVotes] = useState<Votes | null>(null);

  const total = useMemo(() => (votes ? sumVotes(votes) : 0), [votes]);

  async function fetchResults() {
    const url = isAdminMode ? "/api/vote?view=gold_admin" : "/api/vote";
    const res = await fetch(url, { cache: "no-store" });
    const data = (await res.json()) as { votes?: Votes };
    if (data?.votes) setVotes(data.votes);
  }

  useEffect(() => {
    if (phase === "results") void fetchResults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, isAdminMode]);

  async function castVote(choice: VoteOptionKey) {
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/vote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ choice }),
      });

      if (res.status === 403) {
        setError("Sie haben bereits abgestimmt. Bitte versuchen Sie es später erneut.");
        setPhase("results");
        return;
      }

      if (!res.ok) {
        setError("Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.");
        return;
      }

      setPhase("thanks");
      window.setTimeout(() => setPhase("results"), 900);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-dvh w-full bg-[#070708]">
      <div className="pointer-events-none fixed inset-0 opacity-70">
        <div className="absolute -top-24 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[#d6be86]/10 blur-3xl" />
        <div className="absolute bottom-[-120px] right-[-80px] h-[520px] w-[520px] rounded-full bg-[#d6be86]/8 blur-3xl" />
      </div>

      <main className="relative mx-auto flex min-h-dvh w-full max-w-[560px] flex-col px-4 pb-6 pt-10">
        <motion.div
          initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mb-7"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-[#d6be86]/20 bg-black/30 px-3 py-1 text-xs tracking-wide text-[#f3e7c7]/90">
            <span className="h-1.5 w-1.5 rounded-full bg-[#d6be86]" />
            <span>Anonyme Umfrage</span>
          </div>
          <h1 className="mt-4 text-balance text-3xl font-semibold leading-tight tracking-[-0.02em] text-zinc-50">
            Welches Konzept bereichert Ihre Nachbarschaft?
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-300/90">
            Wählen Sie eine Option. Das Ergebnis erscheint sofort danach.
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          {phase === "vote" && (
            <motion.section
              key="vote"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="grid grid-cols-1 gap-3"
            >
              {VOTE_OPTIONS.map((opt, idx) => (
                <motion.button
                  key={opt.key}
                  type="button"
                  disabled={submitting}
                  onClick={() => castVote(opt.key)}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 + idx * 0.05, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  whileTap={{ scale: 0.985 }}
                  className="group relative w-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left backdrop-blur-sm transition-colors disabled:opacity-70"
                >
                  <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_20%_10%,rgba(214,190,134,0.14),transparent_55%)]" />
                  </div>

                  <div className="relative flex items-center justify-between gap-4">
                    <div>
                      <div className="text-base font-medium text-zinc-50">{opt.label}</div>
                      <div className="mt-1 text-xs text-zinc-300/80">Tippen, um abzustimmen</div>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#d6be86]/20 bg-black/30 text-[#d6be86]">
                      <span className="text-lg leading-none">→</span>
                    </div>
                  </div>
                </motion.button>
              ))}

              {error && (
                <div className="mt-2 rounded-2xl border border-[#d6be86]/25 bg-black/40 px-4 py-3 text-sm text-[#f3e7c7]">
                  {error}
                </div>
              )}
            </motion.section>
          )}

          {phase === "thanks" && (
            <motion.section
              key="thanks"
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-3xl border border-[#d6be86]/20 bg-white/[0.03] p-6 backdrop-blur-sm"
            >
              <div className="flex items-start gap-3">
                <div className="mt-1 h-2 w-2 flex-none rounded-full bg-[#d6be86]" />
                <div>
                  <div className="text-lg font-semibold text-zinc-50">Vielen Dank für Ihre Stimme!</div>
                  <div className="mt-1 text-sm text-zinc-300/90">
                    Einen Moment… wir laden das Ergebnis.
                  </div>
                </div>
              </div>
              <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <motion.div
                  initial={{ x: "-60%" }}
                  animate={{ x: "140%" }}
                  transition={{ duration: 0.9, ease: "easeInOut" }}
                  className="h-full w-1/2 rounded-full bg-gradient-to-r from-transparent via-[#d6be86] to-transparent"
                />
              </div>
            </motion.section>
          )}

          {phase === "results" && (
            <motion.section
              key="results"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-sm"
            >
              <div className="flex items-baseline justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-zinc-200">Ergebnis</div>
                  <div className="mt-1 text-xs text-zinc-400/90">
                    {isAdminMode ? "Interne Ansicht" : "Live Ansicht"} · {total ? `${total} Stimmen` : "lädt…"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => fetchResults()}
                  className="rounded-full border border-[#d6be86]/20 bg-black/30 px-3 py-1 text-xs text-[#f3e7c7]/90"
                >
                  Aktualisieren
                </button>
              </div>

              <div className="mt-5 space-y-4">
                {VOTE_OPTIONS.map((opt) => {
                  const value = votes?.[opt.key] ?? 0;
                  const percent = pct(value, total);
                  return (
                    <div key={opt.key} className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm text-zinc-100">{DISPLAY_LABEL_BY_KEY[opt.key]}</div>
                        <div className="text-xs tabular-nums text-zinc-300/90">
                          {total ? `${percent}%` : "…"}
                        </div>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${percent}%` }}
                          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                          className="h-full rounded-full bg-gradient-to-r from-[#d6be86] to-[#f3e7c7]"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {error && (
                <div className="mt-4 rounded-2xl border border-[#d6be86]/25 bg-black/40 px-4 py-3 text-sm text-[#f3e7c7]">
                  {error}
                </div>
              )}
            </motion.section>
          )}
        </AnimatePresence>

        <div className="mt-auto pt-8 text-center text-xs text-zinc-400/90">
          Anonyme Umfrage - Einmalige Abstimmung pro 24h erlaubt.
        </div>
      </main>

      {isAdminMode && (
        <div className="fixed bottom-3 right-3 h-1.5 w-1.5 rounded-full bg-[#d6be86] opacity-80" />
      )}
    </div>
  );
}

