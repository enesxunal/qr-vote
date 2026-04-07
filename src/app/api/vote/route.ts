import { getVoteKv } from "@/lib/get-vote-kv";
import {
  createVoteLockToken,
  verifyVoteLockToken,
  VOTE_LOCK_COOKIE,
} from "@/lib/vote-lock-cookie";
import { INITIAL_DISPLAY_VOTES, type VoteOptionKey } from "@/lib/vote";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

const RAW_KEY = "raw_votes";
const DISPLAY_KEY = "display_votes";
const ONE_DAY_SECONDS = 60 * 60 * 24;

async function ensureSeeded() {
  const kv = await getVoteKv();
  const len = await kv.hlen(DISPLAY_KEY);
  if (len && len > 0) return;

  await kv.hset(DISPLAY_KEY, INITIAL_DISPLAY_VOTES);
  await kv.hset(RAW_KEY, { pizza: 0, pasta: 0, burger: 0, vegan: 0 });
}

function isValidChoice(choice: unknown): choice is VoteOptionKey {
  return choice === "pizza" || choice === "pasta" || choice === "burger" || choice === "vegan";
}

async function readVotes(key: string) {
  const kv = await getVoteKv();
  const data =
    ((await kv.hgetall(key)) as Record<string, string | number> | null) ?? {};
  const pizza = Number(data.pizza ?? 0);
  const pasta = Number(data.pasta ?? 0);
  const burger = Number(data.burger ?? 0);
  const vegan = Number(data.vegan ?? 0);
  return { pizza, pasta, burger, vegan };
}

export async function GET() {
  await ensureSeeded();
  const votes = await readVotes(DISPLAY_KEY);

  return NextResponse.json({
    mode: "display",
    votes,
  });
}

export async function POST(req: NextRequest) {
  await ensureSeeded();
  const kv = await getVoteKv();

  /** Aynı WiFi = aynı dış IP; bu yüzden IP yerine tarayıcı çerezi (cihaz başına 24 saat). */
  const lock = req.cookies.get(VOTE_LOCK_COOKIE)?.value;
  if (verifyVoteLockToken(lock)) {
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

  await kv.hincrby(RAW_KEY, choice, 1);
  await kv.hincrby(DISPLAY_KEY, choice, 1);

  // Pasta Advantage: always add +1 to Pasta in display votes
  await kv.hincrby(DISPLAY_KEY, "pasta", 1);

  const votes = await readVotes(DISPLAY_KEY);
  const res = NextResponse.json({ ok: true, votes });
  res.cookies.set(VOTE_LOCK_COOKIE, createVoteLockToken(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: ONE_DAY_SECONDS,
  });
  return res;
}
