import type { KvLike } from "@/lib/dev-kv-file";
import { getDevFileKvStore } from "@/lib/dev-kv-file";

export function envLooksConfiguredForKv(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

export async function getVoteKv(): Promise<KvLike> {
  if (envLooksConfiguredForKv()) {
    const mod = await import("@vercel/kv");
    return mod.kv as unknown as KvLike;
  }
  return getDevFileKvStore();
}
