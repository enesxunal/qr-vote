import type { KvLike } from "@/lib/dev-kv-file";
import { getDevFileKvStore } from "@/lib/dev-kv-file";

/**
 * Vercel Redis entegrasyonu genelde UPSTASH_* verir; @vercel/kv ise KV_REST_* bekler.
 */
function mirrorUpstashToKvEnv(): void {
  // Some integrations add custom prefixes; support common accidental variants.
  if (!process.env.KV_REST_API_URL && (process.env as Record<string, string | undefined>)["KV_REST_API_URL_URL"]) {
    process.env.KV_REST_API_URL = (process.env as Record<string, string | undefined>)["KV_REST_API_URL_URL"];
  }
  if (!process.env.KV_REST_API_TOKEN && (process.env as Record<string, string | undefined>)["KV_REST_API_TOKEN_TOKEN"]) {
    process.env.KV_REST_API_TOKEN = (process.env as Record<string, string | undefined>)["KV_REST_API_TOKEN_TOKEN"];
  }

  if (!process.env.KV_REST_API_URL && process.env.UPSTASH_REDIS_REST_URL) {
    process.env.KV_REST_API_URL = process.env.UPSTASH_REDIS_REST_URL;
  }
  if (!process.env.KV_REST_API_TOKEN && process.env.UPSTASH_REDIS_REST_TOKEN) {
    process.env.KV_REST_API_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
  }
}

export function envLooksConfiguredForKv(): boolean {
  mirrorUpstashToKvEnv();
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

export async function getVoteKv(): Promise<KvLike> {
  mirrorUpstashToKvEnv();
  if (envLooksConfiguredForKv()) {
    const mod = await import("@vercel/kv");
    return mod.kv as unknown as KvLike;
  }
  if (process.env.VERCEL === "1") {
    // On Vercel, fallback-to-file causes apparent "random resets" across instances.
    // Fail loudly so configuration gets fixed instead of silently losing data.
    throw new Error(
      "[qr-vote] Redis env bulunamadı. KV_REST_API_URL/KV_REST_API_TOKEN veya UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN ayarla."
    );
  }
  return getDevFileKvStore();
}
