/* ==========================================================
   פרופיל כתב אישי.
   לכל אות נשמר סכום הדגימות של הילד ברשת GWxGH, וממנו נגזרת
   "האות שלו". ההשוואה לוקחת את הטוב מבין השניים — הפונט
   והפרופיל — כדי לא להעניש סגנון אישי עקבי.

   המלכודת: אם לומדים כל דגימה, ילד שכותב אות הפוך ילמד את
   המערכת שהפוך זה נכון. לכן לומדים רק מדגימות שכבר עברו סף
   דמיון לפונט, או מהעתקה מקו העזר — שם ידוע מה הועתק.
   ========================================================== */
H.HAND_MIN     = 6;      /* מכמה דגימות מתחילים להשתמש בפרופיל */
H.HAND_LEARN   = 0.42;   /* סף דמיון לפונט שמתחתיו לא לומדים כלום */
H.HAND_ON      = 0.35;   /* תא נחשב "מלא" אם הופיע ברבע הזה מהדגימות */
H.HAND_CAP     = 40;     /* מעל זה מחצים, כדי שהפרופיל ימשיך להשתנות */

H.handOf = function(base){
  const h = H.state.hand || (H.state.hand = {});
  return h[base];
};
/* הפרופיל כרשת בינארית, כמו כל דגימה אחרת */
H.handProto = function(base){
  const h = H.handOf(base);
  if(!h || h.n < H.HAND_MIN) return null;
  const g = new Uint8Array(H.GW * H.GH);
  let cells = 0;
  for(let i = 0; i < g.length; i++)
    if(h.s[i] / h.n >= H.HAND_ON){ g[i] = 1; cells++; }
  return cells ? {g, cells, gw:H.GW, gh:H.GH} : null;
};
H.learnLetter = function(base, sample, trusted){
  if(!sample || !sample.cells) return false;
  const font = H.glyphSample(base, '120px ' + (H.pad.fam || 'KtavYad'));
  const sim  = H.cmp(sample, font);
  /* העתקה מקו העזר נאמנת בהגדרה; אחרת דורשים דמיון מינימלי */
  if(!trusted && sim.cover < H.HAND_LEARN) return false;
  const all = H.state.hand || (H.state.hand = {});
  const h = all[base] || (all[base] = {n:0, s:new Array(H.GW*H.GH).fill(0)});
  for(let i = 0; i < h.s.length; i++) if(sample.g[i]) h.s[i]++;
  h.n++;
  if(h.n > H.HAND_CAP){                     /* שכחה הדרגתית */
    h.n = Math.round(h.n / 2);
    for(let i = 0; i < h.s.length; i++) h.s[i] = Math.round(h.s[i] / 2);
  }
  return true;
};
/* הציון לאות: הטוב מבין הפונט לבין הכתב האישי */
H.letterSim = function(sample, base){
  const font = H.glyphSample(base, '120px ' + (H.pad.fam || 'KtavYad'));
  const a = H.cmp(sample, font);
  a.from = 'font';
  const proto = H.handProto(base);
  if(!proto) return a;
  const b = H.cmp(sample, proto);
  b.from = 'hand';
  /* "טוב יותר" = כיסוי גבוה עם מעט חריגה */
  const score = r => r.cover - r.stray * 0.5;
  return score(b) > score(a) ? b : a;
};
H.handStats = function(){
  const h = H.state.hand || {};
  const ks = Object.keys(h);
  return {
    letters: ks.length,
    ready: ks.filter(k => h[k].n >= H.HAND_MIN).length,
    samples: ks.reduce((a, k) => a + h[k].n, 0)
  };
};
