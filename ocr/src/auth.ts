/* ==========================================================
   אימות התחברות גוגל.
   הלקוח שולח ID token, כאן מוודאים אותו מול גוגל ומקבלים
   מזהה יציב. מזהה מכשיר אפשר לאפס בניקוי אחסון; זה לא.

   נשמר רק מה שנחוץ: המזהה של גוגל, ותאריך. לא שם, לא תמונה.
   ========================================================== */
export interface User { sub: string; email: string }

const CERTS = "https://www.googleapis.com/oauth2/v3/certs";
let keys: { k: Record<string, CryptoKey>; at: number } = { k: {}, at: 0 };

const b64url = (s: string) => {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(pad + "=".repeat((4 - pad.length % 4) % 4));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
};

async function keyFor(kid: string): Promise<CryptoKey | null> {
  /* מפתחות גוגל מתחלפים; שעה זה מרווח בטוח */
  if (Date.now() - keys.at > 3_600_000) {
    const res = await fetch(CERTS);
    if (!res.ok) return null;
    const jwks = await res.json() as { keys: (JsonWebKey & { kid: string })[] };
    const k: Record<string, CryptoKey> = {};
    for (const jwk of jwks.keys) {
      k[jwk.kid] = await crypto.subtle.importKey(
        "jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]
      );
    }
    keys = { k, at: Date.now() };
  }
  return keys.k[kid] || null;
}

/* מאמת מקומית מול המפתחות הציבוריים — בלי קריאת רשת לכל בקשה */
export async function verifyGoogle(token: string, clientId: string): Promise<User | null> {
  const parts = (token || "").split(".");
  if (parts.length !== 3) return null;
  let head: { kid?: string; alg?: string };
  let body: { iss?: string; aud?: string; exp?: number; sub?: string; email?: string; email_verified?: boolean };
  try {
    head = JSON.parse(new TextDecoder().decode(b64url(parts[0])));
    body = JSON.parse(new TextDecoder().decode(b64url(parts[1])));
  } catch { return null; }

  if (head.alg !== "RS256" || !head.kid) return null;
  const key = await keyFor(head.kid);
  if (!key) return null;

  const ok = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5", key,
    b64url(parts[2]),
    new TextEncoder().encode(parts[0] + "." + parts[1])
  );
  if (!ok) return null;

  const iss = body.iss || "";
  if (iss !== "accounts.google.com" && iss !== "https://accounts.google.com") return null;
  if (body.aud !== clientId) return null;
  if (!body.exp || body.exp * 1000 < Date.now()) return null;
  if (!body.sub) return null;

  return { sub: body.sub, email: body.email || "" };
}
