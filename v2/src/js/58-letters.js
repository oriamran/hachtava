/* ==========================================================
   בדיקת כתב ברמת אות.
   השלבים: מפת דיו -> פיצול לאותיות לפי רווחים אנכיים ->
   דגימה של כל אות לרשת קבועה -> השוואה לאות התבנית.
   ========================================================== */
H.GW = 12; H.GH = 16;          /* רשת ההשוואה לכל אות */
H.L_COVER = 0.50;              /* כמה מהאות כוסה */
H.L_STRAY = 0.55;              /* כמה דיו מותר מחוץ לאות */

/* מפת דיו בינארית של קנבס */
H.inkMap = function(ctx, W, H_){
  const d = ctx.getImageData(0, 0, W, H_).data;
  const m = new Uint8Array(W * H_);
  for(let i = 0, p = 3; i < m.length; i++, p += 4) if(d[p] > 40) m[i] = 1;
  return m;
};
/* אילו עמודות מכילות דיו */
H.inkCols = function(m, W, H_){
  const c = new Uint8Array(W);
  for(let x = 0; x < W; x++)
    for(let y = 0; y < H_; y++)
      if(m[y * W + x]){ c[x] = 1; break; }
  return c;
};
/* דגימת אזור לרשת בגודל קבוע, לפי תיבת החסימה של הדיו שבתוכו.
   נרמול לרשת קבועה הוא מה שעושה את ההשוואה חסינה לגודל הכתיבה. */
H.sampleGrid = function(m, W, H_, x0, x1, y0, y1, gw, gh){
  x0 = Math.max(0, x0); x1 = Math.min(W-1, x1);
  y0 = Math.max(0, y0); y1 = Math.min(H_-1, y1);
  let minx = x1, maxx = x0, miny = y1, maxy = y0, n = 0;
  for(let y = y0; y <= y1; y++)
    for(let x = x0; x <= x1; x++)
      if(m[y * W + x]){
        n++;
        if(x < minx) minx = x; if(x > maxx) maxx = x;
        if(y < miny) miny = y; if(y > maxy) maxy = y;
      }
  const g = new Uint8Array(gw * gh);
  if(!n) return {g, gw, gh, n:0, cells:0};
  const bw = Math.max(1, maxx - minx), bh = Math.max(1, maxy - miny);
  let cells = 0;
  for(let y = miny; y <= maxy; y++)
    for(let x = minx; x <= maxx; x++)
      if(m[y * W + x]){
        const gx = Math.min(gw-1, Math.floor((x - minx) / bw * gw));
        const gy = Math.min(gh-1, Math.floor((y - miny) / bh * gh));
        const i = gy * gw + gx;
        if(!g[i]){ g[i] = 1; cells++; }
      }
  return {g, gw, gh, n, cells};
};
/* דגימת אות בודדת */
H.sample = (m, W, H_, x0, x1) => H.sampleGrid(m, W, H_, x0, x1, 0, H_-1, H.GW, H.GH);

/* ציור אות בודדת לקנבס זמני, והחזרת הדגימה שלה */
H.glyphSample = function(ch, font){
  const c = document.createElement('canvas');
  c.width = 160; c.height = 200;
  const x = c.getContext('2d', {willReadFrequently:true});
  x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = '#000';
  x.fillText(ch, 80, 100);
  const m = H.inkMap(x, 160, 200);
  return H.sample(m, 160, 200, 0, 159);
};
/* השוואת שתי דגימות */
H.cmp = function(a, b){        /* a = הילד, b = התבנית */
  let inter = 0, aOnly = 0;
  for(let i = 0; i < a.g.length; i++){
    if(a.g[i] && b.g[i]) inter++;
    else if(a.g[i] && !b.g[i]) aOnly++;
  }
  return {
    cover: b.cells ? inter / b.cells : 0,
    stray: a.cells ? aOnly / a.cells : 1
  };
};

/* ---------- הדוח לכל אות ----------
   חיתוך לפי יחסי הרוחב של התבנית ולא לפי רווחים בכתב הילד.
   פיצול לפי רווחים נכשל ברבע מהמילים, כי ילד לא משאיר רווח קבוע. */
H.letterReport = function(){
  const p = H.pad;
  if(!p.boxes || !p.boxes.length) H.padTemplate(false);
  const m = H.inkMap(p.ictx, p.W, p.H);

  /* תיבת החסימה האופקית של מה שהילד כתב */
  const cols = H.inkCols(m, p.W, p.H);
  let ix0 = -1, ix1 = -1;
  for(let x = 0; x < p.W; x++) if(cols[x]){ if(ix0 < 0) ix0 = x; ix1 = x; }
  const out = {letters: [], empty: ix0 < 0};
  if(out.empty){
    p.boxes.forEach(b => out.letters.push({ch:b.ch, ok:null}));
    return out;
  }
  const tw = Math.max(1, p.tx1 - p.tx0), iw = Math.max(1, ix1 - ix0);
  const mapx = tx => ix0 + (tx - p.tx0) / tw * iw;

  p.boxes.forEach(b => {
    const a = Math.max(0, Math.round(mapx(b.x0)) - 2);
    const z = Math.min(p.W - 1, Math.round(mapx(b.x1)) + 2);
    const mine = H.sample(m, p.W, p.H, a, z);
    if(!mine.cells){ out.letters.push({ch:b.ch, cover:0, stray:1, ok:false, sample:null}); return; }
    const base = H.strip(b.ch);
    const r = H.letterSim(mine, base);      /* פונט או הכתב האישי — הטוב מביניהם */
    out.letters.push({ch:b.ch, base, sample:mine, from:r.from,
                      cover:r.cover, stray:r.stray,
                      ok: r.cover >= H.L_COVER && r.stray <= H.L_STRAY});
  });
  out.countOk = true;
  return out;
};

/* ---------- סטטיסטיקת אותיות, לדוח ההורים ---------- */
H.noteLetters = function(rep){
  if(!rep.countOk) return;
  const L = H.state.letters || (H.state.letters = {});
  rep.letters.forEach(l => {
    const base = H.strip(l.ch);             /* סופרים לפי האות, בלי הניקוד */
    const e = L[base] || (L[base] = {ok:0, bad:0});
    if(l.ok) e.ok++; else e.bad++;
  });
  H.save();
};
H.hardLetters = function(n){
  const L = H.state.letters || {};
  return Object.entries(L)
    .map(([ch, e]) => ({ch, ok:e.ok, bad:e.bad, tries:e.ok+e.bad,
                        rate: (e.ok+e.bad) ? e.ok/(e.ok+e.bad) : 1}))
    /* הסימן לאות בודדת רועש, אז דורשים הרבה ניסיונות לפני שמצביעים */
    .filter(x => x.tries >= 8 && x.rate < 0.55)
    .sort((a, b) => a.rate - b.rate)
    .slice(0, n || 8);
};

/* ---------- תצוגת האותיות מתחת למשטח ---------- */
H.showLetters = function(rep){
  const box = H.$('letterstrip');
  box.innerHTML = '';
  rep.letters.forEach(l => {
    const cls = l.ok === null ? 'lt' : (l.ok ? 'lt ok' : 'lt soft');
    box.appendChild(H.el('span', cls, l.ch + '<i>' + (l.ok === null ? '' : (l.ok ? '✓' : '✗')) + '</i>'));
  });
  box.style.display = rep.letters.length ? '' : 'none';
};
H.clearLetters = function(){
  const b = H.$('letterstrip'); if(b){ b.innerHTML = ''; b.style.display = 'none'; }
};

/* ---------- משוב ספציפי: איפה בדרך כלל טועים במילה הזו ----------
   זה לא אומר "הילד טעה באות הזו". זיהוי האות שנכתבה רועש (ראה למעלה),
   ומשוב שגוי גרוע ממשוב כללי. מה שכן אפשר לדעת בוודאות הוא מה במילה
   עצמה קשה: אות שנשמעת כמו אות אחרת, וה' שלא נשמעת בסוף מילה.
   לכן אומרים על מה לשים לב, ולא איפה הטעות. */
H.trickyParts = function(word){
  const cl = H.clusters(word), out = [];
  cl.forEach((c, i) => {
    if(c === ' ') return;
    const o = H.parseCluster(c);
    const alt = H.homophone(c);
    if(alt){
      const key = (o.base === 'ש' && o.sin) ? 'שׂ' : o.base;
      out.push({i, ch: H.buildCluster({base: o.base, dagesh: false, shin: false, sin: o.sin, vowel: ''}),
                why: 'נשמעת כמו ' + H.HOMO[key]});
    } else if(o.base === 'ה' && !o.dagesh && !o.vowel && i === cl.length - 1 && cl.length > 2){
      out.push({i, ch: 'ה', why: 'בסוף המילה, לא נשמעת'});
    }
  });
  return out;
};
H.trickyHint = function(word){
  const seen = new Set();                    /* אות שחוזרת במילה נאמרת פעם אחת */
  const t = H.trickyParts(word).filter(x => !seen.has(x.ch) && seen.add(x.ch)).slice(0, 2);
  if(!t.length) return '';
  return 'שים לב: ' + t.map(x => '<b>' + H.esc(x.ch) + '</b> (' + H.esc(x.why) + ')').join(' · ');
};
