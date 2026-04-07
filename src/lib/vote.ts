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
 * Startwerte nur für die öffentliche Anzeige (display_votes), bevor echte Stimmen kommen.
 * Summe = 14+48+11+9 = 82. Beim ersten Vote zählt die Anzeige +1 für die gewählte Kategorie
 * und zusätzlich +1 für Pasta → Summe wird 84.
 *
 * Zum Anpassen: diese vier Zahlen ändern und (falls Redis/KV schon Daten hat) Store leeren
 * oder neue Keys nutzen — sonst bleiben alte Werte gespeichert.
 */
export const INITIAL_DISPLAY_VOTES: Record<VoteOptionKey, number> = {
  pizza: 14,
  pasta: 48,
  burger: 11,
  vegan: 9,
};

