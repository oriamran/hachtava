/* ==========================================================
   קורא דף הכתבה מצולם ומחזיר את המילים עם ניקוד.
   השרת קיים כדי להחזיק את מפתח ה-API במקום שאיש לא רואה.
   הוא לא שומר דבר: התמונה מגיעה, נקראת, ונשכחת.

   משתמש במכסה החינמית של Google AI Studio. אין כאן תלויות
   חיצוניות — רק fetch — כדי שהפריסה תהיה פקודה אחת.
   ========================================================== */
export interface Env {
  GOOGLE_API_KEY: string;
  ALLOWED_ORIGINS: string;
  MODEL?: string;
  RATE: KVNamespace;
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
const DEFAULT_MODEL = "gemini-2.5-flash";
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
    if (req.method !== "POST")    return json({ error: "use POST" }, 405, head);

    /* רק הדפים שלנו. לא הגנה מוחלטת, אבל עוצרת שימוש מדפדפן זר. */
    if (allowed.length && (!origin || !allowed.includes(origin)))
      return json({ error: "origin not allowed" }, 403, head);

    /* מגבלת קצב לפי IP — בלעדיה הכתובת פתוחה וכל אחד יכול לשרוף את המכסה */
    const ip  = req.headers.get("CF-Connecting-IP") || "unknown";
    const key = `r:${ip}:${new Date().toISOString().slice(0, 13)}`;
    const used = parseInt((await env.RATE.get(key)) || "0", 10);
    if (used >= RATE_PER_HOUR)
      return json({ error: "הגעת למגבלה לשעה. נסה שוב בעוד כשעה." }, 429, head);
    await env.RATE.put(key, String(used + 1), { expirationTtl: 5400 });

    let body: { image?: string; mediaType?: string; deviceId?: string };
    try { body = await req.json(); } catch { return json({ error: "bad json" }, 400, head); }

    /* מכסה חודשית לכל מכשיר, ומנוי שמבטל אותה */
    const dev = String(body.deviceId || "");
    if (!ID_RE.test(dev)) return json({ error: "missing device id" }, 400, head);
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

    const model = env.MODEL || DEFAULT_MODEL;
    let res: Response;
    try {
      res = await fetch(`${BASE}/models/${model}:generateContent?key=${env.GOOGLE_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
        })
      });
    } catch {
      return json({ error: "אין חיבור לשרת המודל" }, 502, head);
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      if (res.status === 404)
        return json({ error: `המודל "${model}" לא נמצא.` + await modelHint(env.GOOGLE_API_KEY) }, 502, head);
      if (res.status === 429)
        return json({ error: "נגמרה המכסה החינמית לעת עתה. נסה מאוחר יותר." }, 429, head);
      if (res.status === 400 && /API_KEY|api key/i.test(detail))
        return json({ error: "מפתח ה-API לא תקין" }, 500, head);
      return json({ error: `שגיאה מהמודל (${res.status})` }, 502, head);
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
      quota: { used: unlimited ? 0 : usedMonth + 1, limit: FREE_PER_MONTH, unlimited }
    }, 200, head);
  }
};
