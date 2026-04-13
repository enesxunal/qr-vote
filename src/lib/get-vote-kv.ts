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

export function getRedisTcpUrl(): string | null {
  return (
    process.env.KV_REST_API_REDIS_URL ||
    process.env.REDIS_URL ||
    process.env.UPSTASH_REDIS_URL ||
    null
  );
}

async function getNodeRedisKv(redisUrl: string): Promise<KvLike> {
  const g = globalThis as unknown as {
    __nodeRedisClient?: { url: string; promise: Promise<unknown> };
  };

  if (!g.__nodeRedisClient || g.__nodeRedisClient.url !== redisUrl) {
    const mod = await import("redis");
    const client = mod.createClient({ url: redisUrl });
    g.__nodeRedisClient = {
      url: redisUrl,
      promise: (async () => {
        client.on("error", () => undefined);
        if (!client.isOpen) await client.connect();
        return client;
      })(),
    };
  }

  const client = (await g.__nodeRedisClient.promise) as {
    get: (k: string) => Promise<string | null>;
    set: (k: string, v: string) => Promise<unknown>;
    hLen: (k: string) => Promise<number>;
    hSet: (k: string, v: Record<string, string | number>) => Promise<unknown>;
    hGetAll: (k: string) => Promise<Record<string, string>>;
    hIncrBy: (k: string, f: string, inc: number) => Promise<number>;
    expire: (k: string, seconds: number) => Promise<unknown>;
    isOpen: boolean;
  };

  return {
    async get(key) {
      const v = await client.get(key);
      if (v === null) return null;
      const n = Number(v);
      return Number.isNaN(n) ? v : n;
    },
    async set(key, value, opts) {
      await client.set(key, String(value));
      if (opts?.ex) await client.expire(key, opts.ex);
    },
    async hlen(key) {
      return await client.hLen(key);
    },
    async hset(key, obj) {
      await client.hSet(key, obj);
    },
    async hgetall(key) {
      const res = await client.hGetAll(key);
      const keys = Object.keys(res);
      if (keys.length === 0) return null;
      const out: Record<string, string | number> = {};
      for (const k of keys) {
        const n = Number(res[k]);
        out[k] = Number.isNaN(n) ? res[k] : n;
      }
      return out;
    },
    async hincrby(key, field, inc) {
      return await client.hIncrBy(key, field, inc);
    },
  };
}

export async function getVoteKv(): Promise<KvLike> {
  mirrorUpstashToKvEnv();
  if (envLooksConfiguredForKv()) {
    const mod = await import("@vercel/kv");
    return mod.kv as unknown as KvLike;
  }
  const redisUrl = getRedisTcpUrl();
  if (redisUrl) {
    return await getNodeRedisKv(redisUrl);
  }
  if (process.env.VERCEL === "1") {
    // On Vercel, fallback-to-file causes apparent "random resets" across instances.
    // Fail loudly so configuration gets fixed instead of silently losing data.
    throw new Error(
      "[qr-vote] Redis env bulunamadı. KV_REST_API_URL/KV_REST_API_TOKEN veya UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN veya REDIS_URL ayarla."
    );
  }
  return getDevFileKvStore();
}
