import { verifySessionToken, COOKIE_NAME } from "@/lib/admin-session";
import type { KvLike } from "@/lib/dev-kv-file";
import { getVoteKv } from "@/lib/get-vote-kv";
import { INITIAL_DISPLAY_VOTES, type VoteOptionKey } from "@/lib/vote";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

const RAW_KEY = "raw_votes";

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

  const kv = await getVoteKv();
  await ensureSeeded(kv);
  const votes = await readRawVotes(kv);
  const total = votes.pizza + votes.pasta + votes.burger + votes.vegan;

  return NextResponse.json({
    mode: "raw",
    votes,
    total,
  });
}
