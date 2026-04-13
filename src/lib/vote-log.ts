import type { KvLike } from "@/lib/dev-kv-file";
import type { VoteOptionKey } from "@/lib/vote";

const HOURLY_HASH = "vote_log:hourly";

/** UTC saat dilimi: `2026-04-13T14` (dakika yok). */
export function hourBucketUtc(d = new Date()): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}`;
}

export async function recordVoteLog(kv: KvLike, choice: VoteOptionKey): Promise<void> {
  const hour = hourBucketUtc();
  await kv.hincrby(HOURLY_HASH, `${hour}|total`, 1);
  await kv.hincrby(HOURLY_HASH, `${hour}|${choice}`, 1);
}

export type HourlyVoteRow = {
  hourUtc: string;
  total: number;
  pizza: number;
  pasta: number;
  burger: number;
  vegan: number;
};

export async function getHourlyVoteLog(kv: KvLike): Promise<HourlyVoteRow[]> {
  const rows = await kv.hgetall(HOURLY_HASH);
  if (!rows) return [];

  const byHour = new Map<string, Partial<Record<"total" | VoteOptionKey, number>>>();

  for (const [field, raw] of Object.entries(rows)) {
    const pipe = field.indexOf("|");
    if (pipe <= 0) continue;
    const hour = field.slice(0, pipe);
    const metric = field.slice(pipe + 1);
    const v = Number(raw) || 0;
    let m = byHour.get(hour);
    if (!m) {
      m = {};
      byHour.set(hour, m);
    }
    if (metric === "total") m.total = v;
    else if (metric === "pizza" || metric === "pasta" || metric === "burger" || metric === "vegan") {
      m[metric] = v;
    }
  }

  const hours = [...byHour.keys()].sort();
  return hours.map((hourUtc) => {
    const m = byHour.get(hourUtc)!;
    return {
      hourUtc,
      total: m.total ?? 0,
      pizza: m.pizza ?? 0,
      pasta: m.pasta ?? 0,
      burger: m.burger ?? 0,
      vegan: m.vegan ?? 0,
    };
  });
}
