import { envLooksConfiguredForKv } from "@/lib/get-vote-kv";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function maskUrl(u: string | undefined) {
  if (!u) return null;
  try {
    const url = new URL(u);
    return `${url.protocol}//${url.host}`;
  } catch {
    return "invalid_url";
  }
}

export async function GET() {
  const hasKv = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
  const hasUpstash = Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );
  const hasRedisTcp = Boolean(
    process.env.KV_REST_API_REDIS_URL ||
      process.env.REDIS_URL ||
      process.env.UPSTASH_REDIS_URL
  );

  return NextResponse.json({
    vercel: process.env.VERCEL === "1",
    kvEnvDetected: envLooksConfiguredForKv(),
    hasKvEnv: hasKv,
    hasUpstashEnv: hasUpstash,
    hasRedisTcpEnv: hasRedisTcp,
    kvUrlHost: maskUrl(process.env.KV_REST_API_URL),
    upstashUrlHost: maskUrl(process.env.UPSTASH_REDIS_REST_URL),
  });
}

