import { createHash, timingSafeEqual } from "crypto";
import { COOKIE_NAME, createSessionToken } from "@/lib/admin-session";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

function hashPw(s: string): Buffer {
  return createHash("sha256").update(s, "utf8").digest();
}

function verifyPassword(input: string, expected: string): boolean {
  try {
    return timingSafeEqual(hashPw(input), hashPw(expected));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const expectedUser = (process.env.ADMIN_USERNAME ?? "admin").trim();
  const expectedPass = process.env.ADMIN_PASSWORD;
  if (!expectedPass || expectedPass.length < 1) {
    return NextResponse.json(
      { error: "server_misconfigured" },
      { status: 500 }
    );
  }

  let body: { username?: string; password?: string };
  try {
    body = (await req.json()) as { username?: string; password?: string };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const u = String(body.username ?? "").trim();
  const p = String(body.password ?? "");

  if (u !== expectedUser || !verifyPassword(p, expectedPass)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const token = createSessionToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60,
  });
  return res;
}
