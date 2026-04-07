import { verifySessionToken, COOKIE_NAME } from "@/lib/admin-session";
import { INITIAL_DISPLAY_VOTES, type VoteOptionKey } from "@/lib/vote";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

type HashValue = string | number;

type KvLike = {
  get: (key: string) => Promise<HashValue | null>;
  set: (key: string, value: HashValue, opts?: { ex?: number }) => Promise<void>;
  hlen: (key: string) => Promise<number>;
  hset: (key: string, obj: Record<string, HashValue>) => Promise<void>;
  hgetall: (key: string) => Promise<Record<string, HashValue> | null>;
  hincrby: (key: string, field: string, inc: number) => Promise<number>;
};

const RAW_KEY = "raw_votes";

function envLooksConfigured() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

function getDevStore(): KvLike {
  const g = globalThis as unknown as {
    __devKv?: {
      kv: Map<string, { value: HashValue; expiresAt?: number }>;
      hashes: Map<string, Map<string, number>>;
    };
  };
  if (!g.__devKv) g.__devKv = { kv: new Map(), hashes: new Map() };
  const store = g.__devKv;
  const now = () => Date.now();
  function gcKey(key: string) {
    const item = store.kv.get(key);
    if (!item) return;
    if (item.expiresAt && item.expiresAt <= now()) store.kv.delete(key);
  }
  return {
    async get(key) {
      gcKey(key);
      return store.kv.get(key)?.value ?? null;
    },
    async set(key, value, opts) {
      const ex = opts?.ex;
      store.kv.set(key, { value, expiresAt: ex ? now() + ex * 1000 : undefined });
    },
    async hlen(key) {
      return store.hashes.get(key)?.size ?? 0;
    },
    async hset(key, obj) {
      const map = store.hashes.get(key) ?? new Map<string, number>();
      for (const [k, v] of Object.entries(obj)) map.set(k, Number(v));
      store.hashes.set(key, map);
    },
    async hgetall(key) {
      const map = store.hashes.get(key);
      if (!map) return null;
      return Object.fromEntries(map.entries()) as Record<string, HashValue>;
    },
    async hincrby(key, field, inc) {
      const map = store.hashes.get(key) ?? new Map<string, number>();
      const next = (map.get(field) ?? 0) + inc;
      map.set(field, next);
      store.hashes.set(key, map);
      return next;
    },
  };
}

async function getKv(): Promise<KvLike> {
  if (!envLooksConfigured()) return getDevStore();
  const mod = await import("@vercel/kv");
  return mod.kv as unknown as KvLike;
}

async function ensureSeeded(kv: KvLike) {
  const len = await kv.hlen("display_votes");
  if (len && len > 0) return;
  await kv.hset("display_votes", INITIAL_DISPLAY_VOTES);
  await kv.hset(RAW_KEY, { pizza: 0, pasta: 0, burger: 0, vegan: 0 });
}

async function readRawVotes(kv: KvLike) {
  const data = (await kv.hgetall(RAW_KEY)) || {};
  const keys: VoteOptionKey[] = ["pizza", "pasta", "burger", "vegan"];
  const votes = {} as Record<VoteOptionKey, number>;
  for (const k of keys) {
    votes[k] = Number(data[k] ?? 0);
  }
  return votes;
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!verifySessionToken(token)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const kv = await getKv();
  await ensureSeeded(kv);
  const votes = await readRawVotes(kv);
  const total = votes.pizza + votes.pasta + votes.burger + votes.vegan;

  return NextResponse.json({
    mode: "raw",
    votes,
    total,
  });
}
