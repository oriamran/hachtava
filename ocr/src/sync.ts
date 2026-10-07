/* ==========================================================
   סנכרון ההתקדמות, סיכום שימוש, ולוח הניהול.

   כל מה שמגיע מהלקוח נחשב לא אמין: הוא עובר ניקוי לפי רשימה
   לבנה לפני שהוא נשמר, כי אחרת אפשר לשמור כאן כל דבר בכל גודל.

   נשמר רק מה שנחוץ: מזהה גוגל, אימייל, והתקדמות המשחק. לא נשמרים
   תמונות ולא שם הילד. מחיקה: deleteState.
   ========================================================== */
import type { User } from "./auth";

export interface SyncEnv { DATA: KVNamespace }

const MAX_STATE = 200_000;          /* פרופיל כתב מלא הוא ~10KB */
const MIN_WRITE_GAP_MS = 15_000;    /* כתיבות ל-KV מוגבלות ל-1,000 ביום בחינם */
const key = (u: { sub: string }) => `s:${u.sub}`;
const BAD_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const okKey = (k: string) => !BAD_KEYS.has(k);

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown, lo: number, hi: number, d = 0) =>
  (typeof v === "number" && isFinite(v)) ? Math.min(hi, Math.max(lo, v)) : d;
const str = (v: unknown, max: number, d = "") => (typeof v === "string") ? v.slice(0, max) : d;
const strList = (v: unknown, n: number, max: number) =>
  Array.isArray(v) ? v.filter(x => typeof x === "string").slice(0, n).map(x => (x as string).slice(0, max)) : [];

/* רשימה לבנה. כל מפתח אחר נזרק, וכל ערך מקבל סוג וגבולות. */
export function sanitizeState(raw: unknown): Obj | null {
  if (!isObj(raw)) return null;
  const s: Obj = {};
  s.name        = str(raw.name, 30);
  s.onboarded   = raw.onboarded === true;
  s.peekAlways  = raw.peekAlways === true;
  s.avatar      = str(raw.avatar, 20, "fox");
  s.hat         = str(raw.hat, 20, "none");
  s.ring        = str(raw.ring, 20, "sun");
  s.bg          = str(raw.bg, 20, "day");
  s.pet         = str(raw.pet, 20, "none");
  s.owned       = strList(raw.owned, 100, 20);
  s.xp          = num(raw.xp, 0, 10_000_000);
  s.coins       = num(raw.coins, 0, 10_000_000);
  s.wins        = num(raw.wins, 0, 1_000_000);
  s.updatedAt   = num(raw.updatedAt, 0, 8.64e15);
  s.pack        = str(raw.pack, 40);
  s.level       = ["a2", "d4", "f6"].includes(raw.level as string) ? raw.level : "a2";
  s.nikud       = ["auto", "on", "off"].includes(raw.nikud as string) ? raw.nikud : "auto";
  s.tour        = raw.tour === true;
  s.album       = strList(raw.album, 2000, 60);

  const packs = Array.isArray(raw.packs) ? raw.packs.slice(0, 40) : [];
  s.packs = packs.filter(isObj).map(p => ({
    id: str(p.id, 40), topic: str(p.topic, 80), prize: str(p.prize, 80),
    list: strList(p.list, 200, 60),
    draft: p.draft === true, libId: str(p.libId, 40)
  }));

  const stats: Obj = {};
  if (isObj(raw.stats)) for (const k of Object.keys(raw.stats).slice(0, 2000)) {
    const v = raw.stats[k]; if (!isObj(v) || !okKey(k)) continue;
    const e: Obj = { ok: num(v.ok, 0, 1e6), bad: num(v.bad, 0, 1e6), run: num(v.run, 0, 1e6),
                     lv: num(v.lv, 0, 20), last: num(v.last, 0, 8.64e15) };
    if (typeof v.st === "number") e.st = num(v.st, 0, 4);     /* שלב בסולם: 0 חדשה עד 4 נכתבה */
    stats[k.slice(0, 60)] = e;
  }
  s.stats = stats;

  const stars: Obj = {};
  if (isObj(raw.stars)) for (const k of Object.keys(raw.stars).slice(0, 100)) if (okKey(k)) stars[k.slice(0, 6)] = num(raw.stars[k], 0, 3);
  s.stars = stars;

  const log: Obj = {};
  if (isObj(raw.log)) for (const k of Object.keys(raw.log).sort().slice(-400)) {
    const v = raw.log[k]; if (!isObj(v) || !/^\d{4}-\d{2}-\d{2}$/.test(k)) continue;
    log[k] = { sec: num(v.sec, 0, 86400), right: num(v.right, 0, 1e5), wrong: num(v.wrong, 0, 1e5), rounds: num(v.rounds, 0, 1e5) };
  }
  s.log = log;

  const d = isObj(raw.daily) ? raw.daily : {};
  s.daily = { last: str(d.last, 40), streak: num(d.streak, 0, 100000), chal: str(d.chal, 12) };

  /* עולם הבנייה: שינויים בבסיס64 (מוגבל בגודל) ושורת בלוקים קצרה */
  const bd = isObj(raw.build) ? raw.build : {};
  s.build = { e: (typeof bd.e === "string" && /^[A-Za-z0-9+/=]*$/.test(bd.e)) ? bd.e.slice(0, 100000) : "",
              hot: Array.isArray(bd.hot) ? bd.hot.filter((n): n is number => Number.isInteger(n) && n > 0 && n < 200).slice(0, 9) : [] };
  const u = isObj(raw.usage) ? raw.usage : {};
  const games: Obj = {};
  if (isObj(u.games)) for (const g of Object.keys(u.games).slice(0, 20)) {
    const v = u.games[g]; if (!isObj(v) || !/^[a-z]{3,12}$/.test(g)) continue;
    games[g] = { sec: num(v.sec, 0, 1e8), rounds: num(v.rounds, 0, 1e6), right: num(v.right, 0, 1e7), wrong: num(v.wrong, 0, 1e7) };
  }
  const hist: Obj = {};
  if (isObj(u.hist)) for (const d of Object.keys(u.hist).sort().slice(-120)) {
    const v = u.hist[d]; if (!isObj(v) || !/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
    hist[d] = { xp: num(v.xp, 0, 1e7), e: num(v.e, 0, 1000) };
  }
  s.usage = { first: num(u.first, 0, 8.64e15), last: num(u.last, 0, 8.64e15),
              visits: num(u.visits, 0, 1e7), activeSec: num(u.activeSec, 0, 1e9), games, hist };

  /* פרופיל כתב יד: אות -> {n, s:[192 מספרים]} */
  const hand: Obj = {};
  if (isObj(raw.hand)) for (const k of Object.keys(raw.hand).slice(0, 40)) {
    const v = raw.hand[k]; if (!isObj(v) || !Array.isArray(v.s) || !okKey(k)) continue;
    hand[k.slice(0, 2)] = { n: num(v.n, 0, 1000), s: v.s.slice(0, 192).map(x => num(x, 0, 1000)) };
  }
  s.hand = hand;

  const letters: Obj = {};
  if (isObj(raw.letters)) for (const k of Object.keys(raw.letters).slice(0, 40)) {
    const v = raw.letters[k]; if (!isObj(v) || !okKey(k)) continue;
    letters[k.slice(0, 2)] = { ok: num(v.ok, 0, 1e6), bad: num(v.bad, 0, 1e6) };
  }
  s.letters = letters;
  return s;
}

const plain = (w: string) => w.replace(/[\u0591-\u05C7]/g, "");

/* סיכום למנהל. בלי שם הילד: מזהים לפי אימייל ההורה בלבד.
   כולל גם איפה הילד נתקע: המילים והאותיות עם שיעור הטעויות הגבוה. */
export function summarize(user: User, st: Obj) {
  const u = st.usage as { first: number; last: number; visits: number; activeSec: number;
                          games: Record<string, unknown>; hist: Record<string, { xp: number; e: number }> };
  const packs = st.packs as { id: string; list: string[] }[];
  const pack = packs.find(p => p.id === st.pack) || packs[0] || { list: [] };
  const stats = st.stats as Record<string, { ok: number; bad: number; run: number }>;
  const album = new Set((st.album as string[]).map(plain));
  const words = [...new Set(pack.list.map(plain))];
  const earned = words.filter(w => album.has(w) || (stats[w] && stats[w].run >= 3)).length;
  const xp = st.xp as number;

  /* נתקע = טעה לפחות פעמיים ועדיין לא נכבשה. הכי הרבה טעויות קודם. */
  const stuck = Object.entries(stats)
    .filter(([w, v]) => v.bad >= 2 && v.run < 3 && !album.has(w))
    .sort((a, b) => b[1].bad - a[1].bad).slice(0, 8)
    .map(([w, v]) => ({ w, bad: v.bad, ok: v.ok }));
  const weakLetters = Object.entries(st.letters as Record<string, { ok: number; bad: number }>)
    .filter(([, v]) => v.ok + v.bad >= 5 && v.bad > 0)
    .sort((a, b) => b[1].bad / (b[1].ok + b[1].bad) - a[1].bad / (a[1].ok + a[1].bad)).slice(0, 5)
    .map(([l, v]) => ({ l, bad: v.bad, ok: v.ok }));

  const hist = Object.entries(u.hist).sort().slice(-60).map(([d, v]) => [d, v.xp, v.e]);
  const log = st.log as Record<string, { sec: number }>;
  const days = Object.keys(log).sort().slice(-30).map(d => [d, log[d].sec]);
  return {
    email: user.email,
    first: u.first, last: u.last, visits: u.visits, sec: u.activeSec,
    xp, level: Math.floor(xp / 120) + 1, grade: st.level,
    earned, words: words.length,
    streak: (st.daily as { streak: number }).streak,
    stars: Object.values(st.stars as Record<string, number>).reduce((a, b) => a + b, 0),
    games: u.games, hist, days, stuck, weakLetters
  };
}

export async function loadState(env: SyncEnv, user: User): Promise<{ state: unknown; at: number }> {
  const raw = await env.DATA.get(key(user));
  if (!raw) return { state: null, at: 0 };
  try { const r = JSON.parse(raw) as { state: unknown; at: number }; return { state: r.state, at: r.at || 0 }; }
  catch { return { state: null, at: 0 }; }
}

export async function saveState(
  env: SyncEnv, user: User, rawState: unknown, at: number
): Promise<{ ok: boolean; at: number; stale?: boolean; skipped?: boolean; invalid?: boolean }> {
  const state = sanitizeState(rawState);
  if (!state) return { ok: false, at: 0, invalid: true };

  const prevRaw = await env.DATA.get(key(user));
  let created = Date.now();
  if (prevRaw) {
    try {
      const old = JSON.parse(prevRaw) as { at?: number; serverAt?: number; created?: number };
      if (old.created) created = old.created;
      /* המכשיר הזה מחזיק עותק ישן יותר — לא דורסים */
      if ((old.at || 0) > at) return { ok: false, at: old.at || 0, stale: true };
      /* כתיבה אחרונה הייתה לפני רגע — מדלגים. הלקוח ידחוף שוב בעוד רגע. */
      if (Date.now() - (old.serverAt || 0) < MIN_WRITE_GAP_MS) return { ok: true, at, skipped: true };
    } catch { /* פגום — נכתוב מחדש */ }
  }
  const body = JSON.stringify({ state, at, serverAt: Date.now(), created, summary: summarize(user, state) });
  if (body.length > MAX_STATE) return { ok: false, at: 0 };
  await env.DATA.put(key(user), body);
  return { ok: true, at };
}

/* מחיקה לפי בקשת המשתמש. מוחק את הרשומה כולה. */
export async function deleteState(env: SyncEnv, user: User): Promise<void> {
  await env.DATA.delete(key(user));
}

/* לוח הניהול: כמה נרשמו, ולכל אחד סיכום. קורא רק את הסיכומים. */
export async function adminList(env: SyncEnv) {
  const keys: string[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 5; page++) {
    const r = await env.DATA.list({ prefix: "s:", cursor, limit: 1000 });
    keys.push(...r.keys.map(k => k.name));
    if (r.list_complete) { cursor = undefined; break; }
    cursor = r.cursor;
  }
  const users: unknown[] = [];
  for (let i = 0; i < keys.length; i += 40) {
    const chunk = await Promise.all(keys.slice(i, i + 40).map(k => env.DATA.get(k)));
    for (const raw of chunk) {
      if (!raw) continue;
      try { const j = JSON.parse(raw) as { summary?: unknown; serverAt?: number; created?: number };
            if (j.summary) users.push({ ...(j.summary as object), saved: j.serverAt || 0, created: j.created || j.serverAt || 0 }); } catch { /* מדלגים */ }
    }
  }
  (users as { last: number }[]).sort((a, b) => b.last - a.last);
  return { total: keys.length, truncated: !!cursor, users };
}
