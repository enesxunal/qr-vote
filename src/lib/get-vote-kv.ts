import type { KvLike } from "@/lib/dev-kv-file";
import { getDevFileKvStore } from "@/lib/dev-kv-file";

/**
 * Vercel Redis entegrasyonu genelde UPSTASH_* verir; @vercel/kv ise KV_REST_* bekler.
 */
function mirrorUpstashToKvEnv(): void {
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
  return getDevFileKvStore();
}
