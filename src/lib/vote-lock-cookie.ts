import { createHash, createHmac, timingSafeEqual } from "crypto";

/** HttpOnly cookie: one vote per browser/device per 24h (same WiFi = OK). */
export const VOTE_LOCK_COOKIE = "vote_24h_lock";

function getSecret(): string {
  const s = process.env.VOTE_LOCK_SECRET;
  if (s && s.length >= 16) return s;
  const pass = process.env.ADMIN_PASSWORD;
  if (pass && pass.length >= 8) {
    return createHash("sha256").update(`vote_lock_v1:${pass}`, "utf8").digest("hex");
  }
  const kv = process.env.KV_REST_API_TOKEN;
  if (kv && kv.length >= 16) {
    return createHash("sha256").update(`vote_lock_v1:${kv}`, "utf8").digest("hex");
  }
  if (process.env.NODE_ENV !== "production") {
    return "dev-only-vote-lock-secret-change-me";
  }
  throw new Error("Set VOTE_LOCK_SECRET, ADMIN_PASSWORD, or KV_REST_API_TOKEN");
}

export function createVoteLockToken(): string {
  const payload = JSON.stringify({
    exp: Date.now() + 24 * 60 * 60 * 1000,
    v: 1,
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
    return typeof parsed.exp === "number" && parsed.exp > Date.now() && parsed.v === 1;
  } catch {
    return false;
  }
}
