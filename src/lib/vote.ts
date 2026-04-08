export const VOTE_OPTIONS = [
  { key: "pizza", label: "Hausgemachte Pizza" },
  { key: "pasta", label: "Hausgemachte Pasta" },
  { key: "burger", label: "Hausgemachtes Fried Chicken" },
  { key: "vegan", label: "Vegane Köstlichkeiten" },
] as const;

export type VoteOptionKey = (typeof VOTE_OPTIONS)[number]["key"];

export const DISPLAY_LABEL_BY_KEY: Record<VoteOptionKey, string> = {
  pizza: "Hausgemachte Pizza",
  pasta: "Hausgemachte Pasta",
  burger: "Hausgemachtes Fried Chicken",
  vegan: "Vegane Köstlichkeiten",
};

/**
 * Standard: alles 0 — Zähler steigen nur durch echte Stimmen (plus Pasta-Boost in display_votes).
 * Optional künstliche Startwerte (Marketing): Vercel-Env VOTE_DISPLAY_SEED_PIZZA usw.
 * Greift nur, wenn Redis/KV noch leer ist.
 */
export const INITIAL_DISPLAY_VOTES: Record<VoteOptionKey, number> = {
  pizza: 0,
  pasta: 0,
  burger: 0,
  vegan: 0,
};

const SEED_ENV_KEYS: Record<VoteOptionKey, string> = {
  pizza: "VOTE_DISPLAY_SEED_PIZZA",
  pasta: "VOTE_DISPLAY_SEED_PASTA",
  burger: "VOTE_DISPLAY_SEED_BURGER",
  vegan: "VOTE_DISPLAY_SEED_VEGAN",
};

/** Startzahlen für display_votes: Env schlägt Code-Defaults. */
export function getDisplaySeedForStorage(): Record<VoteOptionKey, number> {
  const out = {} as Record<VoteOptionKey, number>;
  for (const k of Object.keys(INITIAL_DISPLAY_VOTES) as VoteOptionKey[]) {
    const raw = process.env[SEED_ENV_KEYS[k]];
    if (raw !== undefined && raw !== "") {
      const n = Number.parseInt(String(raw), 10);
      if (!Number.isNaN(n) && n >= 0) {
        out[k] = n;
        continue;
      }
    }
    out[k] = INITIAL_DISPLAY_VOTES[k];
  }
  return out;
}

