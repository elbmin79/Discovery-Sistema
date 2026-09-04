import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { DemoSession } from "../types";

const sessionGlobal = globalThis as typeof globalThis & { discoverySessionSecret?: string };
const COOKIE = "discovery-auth";
const MAX_AGE = 12 * 60 * 60;

function secret() {
  return process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY ||
    (sessionGlobal.discoverySessionSecret ??= randomBytes(32).toString("hex"));
}

export function sessionCookie(session: DemoSession, secure: boolean) {
  const payload = Buffer.from(JSON.stringify({ ...session, expires: Date.now() + MAX_AGE * 1000 })).toString("base64url");
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${COOKIE}=${payload}.${signature}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${secure ? "; Secure" : ""}`;
}

export function serverSession(request: Request): DemoSession | null {
  try {
    const value = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
    if (!value) return null;
    const [payload, signature] = value.split(".");
    const expected = createHmac("sha256", secret()).update(payload).digest();
    const received = Buffer.from(signature, "base64url");
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
    const session = JSON.parse(Buffer.from(payload, "base64url").toString()) as DemoSession & { expires: number };
    return session.expires > Date.now() ? session : null;
  } catch {
    return null;
  }
}

export function clearSessionCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
