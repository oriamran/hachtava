/* ==========================================================
   ניקוי קלט. כל מה שנכנס למצב המשחק ממקור שאינו הקוד עצמו עובר
   כאן: מה שהוקלד, קוד גיבוי, התקדמות מהשרת, אחסון מקומי פגום.

   הסיבה: עשרות מקומות בונים HTML מטקסט של מילים ושמות. במקום
   להקפיד על כל אחד מהם, מוודאים שטקסט כזה לעולם לא מכיל תו
   שהופך אותו לתגית. מילה בעברית לא צריכה את התווים האלה.
   ========================================================== */
H.cleanText = (s, max) =>
  String(s == null ? '' : s).replace(/[<>&\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, max || 80);

/* לטקסט שמגיע מהשרת ומוצג — למקרים שבהם בכל זאת בונים HTML */
H.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g,
  c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

H.BAD_KEYS = {'__proto__':1, 'constructor':1, 'prototype':1};

H.cleanState = function(raw){
  const base = H.blank();
  if(!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
  const isO = v => v && typeof v === 'object' && !Array.isArray(v);
  const num = (v, lo, hi, d) => (typeof v === 'number' && isFinite(v)) ? Math.min(hi, Math.max(lo, v)) : (d || 0);
  const T   = (v, max, d) => typeof v === 'string' ? H.cleanText(v, max) : (d || '');
  const L   = (v, n, max) => Array.isArray(v)
      ? v.filter(x => typeof x === 'string').slice(0, n).map(x => H.cleanText(x, max)) : [];
  const keys = (o, n) => isO(o) ? Object.keys(o).filter(k => !H.BAD_KEYS[k]).slice(0, n) : [];
  const s = base;

  s.name = T(raw.name, 30); s.onboarded = raw.onboarded === true; s.peekAlways = raw.peekAlways === true;
  s.avatar = T(raw.avatar, 20, 'fox'); s.hat = T(raw.hat, 20, 'none'); s.ring = T(raw.ring, 20, 'sun');
  s.bg = T(raw.bg, 20, 'day'); s.pet = T(raw.pet, 20, 'none');
  s.owned = L(raw.owned, 100, 20);
  s.xp = num(raw.xp, 0, 1e7); s.coins = num(raw.coins, 0, 1e7); s.wins = num(raw.wins, 0, 1e6);
  s.updatedAt = num(raw.updatedAt, 0, 8.64e15);
  s.pack = T(raw.pack, 40); s.album = L(raw.album, 2000, 60);
  s.level = ['a2','d4','f6'].includes(raw.level) ? raw.level : 'a2';
  s.nikud = ['auto','on','off'].includes(raw.nikud) ? raw.nikud : 'auto';
  s.tour  = raw.tour === true;
  /* התקדמות שמורה לפי המילה בלי ניקוד. שמירות ישנות נשמרו עם ניקוד — ממיירים. */
  s.album = [...new Set(s.album.map(w => H.strip(w)))];

  const packs = Array.isArray(raw.packs) ? raw.packs.slice(0, 40).filter(isO) : [];
  s.packs = packs.map(p => ({id: T(p.id, 40), topic: T(p.topic, 80), prize: T(p.prize, 80), list: L(p.list, 200, 60),
                             draft: p.draft === true, libId: T(p.libId, 40)}));
  if(!s.packs.length) s.packs = base.packs;
  if(!s.packs.some(p => p.id === s.pack)) s.pack = s.packs[0].id;

  s.stats = {};
  keys(raw.stats, 2000).forEach(k => {
    const v = raw.stats[k]; if(!isO(v)) return;
    const key = H.cleanText(H.strip(k), 60);
    const cur = {ok: num(v.ok,0,1e6), bad: num(v.bad,0,1e6), run: num(v.run,0,1e6),
                 lv: num(v.lv,0,20), last: num(v.last,0,8.64e15)};
    if(typeof v.st === 'number') cur.st = num(v.st,0,4);
    const prev = s.stats[key];
    /* שתי גרסאות של אותה מילה (עם ובלי ניקוד) נמזגות: סוכמים ניסיונות, לוקחים את הרצף הגבוה */
    s.stats[key] = prev ? {ok: prev.ok+cur.ok, bad: prev.bad+cur.bad, run: Math.max(prev.run,cur.run),
                           lv: Math.max(prev.lv,cur.lv), last: Math.max(prev.last,cur.last),
                           st: (prev.st === undefined && cur.st === undefined) ? undefined : Math.max(prev.st||0, cur.st||0)} : cur;
  });
  const pl = isO(raw.plan) ? raw.plan : {};
  s.plan = {d: T(pl.d, 12), n: num(pl.n, 0, 9), intro: T(pl.intro, 12), pre: {}};
  keys(pl.pre, 20).forEach(k => { if(pl.pre[k] === true) s.plan.pre[H.cleanText(k, 40)] = true; });
  const wd = isO(raw.world) ? raw.world : {};
  s.world = {d: T(wd.d, 12), gems: num(wd.gems, 0, 50), chest: wd.chest === true};
  const bd = isO(raw.build) ? raw.build : {};
  s.build = {e: (typeof bd.e === 'string' && /^[A-Za-z0-9+\/=]*$/.test(bd.e)) ? bd.e.slice(0, 36000) : '', hot: Array.isArray(bd.hot) ? bd.hot.filter(n => Number.isInteger(n) && n > 0 && n < 200).slice(0, 9) : []};
  s.stars = {};
  keys(raw.stars, 100).forEach(k => { s.stars[H.cleanText(k, 6)] = num(raw.stars[k], 0, 3); });
  s.log = {};
  keys(raw.log, 800).sort().slice(-400).forEach(k => {
    const v = raw.log[k]; if(!isO(v) || !/^\d{4}-\d{2}-\d{2}$/.test(k)) return;
    s.log[k] = {sec: num(v.sec,0,86400), right: num(v.right,0,1e5), wrong: num(v.wrong,0,1e5), rounds: num(v.rounds,0,1e5)};
  });
  const d = isO(raw.daily) ? raw.daily : {};
  s.daily = {last: T(d.last, 40), streak: num(d.streak, 0, 1e5), chal: T(d.chal, 12)};
  const u = isO(raw.usage) ? raw.usage : {};
  s.usage = {first: num(u.first,0,8.64e15), last: num(u.last,0,8.64e15), visits: num(u.visits,0,1e7), activeSec: num(u.activeSec,0,1e9),
             games: {}, hist: {}};
  keys(u.games, 20).forEach(g => {
    const v = u.games[g]; if(!isO(v) || !/^[a-z]{3,12}$/.test(g)) return;
    s.usage.games[g] = {sec: num(v.sec,0,1e8), rounds: num(v.rounds,0,1e6), right: num(v.right,0,1e7), wrong: num(v.wrong,0,1e7)};
  });
  keys(u.hist, 400).sort().slice(-120).forEach(d => {
    const v = u.hist[d]; if(!isO(v) || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
    s.usage.hist[d] = {xp: num(v.xp,0,1e7), e: num(v.e,0,1000)};
  });

  s.hand = {};
  keys(raw.hand, 40).forEach(k => {
    const v = raw.hand[k]; if(!isO(v) || !Array.isArray(v.s)) return;
    s.hand[H.cleanText(k, 2)] = {n: num(v.n,0,1000), s: v.s.slice(0, 192).map(x => num(x,0,1000))};
  });
  s.letters = {};
  keys(raw.letters, 40).forEach(k => {
    const v = raw.letters[k]; if(!isO(v)) return;
    s.letters[H.cleanText(k, 2)] = {ok: num(v.ok,0,1e6), bad: num(v.bad,0,1e6)};
  });
  return s;
};
