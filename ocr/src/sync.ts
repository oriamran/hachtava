/* ==========================================================
   סנכרון ההתקדמות.
   השרת מחזיק עותק אחד לכל משתמש, עם חותמת זמן. מי שכתב
   אחרון מנצח — פשוט, ומתאים למציאות שבה ילד אחד משחק על
   מכשיר אחד בכל רגע. אין כאן מיזוג, בכוונה: מיזוג שגוי של
   התקדמות גרוע מאשר לאבד מהלך אחד.
   ========================================================== */
import type { User } from "./auth";

export interface SyncEnv { DATA: KVNamespace }

const MAX_STATE = 200_000;          /* פרופיל כתב מלא הוא ~10KB */
const key = (u: User) => `s:${u.sub}`;

export async function loadState(env: SyncEnv, user: User): Promise<Response> {
  const raw = await env.DATA.get(key(user));
  return new Response(raw || JSON.stringify({ state: null, at: 0 }), {
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

export async function saveState(
  env: SyncEnv, user: User, state: unknown, at: number
): Promise<{ ok: boolean; at: number; stale?: boolean }> {
  const body = JSON.stringify({ state, at });
  if (body.length > MAX_STATE) return { ok: false, at: 0 };

  const prev = await env.DATA.get(key(user));
  if (prev) {
    try {
      const old = JSON.parse(prev) as { at?: number };
      /* המכשיר הזה מחזיק עותק ישן יותר — לא דורסים */
      if ((old.at || 0) > at) return { ok: false, at: old.at || 0, stale: true };
    } catch { /* פגום — נכתוב מחדש */ }
  }
  await env.DATA.put(key(user), body);
  return { ok: true, at };
}
