export const VOTE_OPTIONS = [
  { key: "pizza", label: "Hausgemachte Pizza" },
  { key: "pasta", label: "Hausgemachte Pasta" },
  { key: "burger", label: "Premium Steak Burger" },
  { key: "vegan", label: "Vegane Köstlichkeiten" },
] as const;

export type VoteOptionKey = (typeof VOTE_OPTIONS)[number]["key"];

export const DISPLAY_LABEL_BY_KEY: Record<VoteOptionKey, string> = {
  pizza: "Hausgemachte Pizza",
  pasta: "Hausgemachte Pasta",
  burger: "Premium Steak Burger",
  vegan: "Vegane Köstlichkeiten",
};

/**
 * Code-Standard, falls keine Umgebungsvariablen gesetzt sind.
 * Überschreiben ohne Code: in Vercel (oder .env) z. B.
 *   VOTE_DISPLAY_SEED_PIZZA=20
 *   VOTE_DISPLAY_SEED_PASTA=40
 *   VOTE_DISPLAY_SEED_BURGER=15
 *   VOTE_DISPLAY_SEED_VEGAN=10
 * Nur bei leerem Redis/KV greift das Seeding erneut — sonst Store leeren.
 */
export const INITIAL_DISPLAY_VOTES: Record<VoteOptionKey, number> = {
  pizza: 14,
  pasta: 48,
  burger: 11,
  vegan: 9,
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

