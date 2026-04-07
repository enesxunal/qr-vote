import { createHash } from "crypto";
import { INITIAL_DISPLAY_VOTES, type VoteOptionKey } from "@/lib/vote";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

type HashValue = string | number;

type KvLike = {
  get: (key: string) => Promise<HashValue | null>;
  set: (key: string, value: HashValue, opts?: { ex?: number }) => Promise<void>;
  hlen: (key: string) => Promise<number>;
  hset: (key: string, obj: Record<string, HashValue>) => Promise<void>;
  hgetall: <T extends Record<string, HashValue>>(key: string) => Promise<Record<string, HashValue> | null>;
  hincrby: (key: string, field: string, inc: number) => Promise<number>;
};

const RAW_KEY = "raw_votes";
const DISPLAY_KEY = "display_votes";
const IP_PREFIX = "ip_vote:";
const ONE_DAY_SECONDS = 60 * 60 * 24;

function envLooksConfigured() {
  // Works for both legacy KV envs and Redis integrations on Vercel that
  // still expose KV-compatible env vars via @vercel/kv.
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

  function now() {
    return Date.now();
  }

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

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || "unknown";
  const xReal = req.headers.get("x-real-ip");
  if (xReal) return xReal.trim();
  return "unknown";
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

async function ensureSeeded() {
  const kv = await getKv();
  const len = await kv.hlen(DISPLAY_KEY);
  if (len && len > 0) return;

  await kv.hset(DISPLAY_KEY, INITIAL_DISPLAY_VOTES);
  await kv.hset(RAW_KEY, { pizza: 0, pasta: 0, burger: 0, vegan: 0 });
}

function isValidChoice(choice: unknown): choice is VoteOptionKey {
  return choice === "pizza" || choice === "pasta" || choice === "burger" || choice === "vegan";
}

async function readVotes(key: string) {
  const kv = await getKv();
  const data = (await kv.hgetall<Record<string, string | number>>(key)) || {};
  const pizza = Number(data.pizza ?? 0);
  const pasta = Number(data.pasta ?? 0);
  const burger = Number(data.burger ?? 0);
  const vegan = Number(data.vegan ?? 0);
  return { pizza, pasta, burger, vegan };
}

export async function GET(req: NextRequest) {
  await ensureSeeded();

  const { searchParams } = new URL(req.url);
  const view = searchParams.get("view");
  const key = view === "gold_admin" ? RAW_KEY : DISPLAY_KEY;
  const votes = await readVotes(key);

  return NextResponse.json({
    mode: view === "gold_admin" ? "raw" : "display",
    votes,
  });
}

export async function POST(req: NextRequest) {
  await ensureSeeded();
  const kv = await getKv();

  const ip = getClientIp(req);
  const ipHash = sha256(ip);
  const ipKey = `${IP_PREFIX}${ipHash}`;

  const alreadyVoted = await kv.get(ipKey);
  if (alreadyVoted) {
    return NextResponse.json(
      { error: "already_voted" },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const choice = (body as { choice?: unknown } | null)?.choice;
  if (!isValidChoice(choice)) {
    return NextResponse.json({ error: "invalid_choice" }, { status: 400 });
  }

  await kv.set(ipKey, 1, { ex: ONE_DAY_SECONDS });

  await kv.hincrby(RAW_KEY, choice, 1);
  await kv.hincrby(DISPLAY_KEY, choice, 1);

  // Pasta Advantage: always add +1 to Pasta in display votes
  await kv.hincrby(DISPLAY_KEY, "pasta", 1);

  const votes = await readVotes(DISPLAY_KEY);
  return NextResponse.json({ ok: true, votes });
}

