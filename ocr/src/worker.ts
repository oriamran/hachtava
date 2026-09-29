/* ==========================================================
   קורא דף הכתבה מצולם ומחזיר את המילים עם ניקוד.
   השרת קיים כדי להחזיק את מפתח ה-API במקום שאיש לא רואה.
   הוא לא שומר דבר: התמונה מגיעה, נקראת, ונשכחת.

   משתמש במכסה החינמית של Google AI Studio. אין כאן תלויות
   חיצוניות — רק fetch — כדי שהפריסה תהיה פקודה אחת.
   ========================================================== */
import { verifyGoogle, type User } from "./auth";
import { loadState, saveState } from "./sync";

export interface Env {
  GOOGLE_API_KEY: string;       /* למודל הראייה */
  GOOGLE_CLIENT_ID: string;     /* להתחברות */
  ALLOWED_ORIGINS: string;
  MODEL?: string;
  SCAN_TOKEN?: string;          /* אם מוגדר — סריקה דורשת אותו */
  ALLOWED_EMAILS?: string;      /* ואם מוגדר — רק החשבונות האלה */
  RATE: KVNamespace;            /* מכסות ומגבלות קצב */
  DATA: KVNamespace;            /* התקדמות המשתמשים */
}

const MAX_BYTES     = 6_000_000;   /* תמונה אחרי הקטנה בצד הלקוח */
const RATE_PER_HOUR = 20;          /* הגנה מפני ניצול, לפי כתובת IP */
const FREE_PER_MONTH = 3;          /* מכסת הסריקות החופשית, לכל מכשיר */

/* המכסה החינמית של המודל שייכת למפתח, לא למשתמש. בלי מונה
   לכל מכשיר, משתמש אחד כבד מסיים אותה לכולם. מכאן שהמונה
   הוא תנאי לכך שזה יעבוד, ולא רק מנוף עסקי. */
const ID_RE = /^[0-9a-f-]{8,40}$/i;
const month = () => new Date().toISOString().slice(0, 7);
const TYPES = ["image/jpeg", "image/png", "image/webp"];
/* רשימה, לא מודל אחד: המכסה החינמית נופלת מדי פעם בעומס,
   ואז עוברים לבא בתור במקום להחזיר שגיאה למשתמש. */
/* נמדד: gemini-flash-lite-latest מחזיר עשר מילים עבריות תקינות
   ומנוקדות — וכולן מומצאות. הוא לא קורא את התמונה אלא מנחש לפי
   הקשר. לכן הוא לא ברשימה: עדיף להיכשל מאשר ללמד מילה שגויה. */
const DEFAULT_MODELS = "gemini-3.8-flash,gemini-flash-latest";
const BASE = "https://generativelanguage.googleapis.com/v1beta";

const PROMPT = `בתמונה מופיע דף הכתבה של ילד בבית ספר יסודי בישראל.

החזר את רשימת המילים שהילד צריך ללמוד, לפי הסדר שבו הן מופיעות.

כללים:
- החזר כל מילה או צירוף מילים כפריט אחד ברשימה. "ראש השנה" הוא פריט אחד.
- נקד כל מילה ניקוד מלא ותקני, גם אם בדף היא כתובה ללא ניקוד.
- שמור על הכתיב שמופיע בדף. אם כתוב "כיפור" ביו"ד, אל תשנה ל"כפור".
- התעלם ממספור, מכותרות, מתאריכים ומהערות המורה.
- אם אותה מילה מופיעה פעמיים, בכתב ובדפוס, החזר אותה פעם אחת.
- אם משהו לא קריא, דלג עליו וציין זאת בשדה note.`;

/* מבנה התשובה נכפה על המודל, כדי לא לנתח טקסט חופשי */
const SCHEMA = {
  type: "OBJECT",
  properties: {
    words: { type: "ARRAY", items: { type: "STRING" } },
    note:  { type: "STRING" }
  },
  required: ["words", "note"]
};

const cors = (origin: string | null, allowed: string[]) => ({
  "Access-Control-Allow-Origin": (origin && allowed.includes(origin)) ? origin : (allowed[0] || "*"),
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400"
});
const json = (body: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json; charset=utf-8" }
  });

/* כשהמודל לא נמצא, עדיף להגיד אילו כן זמינים מאשר "404" */
async function modelHint(key: string): Promise<string> {
  try {
    const r = await fetch(`${BASE}/models?key=${key}`);
    if (!r.ok) return "";
    const d = await r.json() as { models?: { name?: string; supportedGenerationMethods?: string[] }[] };
    const names = (d.models || [])
      .filter(m => (m.supportedGenerationMethods || []).includes("generateContent"))
      .map(m => (m.name || "").replace("models/", ""))
      .filter(n => n.includes("flash") || n.includes("pro"))
      .slice(0, 6);
    return names.length ? " זמינים: " + names.join(", ") : "";
  } catch { return ""; }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const allowed = (env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
    const origin  = req.headers.get("Origin");
    const head    = cors(origin, allowed);

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: head });

    const path = new URL(req.url).pathname.replace(/\/+$/, "");

    /* ---- סנכרון ההתקדמות. דורש התחברות, ולכן מזוהה ויציב. ---- */
    if (path === "/sync") {
      const tok = (req.headers.get("Authorization") || "").replace(/^Bearer /, "");
      const user = await verifyGoogle(tok, env.GOOGLE_CLIENT_ID);
      if (!user) return json({ error: "\u05d4\u05ea\u05d7\u05d1\u05e8\u05d5\u05ea \u05e0\u05d3\u05e8\u05e9\u05ea" }, 401, head);

      if (req.method === "GET") {
        const r = await loadState(env, user);
        return new Response(await r.text(), { status: 200, headers: { ...head, "Content-Type": "application/json; charset=utf-8" } });
      }
      if (req.method === "POST") {
        let b: { state?: unknown; at?: number };
        try { b = await req.json(); } catch { return json({ error: "bad json" }, 400, head); }
        const out = await saveState(env, user, b.state, Number(b.at) || Date.now());
        return json(out, out.ok ? 200 : (out.stale ? 409 : 413), head);
      }
      return json({ error: "use GET or POST" }, 405, head);
    }

    if (req.method !== "POST") return json({ error: "use POST" }, 405, head);

    /* רק הדפים שלנו. לא הגנה מוחלטת, אבל עוצרת שימוש מדפדפן זר. */
    if (allowed.length && (!origin || !allowed.includes(origin)))
      return json({ error: "origin not allowed" }, 403, head);

    /* ---- נעילת הסריקה ----
       כל עוד זה בבנייה, רק מי שמחזיק את הקוד סורק. כשיהיה
       חיבור גוגל, ALLOWED_EMAILS יחליף את זה בזהות אמיתית. */
    if (env.SCAN_TOKEN && req.headers.get("X-Scan-Token") !== env.SCAN_TOKEN)
      return json({ error: "\u05d4\u05e1\u05e8\u05d9\u05e7\u05d4 \u05e1\u05d2\u05d5\u05e8\u05d4 \u05db\u05e8\u05d2\u05e2", locked: true }, 403, head);

    /* מגבלת קצב לפי IP — בלעדיה הכתובת פתוחה וכל אחד יכול לשרוף את המכסה */
    const ip  = req.headers.get("CF-Connecting-IP") || "unknown";
    const key = `r:${ip}:${new Date().toISOString().slice(0, 13)}`;
    const used = parseInt((await env.RATE.get(key)) || "0", 10);
    if (used >= RATE_PER_HOUR)
      return json({ error: "הגעת למגבלה לשעה. נסה שוב בעוד כשעה." }, 429, head);
    await env.RATE.put(key, String(used + 1), { expirationTtl: 5400 });

    let body: { image?: string; mediaType?: string; deviceId?: string };
    try { body = await req.json(); } catch { return json({ error: "bad json" }, 400, head); }

    /* מכסה חודשית. חשבון מזוהה עדיף על מזהה מכשיר, שאפשר
       לאפס בניקוי אחסון — זו כל הנקודה של ההתחברות. */
    const tok = (req.headers.get("Authorization") || "").replace(/^Bearer /, "");
    const user: User | null = tok ? await verifyGoogle(tok, env.GOOGLE_CLIENT_ID) : null;
    const emails = (env.ALLOWED_EMAILS || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
    if (emails.length) {
      if (!user) return json({ error: "\u05d4\u05ea\u05d7\u05d1\u05e8\u05d5\u05ea \u05e0\u05d3\u05e8\u05e9\u05ea", locked: true }, 401, head);
      if (!emails.includes((user.email || "").toLowerCase()))
        return json({ error: "\u05d4\u05d7\u05e9\u05d1\u05d5\u05df \u05d4\u05d6\u05d4 \u05dc\u05d0 \u05de\u05d5\u05e8\u05e9\u05d4", locked: true }, 403, head);
    }
    const dev = user ? ("g" + user.sub) : String(body.deviceId || "");
    if (!user && !ID_RE.test(dev)) return json({ error: "missing device id" }, 400, head);
    const sub = await env.RATE.get(`sub:${dev}`);
    const unlimited = !!sub && sub > new Date().toISOString().slice(0, 10);
    const qKey = `q:${dev}:${month()}`;
    const usedMonth = parseInt((await env.RATE.get(qKey)) || "0", 10);
    if (!unlimited && usedMonth >= FREE_PER_MONTH)
      return json({
        error: `\u05e0\u05d9\u05e6\u05dc\u05ea \u05d0\u05ea ${FREE_PER_MONTH} \u05d4\u05e1\u05e8\u05d9\u05e7\u05d5\u05ea \u05d4\u05d7\u05d5\u05d3\u05e9\u05d9\u05d5\u05ea.`,
        quota: { used: usedMonth, limit: FREE_PER_MONTH, unlimited: false },
        upgrade: true
      }, 402, head);

    const b64 = (body.image || "").replace(/^data:[^,]+,/, "");
    const mediaType = body.mediaType || "image/jpeg";
    if (!b64)                            return json({ error: "no image" }, 400, head);
    if (!TYPES.includes(mediaType))      return json({ error: "unsupported type" }, 400, head);
    if (b64.length * 0.75 > MAX_BYTES)   return json({ error: "image too large" }, 413, head);

    const models = String(env.MODEL || DEFAULT_MODELS).split(",").map(m => m.trim()).filter(Boolean);
    const payload = JSON.stringify({
      contents: [{
        parts: [
          { inline_data: { mime_type: mediaType, data: b64 } },
          { text: PROMPT }
        ]
      }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: SCHEMA,
        temperature: 0
      }
    });

    let res: Response | null = null;
    let lastStatus = 0, lastDetail = "", usedModel = "";
    for (const model of models) {
      usedModel = model;
      try {
        res = await fetch(`${BASE}/models/${model}:generateContent?key=${env.GOOGLE_API_KEY}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload
        });
      } catch {
        return json({ error: "\u05d0\u05d9\u05df \u05d7\u05d9\u05d1\u05d5\u05e8 \u05dc\u05e9\u05e8\u05ea \u05d4\u05de\u05d5\u05d3\u05dc" }, 502, head);
      }
      if (res.ok) break;
      lastStatus = res.status;
      lastDetail = await res.text().catch(() => "");
      /* עמוס או לא קיים — ננסה את הבא. שאר השגיאות אמיתיות. */
      if (res.status !== 503 && res.status !== 429 && res.status !== 404) break;
      res = null;
    }

    if (!res || !res.ok) {
      if (lastStatus === 404)
        return json({ error: `\u05d4\u05de\u05d5\u05d3\u05dc \u05dc\u05d0 \u05e0\u05de\u05e6\u05d0.` + await modelHint(env.GOOGLE_API_KEY) }, 502, head);
      if (lastStatus === 429)
        return json({ error: "\u05e0\u05d2\u05de\u05e8\u05d4 \u05d4\u05de\u05db\u05e1\u05d4 \u05d4\u05d7\u05d9\u05e0\u05de\u05d9\u05ea \u05dc\u05e2\u05ea \u05e2\u05ea\u05d4. \u05e0\u05e1\u05d4 \u05de\u05d0\u05d5\u05d7\u05e8 \u05d9\u05d5\u05ea\u05e8." }, 429, head);
      if (lastStatus === 503)
        return json({ error: "\u05db\u05dc \u05d4\u05de\u05d5\u05d3\u05dc\u05d9\u05dd \u05e2\u05de\u05d5\u05e1\u05d9\u05dd \u05db\u05e8\u05d2\u05e2. \u05e0\u05e1\u05d4 \u05e9\u05d5\u05d1 \u05d1\u05e2\u05d5\u05d3 \u05d3\u05e7\u05d4." }, 503, head);
      if (lastStatus === 400 && /API_KEY|api key/i.test(lastDetail))
        return json({ error: "\u05de\u05e4\u05ea\u05d7 \u05d4-API \u05dc\u05d0 \u05ea\u05e7\u05d9\u05df" }, 500, head);
      return json({ error: `\u05e9\u05d2\u05d9\u05d0\u05d4 \u05de\u05d4\u05de\u05d5\u05d3\u05dc (${lastStatus})`, detail: lastDetail.slice(0, 400) }, 502, head);
    }

    let data: any;
    try { data = await res.json(); } catch { return json({ error: "תשובה לא תקינה" }, 502, head); }

    const cand = data?.candidates?.[0];
    if (!cand || cand.finishReason === "SAFETY")
      return json({ error: "התמונה נדחתה" }, 422, head);

    const text = (cand.content?.parts || []).map((p: any) => p.text || "").join("");
    let out: { words?: unknown; note?: unknown };
    try { out = JSON.parse(text); }
    catch { return json({ error: "לא הצלחתי לקרוא את הדף" }, 422, head); }

    const words = Array.isArray(out.words)
      ? out.words.map(w => String(w).trim()).filter(Boolean).slice(0, 60)
      : [];
    if (!words.length)
      return json({ error: "לא מצאתי מילים בתמונה" }, 422, head);

    /* נספר רק קריאה שהצליחה — לא הוגן לחייב על כישלון */
    if (!unlimited) await env.RATE.put(qKey, String(usedMonth + 1), { expirationTtl: 60 * 60 * 24 * 40 });

    return json({
      words,
      note: typeof out.note === "string" ? out.note : "",
      model: usedModel,
      quota: { used: unlimited ? 0 : usedMonth + 1, limit: FREE_PER_MONTH, unlimited,
               signedIn: !!user }
    }, 200, head);
  }
};
