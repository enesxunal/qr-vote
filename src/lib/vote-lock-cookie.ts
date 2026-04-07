import { createHash, createHmac, timingSafeEqual } from "crypto";

/** HttpOnly cookie: one vote per browser/device per 24h. Bump name to invalidate all locks after rule changes. */
export const VOTE_LOCK_COOKIE = "vote_24h_lock_v2";

const PAYLOAD_VERSION = 2 as const;

function getSecret(): string {
  const s = process.env.VOTE_LOCK_SECRET;
  if (s && s.length >= 16) return s;
  const pass = process.env.ADMIN_PASSWORD;
  if (pass && pass.length >= 8) {
    return createHash("sha256").update(`vote_lock_v2:${pass}`, "utf8").digest("hex");
  }
  const kv = process.env.KV_REST_API_TOKEN;
  if (kv && kv.length >= 8) {
    return createHash("sha256").update(`vote_lock_v2:${kv}`, "utf8").digest("hex");
  }
  const upstash = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (upstash && upstash.length >= 8) {
    return createHash("sha256").update(`vote_lock_v2:${upstash}`, "utf8").digest("hex");
  }
  if (process.env.NODE_ENV !== "production") {
    return "dev-only-vote-lock-secret-change-me";
  }
  /** Vercel: env adları değişebilir; asla throw etme (500 engellemesin). Proje bazlı sabit. */
  return createHash("sha256")
    .update(
      `vote_lock_fallback:${process.env.VERCEL_URL ?? ""}:${process.env.VERCEL_PROJECT_ID ?? "local"}`,
      "utf8"
    )
    .digest("hex");
}

export function createVoteLockToken(): string {
  const payload = JSON.stringify({
    exp: Date.now() + 24 * 60 * 60 * 1000,
    v: PAYLOAD_VERSION,
  });
  const sig = createHmac("sha256", getSecret()).update(payload).digest("hex");
  return `${Buffer.from(payload, "utf8").toString("base64url")}.${sig}`;
}

export function verifyVoteLockToken(token: string | undefined): boolean {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const b64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  let payload: string;
  try {
    payload = Buffer.from(b64, "base64url").toString("utf8");
  } catch {
    return false;
  }
  const expectedSig = createHmac("sha256", getSecret()).update(payload).digest("hex");
  try {
    if (!timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expectedSig, "hex"))) {
      return false;
    }
  } catch {
    return false;
  }
  try {
    const parsed = JSON.parse(payload) as { exp?: number; v?: number };
    return (
      typeof parsed.exp === "number" &&
      parsed.exp > Date.now() &&
      parsed.v === PAYLOAD_VERSION
    );
  } catch {
    return false;
  }
}
