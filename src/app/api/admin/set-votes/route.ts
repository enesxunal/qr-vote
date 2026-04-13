import { verifySessionToken, COOKIE_NAME } from "@/lib/admin-session";
import { getVoteKv } from "@/lib/get-vote-kv";
import type { VoteOptionKey } from "@/lib/vote";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

const RAW_KEY = "raw_votes";
const DISPLAY_KEY = "display_votes";

function parseNonNegInt(v: unknown): number {
  const n = Math.floor(Number(v));
  if (Number.isNaN(n) || n < 0) return 0;
  return n;
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!verifySessionToken(token)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const o = (body ?? {}) as Record<string, unknown>;
  const votes = {
    pizza: parseNonNegInt(o.pizza),
    pasta: parseNonNegInt(o.pasta),
    burger: parseNonNegInt(o.burger),
    vegan: parseNonNegInt(o.vegan),
  } satisfies Record<VoteOptionKey, number>;

  try {
    const kv = await getVoteKv();
    await kv.hset(RAW_KEY, votes);
    await kv.hset(DISPLAY_KEY, votes);
    const total = votes.pizza + votes.pasta + votes.burger + votes.vegan;
    return NextResponse.json({ ok: true, votes, total });
  } catch (e) {
    console.error("[POST /api/admin/set-votes]", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
