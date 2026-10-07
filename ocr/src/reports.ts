/* ==========================================================
   דיווחי בעיות מהמשחק.

   המשתמש כותב מה קרה, והמשחק מצרף מידע טכני: איזה מסך, איזו גרסה, איזה
   מכשיר, שגיאות אחרונות. לא נשמרים שם הילד ולא תמונות. אימייל נשמר רק
   אם ההורה מחובר וסימן "אפשר לחזור אליי".
   הדיווחים נשמרים ב-KV (קידומת r:) ל-60 יום, ונקראים בלוח הניהול
   או בסקריפט tools/reports.mjs.
   ========================================================== */
export interface ReportEnv { DATA: KVNamespace }

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, max: number, d = "") => (typeof v === "string") ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").slice(0, max) : d;
const num = (v: unknown, lo: number, hi: number, d = 0) => (typeof v === "number" && isFinite(v)) ? Math.min(hi, Math.max(lo, v)) : d;
const TTL = 60 * 86400;
const KINDS = ["bug", "idea", "confusing"];

export function sanitizeReport(raw: unknown): Obj | null {
  if (!isObj(raw)) return null;
  const text = str(raw.text, 1200).trim();
  if (text.length < 3) return null;
  const c = isObj(raw.ctx) ? raw.ctx : {};
  const ctx: Obj = {
    screen: str(c.screen, 30), game: str(c.game, 20), origin: str(c.origin, 20),
    level: str(c.level, 6), nikud: str(c.nikud, 6), nikudOn: c.nikudOn === true, script: str(c.script, 6),
    topic: str(c.topic, 60), words: num(c.words, 0, 1000), draft: c.draft === true,
    build: str(c.build, 40), vw: num(c.vw, 0, 20000), vh: num(c.vh, 0, 20000), dpr: num(c.dpr, 0, 10),
    ua: str(c.ua, 200), lang: str(c.lang, 12), online: c.online !== false, signedIn: c.signedIn === true,
    errs: Array.isArray(c.errs) ? c.errs.slice(0, 8).map(e => str(e, 240)) : [],
    snap: str(c.snap, 1500)
  };
  if (isObj(c.extra)) {
    const ex: Obj = {};
    for (const k of Object.keys(c.extra).slice(0, 12)) {
      const v = (c.extra as Obj)[k];
      if (typeof v === "number") ex[str(k, 20)] = num(v, -1e9, 1e9);
      else if (typeof v === "string") ex[str(k, 20)] = str(v, 80);
      else if (typeof v === "boolean") ex[str(k, 20)] = v;
    }
    ctx.extra = ex;
  }
  const email = raw.contact === true ? str(raw.email, 80).trim() : "";
  return {
    kind: KINDS.includes(raw.kind as string) ? raw.kind : "bug",
    text, ctx,
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : ""
  };
}

export async function saveReport(env: ReportEnv, rep: Obj): Promise<string> {
  const id = String(Date.now()).padStart(13, "0") + "-" + Math.random().toString(36).slice(2, 7);
  await env.DATA.put("r:" + id, JSON.stringify({ id, at: Date.now(), status: "new", ...rep }), { expirationTtl: TTL });
  return id;
}

export async function listReports(env: ReportEnv, limit = 60) {
  const keys: string[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 5; page++) {
    const r = await env.DATA.list({ prefix: "r:", cursor, limit: 1000 });
    keys.push(...r.keys.map(k => k.name));
    if (r.list_complete) break;
    cursor = r.cursor;
  }
  keys.sort().reverse();
  const out: unknown[] = [];
  const pick = keys.slice(0, Math.min(limit, 100));
  for (let i = 0; i < pick.length; i += 25) {
    const chunk = await Promise.all(pick.slice(i, i + 25).map(k => env.DATA.get(k)));
    for (const raw of chunk) { if (!raw) continue; try { out.push(JSON.parse(raw)); } catch { /* מדלגים */ } }
  }
  return { total: keys.length, reports: out };
}

export async function markReport(env: ReportEnv, id: string, action: string): Promise<boolean> {
  if (!/^\d{13}-[a-z0-9]{1,8}$/.test(id)) return false;
  const key = "r:" + id;
  if (action === "delete") { await env.DATA.delete(key); return true; }
  const raw = await env.DATA.get(key); if (!raw) return false;
  try { const r = JSON.parse(raw) as Obj; r.status = action === "done" ? "done" : "new"; await env.DATA.put(key, JSON.stringify(r), { expirationTtl: TTL }); return true; }
  catch { return false; }
}
