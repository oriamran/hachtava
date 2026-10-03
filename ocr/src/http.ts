/* ==========================================================
   שכבת ה-HTTP המשותפת: כותרות אבטחה, CORS, קריאת גוף עם תקרה,
   והשוואה בזמן קבוע. כל תשובה של השרת עוברת דרך json().
   ========================================================== */

const SECURITY: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
};

/* אם המקור אינו ברשימה לא שולחים ACAO בכלל. הגרסה הקודמת החזירה את
   המקור הראשון ברשימה גם למי שלא ברשימה, וזה לא עוצר כלום. */
export function corsHeaders(origin: string | null, allowed: string[]): Record<string, string> {
  const h: Record<string, string> = { "Vary": "Origin" };
  if (origin && allowed.includes(origin)) {
    h["Access-Control-Allow-Origin"] = origin;
    h["Access-Control-Allow-Methods"] = "GET, POST, DELETE, OPTIONS";
    h["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Scan-Token";
    h["Access-Control-Max-Age"] = "600";
  }
  return h;
}

export const json = (body: unknown, status: number, head: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...SECURITY, ...head, "Content-Type": "application/json; charset=utf-8" }
  });

export const empty = (status: number, head: Record<string, string> = {}) =>
  new Response(null, { status, headers: { ...SECURITY, ...head } });

/* קורא גוף JSON עם תקרה. בודק קודם את Content-Length כדי לא לקרוא
   גוף ענק לזיכרון, ואחר כך את האורך בפועל, כי הכותרת ניתנת לשקר. */
export async function readJson(req: Request, max: number):
  Promise<{ ok: true; data: any } | { ok: false; status: number; error: string }> {
  const len = parseInt(req.headers.get("Content-Length") || "0", 10);
  if (len > max) return { ok: false, status: 413, error: "too large" };
  let text: string;
  try { text = await req.text(); } catch { return { ok: false, status: 400, error: "bad body" }; }
  if (text.length > max) return { ok: false, status: 413, error: "too large" };
  try { return { ok: true, data: JSON.parse(text) }; }
  catch { return { ok: false, status: 400, error: "bad json" }; }
}

/* השוואה בזמן קבוע, כדי שזמן התגובה לא יסגיר כמה תווים נכונים */
export function safeEq(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let d = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) d |= (x[i] || 0) ^ (y[i] || 0);
  return d === 0;
}

/* הגבלת קצב בזיכרון, לכל מופע של השרת. לא משותפת בין מופעים ולכן
   חלשה מ-KV, אבל היא עולה אפס, וכתיבה ל-KV בכל בקשה הייתה שורפת את
   מכסת 1,000 הכתיבות היומית. מיועדת לנתיבים שדורשים התחברות, ששם
   המזהה הוא חשבון ולא כתובת. */
const buckets = new Map<string, { n: number; t: number }>();
export function memLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now - b.t > windowMs) {
    if (buckets.size > 5000) buckets.clear();
    buckets.set(key, { n: 1, t: now });
    return true;
  }
  b.n++;
  return b.n <= max;
}
