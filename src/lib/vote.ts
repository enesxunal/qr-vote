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

export const INITIAL_DISPLAY_VOTES: Record<VoteOptionKey, number> = {
  pizza: 14,
  pasta: 48,
  burger: 11,
  vegan: 9,
};

