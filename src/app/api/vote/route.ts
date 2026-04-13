import { randomUUID } from "crypto";
import { getVoteKv } from "@/lib/get-vote-kv";
import { rateLimitVoteOr429 } from "@/lib/rate-limit-vote";
import { recordVoteLog } from "@/lib/vote-log";
import { getDisplaySeedForStorage, type VoteOptionKey } from "@/lib/vote";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

const RAW_KEY = "raw_votes";
const DISPLAY_KEY = "display_votes";
const ONE_DAY_SECONDS = 60 * 60 * 24;
const PASTA_TARGET_GAP = Number.parseInt(
  process.env.PASTA_TARGET_GAP ?? "10",
  10
);

/** Anonim tarayıcı kimliği (WiFi paylaşılsa bile cihaz başına farklı). */
const SID_COOKIE = "vote_sid";

function doneKey(sid: string) {
  return `vote_done:${sid}`;
}

async function ensureSeeded() {
  const kv = await getVoteKv();
  const len = await kv.hlen(DISPLAY_KEY);
  if (len && len > 0) return;

  await kv.hset(DISPLAY_KEY, getDisplaySeedForStorage());
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

function sidCookieOpts() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 365 * 24 * 60 * 60,
  };
}

export async function GET(req: NextRequest) {
  try {
    await ensureSeeded();
    const votes = await readVotes(DISPLAY_KEY);

    const res = NextResponse.json({
      mode: "display",
      votes,
    });

    if (!req.cookies.get(SID_COOKIE)?.value) {
      res.cookies.set(SID_COOKIE, randomUUID(), sidCookieOpts());
    }
    return res;
  } catch (e) {
    console.error("[GET /api/vote]", e);
    return NextResponse.json(
      { error: "server_error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const limited = await rateLimitVoteOr429(req);
    if (limited) return limited;

    await ensureSeeded();
    const kv = await getVoteKv();

    let sid = req.cookies.get(SID_COOKIE)?.value;
    const isNewSid = !sid;
    if (!sid) sid = randomUUID();

    const already = await kv.get(doneKey(sid));
    if (already) {
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
    /**
     * Pasta Advantage (more natural):
     * Keep Pasta generally leading, but avoid runaway dominance by only boosting
     * when Pasta is not ahead of the best other option by at least target gap.
     */
    if (!Number.isNaN(PASTA_TARGET_GAP) && PASTA_TARGET_GAP > 0) {
      const display = await readVotes(DISPLAY_KEY);
      const bestOther = Math.max(display.pizza, display.burger, display.vegan);
      const gap = display.pasta - bestOther;
      if (gap < PASTA_TARGET_GAP) {
        await kv.hincrby(DISPLAY_KEY, "pasta", 1);
      }
    }

    try {
      await recordVoteLog(kv, choice);
    } catch (e) {
      console.error("[recordVoteLog]", e);
    }

    await kv.set(doneKey(sid), 1, { ex: ONE_DAY_SECONDS });

    const votes = await readVotes(DISPLAY_KEY);
    const res = NextResponse.json({ ok: true, votes });
    if (isNewSid) {
      res.cookies.set(SID_COOKIE, sid, sidCookieOpts());
    }
    return res;
  } catch (e) {
    console.error("[POST /api/vote]", e);
    return NextResponse.json(
      { error: "server_error" },
      { status: 500 }
    );
  }
}
