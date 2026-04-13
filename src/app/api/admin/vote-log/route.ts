import { verifySessionToken, COOKIE_NAME } from "@/lib/admin-session";
import type { KvLike } from "@/lib/dev-kv-file";
import { getVoteKv } from "@/lib/get-vote-kv";
import { getDisplaySeedForStorage } from "@/lib/vote";
import { getHourlyVoteLog } from "@/lib/vote-log";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

const RAW_KEY = "raw_votes";

async function ensureSeeded(kv: KvLike) {
  const len = await kv.hlen("display_votes");
  if (len && len > 0) return;
  await kv.hset("display_votes", getDisplaySeedForStorage());
  await kv.hset(RAW_KEY, { pizza: 0, pasta: 0, burger: 0, vegan: 0 });
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!verifySessionToken(token)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const kv = await getVoteKv();
    await ensureSeeded(kv);
    const hourly = await getHourlyVoteLog(kv);
    const reversed = [...hourly].reverse();

    const daysParam = req.nextUrl.searchParams.get("days");
    let rows = reversed;
    if (daysParam) {
      const days = Number.parseInt(daysParam, 10);
      if (!Number.isNaN(days) && days > 0) {
        const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
        rows = reversed.filter((r) => {
          const d = new Date(`${r.hourUtc}:00:00.000Z`);
          return d.getTime() >= cutoff;
        });
      }
    }

    return NextResponse.json({
      timezone: "UTC",
      hourly: rows,
      note:
        "Stündliche Zähler ab Deployment dieser Funktion; ältere Stimmen haben keine Zeitreihe.",
    });
  } catch (e) {
    console.error("[GET /api/admin/vote-log]", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
