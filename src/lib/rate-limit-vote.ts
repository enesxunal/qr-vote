import { envLooksConfiguredForKv } from "@/lib/get-vote-kv";
import { getClientIp } from "@/lib/client-ip";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Wenn VOTE_RATE_LIMIT_PER_MINUTE gesetzt und @vercel/kv verfügbar:
 * max. N Stimmen pro IP pro Minute (Sliding-Fenster grob per Minuten-Bucket).
 */
export async function rateLimitVoteOr429(req: NextRequest): Promise<NextResponse | null> {
  const raw = process.env.VOTE_RATE_LIMIT_PER_MINUTE;
  if (!raw) return null;
  const limit = Number.parseInt(raw, 10);
  if (Number.isNaN(limit) || limit <= 0) return null;
  if (!envLooksConfiguredForKv()) return null;

  const ip = getClientIp(req);
  const bucket = Math.floor(Date.now() / 60000);
  const key = `vote_rl:${ip}:${bucket}`;

  const { kv } = await import("@vercel/kv");
  const n = await kv.incr(key);
  if (n === 1) await kv.expire(key, 120);

  if (n > limit) {
    return NextResponse.json(
      { error: "rate_limited", message: "Zu viele Anfragen. Bitte später erneut." },
      { status: 429 }
    );
  }
  return null;
}
