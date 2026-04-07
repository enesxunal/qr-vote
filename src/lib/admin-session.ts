import { createHash, createHmac, timingSafeEqual } from "crypto";
import { DEFAULT_ADMIN_PASSWORD } from "@/lib/admin-defaults";

const COOKIE_NAME = "admin_session";

export { COOKIE_NAME };

function getSecret(): string {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (s && s.length >= 16) return s;
  const pass = process.env.ADMIN_PASSWORD ?? DEFAULT_ADMIN_PASSWORD;
  if (pass && pass.length >= 8) {
    return createHash("sha256").update(`admin_session_v1:${pass}`, "utf8").digest("hex");
  }
  if (process.env.NODE_ENV !== "production") {
    return "dev-only-admin-session-secret-change-me";
  }
  return createHash("sha256")
    .update(`admin_session_fallback:${process.env.VERCEL_URL ?? ""}`, "utf8")
    .digest("hex");
}

export function createSessionToken(): string {
  const payload = JSON.stringify({
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    v: 1,
  });
  const secret = getSecret();
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return `${Buffer.from(payload, "utf8").toString("base64url")}.${sig}`;
}

export function verifySessionToken(token: string | undefined): boolean {
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
  const secret = getSecret();
  const expectedSig = createHmac("sha256", secret).update(payload).digest("hex");
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
