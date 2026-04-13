import { devListLpush, devListLrange } from "@/lib/dev-kv-file";
import { envLooksConfiguredForKv, getRedisTcpUrl } from "@/lib/get-vote-kv";
import type { VoteOptionKey } from "@/lib/vote";

const EVENTS_KEY = "vote_log:events";
const MAX_EVENTS = 10_000;

export type VoteEventRow = {
  /** ISO-8601 UTC */
  t: string;
  c: VoteOptionKey;
};

function isChoice(v: unknown): v is VoteOptionKey {
  return v === "pizza" || v === "pasta" || v === "burger" || v === "vegan";
}

let tcpSingleton: { url: string; promise: Promise<unknown> } | null = null;

async function getTcpRedisClient(redisUrl: string) {
  if (!tcpSingleton || tcpSingleton.url !== redisUrl) {
    const mod = await import("redis");
    const client = mod.createClient({ url: redisUrl });
    tcpSingleton = {
      url: redisUrl,
      promise: (async () => {
        client.on("error", () => undefined);
        if (!client.isOpen) await client.connect();
        return client;
      })(),
    };
  }
  return (await tcpSingleton.promise) as {
    lPush: (k: string, v: string) => Promise<number>;
    lTrim: (k: string, start: number, stop: number) => Promise<unknown>;
    lRange: (k: string, start: number, stop: number) => Promise<string[]>;
  };
}

export async function appendVoteEvent(choice: VoteOptionKey): Promise<void> {
  const payload = JSON.stringify({ t: new Date().toISOString(), c: choice } satisfies VoteEventRow);

  if (envLooksConfiguredForKv()) {
    const { kv } = await import("@vercel/kv");
    await kv.lpush(EVENTS_KEY, payload);
    await kv.ltrim(EVENTS_KEY, 0, MAX_EVENTS - 1);
    return;
  }

  const redisUrl = getRedisTcpUrl();
  if (redisUrl) {
    const c = await getTcpRedisClient(redisUrl);
    await c.lPush(EVENTS_KEY, payload);
    await c.lTrim(EVENTS_KEY, 0, MAX_EVENTS - 1);
    return;
  }

  await devListLpush(EVENTS_KEY, payload, MAX_EVENTS);
}

function parseRow(raw: string): VoteEventRow | null {
  try {
    const o = JSON.parse(raw) as { t?: unknown; c?: unknown };
    if (typeof o.t !== "string" || !isChoice(o.c)) return null;
    return { t: o.t, c: o.c };
  } catch {
    return null;
  }
}

/** Neueste zuerst (Index 0 = letzte Stimme). */
export async function getRecentVoteEvents(maxRows: number): Promise<VoteEventRow[]> {
  const stop = Math.max(0, Math.min(maxRows, MAX_EVENTS) - 1);

  if (envLooksConfiguredForKv()) {
    const { kv } = await import("@vercel/kv");
    const raw = await kv.lrange(EVENTS_KEY, 0, stop);
    return raw.map(parseRow).filter((x): x is VoteEventRow => x !== null);
  }

  const redisUrl = getRedisTcpUrl();
  if (redisUrl) {
    const c = await getTcpRedisClient(redisUrl);
    const raw = await c.lRange(EVENTS_KEY, 0, stop);
    return raw.map(parseRow).filter((x): x is VoteEventRow => x !== null);
  }

  const raw = await devListLrange(EVENTS_KEY, 0, stop);
  return raw.map(parseRow).filter((x): x is VoteEventRow => x !== null);
}
