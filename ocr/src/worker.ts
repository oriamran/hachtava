/* ==========================================================
   קורא דף הכתבה מצולם ומחזיר את המילים עם ניקוד.
   השרת קיים כדי להחזיק את מפתח ה-API במקום שאיש לא רואה.
   הוא לא שומר דבר: התמונה מעובדת ונשכחת.
   ========================================================== */
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

export interface Env {
  ANTHROPIC_API_KEY: string;
  ALLOWED_ORIGINS: string;
  RATE: KVNamespace;
}

const MAX_BYTES     = 6_000_000;   /* תמונה אחרי הקטנה בצד הלקוח */
const RATE_PER_HOUR = 20;          /* לכל כתובת IP */
const TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

const Words = z.object({
  words: z.array(z.string()).max(60)
    .describe("The dictation words, in the order they appear, fully vocalised"),
  note: z.string()
    .describe("A short note in Hebrew if anything was unclear, else an empty string")
});

const PROMPT = `בתמונה מופיע דף הכתבה של ילד בבית ספר יסודי בישראל.

החזר את רשימת המילים שהילד צריך ללמוד, לפי הסדר שבו הן מופיעות.

כללים:
- החזר כל מילה או צירוף מילים כפריט אחד ברשימה. "ראש השנה" הוא פריט אחד.
- נקד כל מילה ניקוד מלא ותקני, גם אם בדף היא כתובה ללא ניקוד.
- שמור על הכתיב שמופיע בדף. אם כתוב "כיפור" ביו"ד, אל תשנה ל"כפור".
- התעלם ממספור, מכותרות, מתאריכים ומהערות המורה.
- אם הדף מכיל את אותה מילה פעמיים, בכתב ובדפוס, החזר אותה פעם אחת.
- אם משהו לא קריא, דלג עליו וציין זאת בשדה note.`;

const cors = (origin: string | null, allowed: string[]) => {
  const ok = origin && allowed.includes(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin! : allowed[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };
};
const json = (body: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json; charset=utf-8" }
  });

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const allowed = (env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
    const origin  = req.headers.get("Origin");
    const head    = cors(origin, allowed);

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: head });
    if (req.method !== "POST")    return json({ error: "use POST" }, 405, head);

    /* רק הדפים שלנו. לא הגנה מוחלטת, אבל עוצרת שימוש מהדפדפן. */
    if (allowed.length && (!origin || !allowed.includes(origin)))
      return json({ error: "origin not allowed" }, 403, head);

    /* מגבלת קצב לפי IP — בלעדיה הכתובת פתוחה וכל אחד יכול לשרוף את החשבון */
    const ip = req.headers.get("CF-Connecting-IP") || "unknown";
    const key = `r:${ip}:${new Date().toISOString().slice(0, 13)}`;
    const used = parseInt((await env.RATE.get(key)) || "0", 10);
    if (used >= RATE_PER_HOUR)
      return json({ error: "הגעת למגבלה לשעה. נסה שוב בעוד כשעה." }, 429, head);
    await env.RATE.put(key, String(used + 1), { expirationTtl: 5400 });

    let body: { image?: string; mediaType?: string };
    try { body = await req.json(); } catch { return json({ error: "bad json" }, 400, head); }

    const b64 = (body.image || "").replace(/^data:[^,]+,/, "");
    const mediaType = body.mediaType || "image/jpeg";
    if (!b64)                                 return json({ error: "no image" }, 400, head);
    if (!TYPES.includes(mediaType as any))    return json({ error: "unsupported type" }, 400, head);
    if (b64.length * 0.75 > MAX_BYTES)        return json({ error: "image too large" }, 413, head);

    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    try {
      const res = await client.messages.parse({
        model: "claude-opus-5",
        max_tokens: 4000,
        thinking: { type: "adaptive" },
        output_config: { format: zodOutputFormat(Words) },
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType as any, data: b64 } },
            { type: "text", text: PROMPT }
          ]
        }]
      });

      if (res.stop_reason === "refusal")
        return json({ error: "התמונה נדחתה" }, 422, head);

      const out = res.parsed_output;
      if (!out) return json({ error: "לא הצלחתי לקרוא את הדף" }, 422, head);

      const words = out.words.map((w: string) => w.trim()).filter(Boolean);
      return json({ words, note: out.note || "" }, 200, head);

    } catch (err: unknown) {
      if (err instanceof Anthropic.RateLimitError)
        return json({ error: "השרת עמוס. נסה שוב בעוד רגע." }, 429, head);
      if (err instanceof Anthropic.AuthenticationError)
        return json({ error: "מפתח ה-API לא תקין" }, 500, head);
      if (err instanceof Anthropic.BadRequestError)
        return json({ error: "הבקשה נדחתה" }, 400, head);
      if (err instanceof Anthropic.APIConnectionError)
        return json({ error: "אין חיבור לשרת המודל" }, 502, head);
      if (err instanceof Anthropic.APIError)
        return json({ error: "שגיאה מהמודל (" + (err.status ?? "?") + ")" }, 502, head);
      return json({ error: "שגיאה לא צפויה" }, 500, head);
    }
  }
};
