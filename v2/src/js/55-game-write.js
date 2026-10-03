/* ==========================================================
   6. כתיבה: הילד כותב באצבע או בעכבר, והתוצאה נבדקת מול המילה.
   ספי הבדיקה — רכך אותם אם נפסל לו כתב תקין.
   ========================================================== */
H.COVER_MIN = 0.32;   /* כמה מהמילה כוסה */
H.STRAY_MAX = 0.62;   /* כמה דיו מותר מחוץ למילה */
H.RATIO_MIN = 0.55;   /* כמות דיו ביחס למילה — זה מה שפוסל שרבוט */
H.RATIO_MAX = 1.70;
H.MIN_INK   = 10;
/* קו האצבע בעובי קבוע, אז ככל שהילד כותב קטן יותר הוא ממלא יחסית יותר.
   בלי התאמה, כתיבה קטנה נפסלת כ"שרבוט" למרות שהיא תקינה.
   לכל כתיבה קטנה מוסיפים לתקרה חלק קבוע מהפער (נמדד בדגימות). */
H.SMALL_ALLOW = 0.375;
H.SIZE_MIN    = 0.25;   /* מתחת לזה לא מקלים עוד */
H.ratioMax = size => H.RATIO_MAX + H.SMALL_ALLOW * (1 / Math.max(H.SIZE_MIN, Math.min(1, size || 1)) - 1);
/* מצב מבחן: נפתח למילה רק אחרי שהיא כבר נכבשה במשחקי האריחים,
   כלומר כשידוע שהילד יודע לאיית אותה. אז אפשר לדרוש גם צורה. */
H.TEST_FRAC = 0.70;   /* איזה חלק מהאותיות חייב להיות מזוהה */
H.TEST_COVER = 0.46;

H.pad = {};

H.game({
  id:'write', e:'✍️', name:'כתיבה',
  desc:'שמע וכתוב בכתב',
  start(){ H.show('write'); this.next(); },
  next(){
    const w = H.nextWord();
    if(!w) return H.endRound();
    const r = H.run;
    r.guide = false;
    /* המילה כבר נכבשה באריחים — אז כאן זה כבר מבחן, לא תרגול */
    r.testMode = (H.state.stats[H.sk(w)] || {run:0}).run >= H.MASTER_AT;
    H.padInit(); H.padClear(); H.padTemplate(false); H.clearLetters(); H.hideCompare();
    r.selfRevealed = false;
    H.$('writebtn').style.display = ''; H.$('selfmark').style.display = 'none';
    H.$('writeprompt').textContent = r.game.id === 'selfcheck'
      ? 'שמע, כתוב בכתב, ואז בדוק את עצמך מול המילה'
      : (r.testMode
        ? 'המילה הזו כבר שלך — עכשיו בכתב יפה'
        : 'שמע את המילה וכתוב אותה בכתב');
    H.$('testbadge').style.display = r.testMode ? '' : 'none';
    H.$('writebtn').textContent = '✅ בדוק';
    H.$('writefb').textContent = '';
    setTimeout(() => H.say(w), 320);
  },
  /* כתיבה ובדיקה עצמית: האפליקציה לא שופטת את הכתב. הילד (או ההורה) משווה
     את מה שכתב למילה ומחליט. זה מדלג על חוסר הדיוק של זיהוי כתב היד, והוא
     "בוחן ותיקון עצמי" כמו שמתואר אצל Graham. */
  selfFlow(){
    const r = H.run, res = H.padScore(), fb = H.$('writefb');
    if(r.selfRevealed) return;
    if(res.empty){ fb.className = 'fb no'; fb.textContent = 'עדיין לא כתבת כלום ✍️'; return; }
    r.selfRevealed = true;
    H.showCompare();
    fb.className = 'fb'; fb.textContent = 'השווה את מה שכתבת למילה. כתבת נכון?';
    H.$('writebtn').style.display = 'none'; H.$('selfmark').style.display = '';
  },
  selfMark(ok){
    const r = H.run, fb = H.$('writefb');
    if(!r.selfRevealed) return;
    r.selfRevealed = false;
    H.$('selfmark').style.display = 'none';
    if(ok){ H.right(); fb.className = 'fb ok'; fb.textContent = '🎉 יפה!'; H.speak(r.word); }
    else { H.wrong(); fb.className = 'fb no'; fb.innerHTML = H.trickyHint(r.word) || 'בפעם הבאה נצליח'; }
    setTimeout(() => this.next(), ok ? 800 : 1800);
  },
  check(){
    if(H.run.game.id === 'selfcheck') return this.selfFlow();
    const r = H.run, res = H.padScore(), fb = H.$('writefb');
    if(res.empty){
      fb.className = 'fb no'; fb.textContent = 'עדיין לא כתבת כלום ✍️';
      return;
    }
    if(res.ratio > H.ratioMax(res.size)){
      fb.className = 'fb no';
      fb.textContent = 'זה לא מילה — נקה וכתוב שוב';
      H.sfx.bad();
      return;
    }
    /* בדיקה ברמת אות — היא שקובעת, והיא גם מה שמוצג לילד */
    const rep = H.letterReport();
    H.showLetters(rep);
    H.noteLetters(rep);
    /* הבדיקה ברמת אות אינה שער. נמדדה על עשר המילים: היא מזהה אות
       שגויה ב-9 מ-10, אבל פוסלת כתיבה תקינה ב-8 מ-10. ילד כותב שונה
       בכל פעם, ובטלפון אי אפשר לדייק. לכן היא רק רמז רך, ומצטברת
       לדוח ההורים — שם הרעש מתמצע על פני הרבה ניסיונות. */
    const weak = rep.letters.filter(l => l.ok === false);
    const okFrac = rep.letters.length
      ? rep.letters.filter(l => l.ok).length / rep.letters.length : 0;
    const basic = res.cover >= H.COVER_MIN && res.stray <= H.STRAY_MAX
               && res.ratio >= H.RATIO_MIN;
    /* בתרגול מספיק שכתב משהו בצורת מילה. במבחן, שהמילה כבר שלו,
       אפשר לדרוש שגם רוב האותיות יזוהו. */
    const good = r.testMode
      ? (basic && res.cover >= H.TEST_COVER && okFrac >= H.TEST_FRAC)
      : basic;
    if(good && !r.guide){
      /* דגימות מוצלחות מלמדות את הפרופיל האישי, בכפוף לסף הפונט */
      rep.letters.forEach(l => l.sample && H.learnLetter(l.base, l.sample, false));
      H.save();
      H.right();
      fb.className = 'fb ok';
      fb.innerHTML = weak.length === 1
        ? '🎉 יפה! שים לב לאות <b>' + weak[0].ch + '</b>'
        : '🎉 יפה מאוד!';
      H.speak(r.word);
      setTimeout(() => this.next(), 1000);
    } else if(good && r.guide){
      /* העתקה מקו העזר — ידוע בוודאות מה הועתק, אז זו הדגימה
         הכי אמינה שיש ללימוד הכתב האישי */
      rep.letters.forEach(l => l.sample && H.learnLetter(l.base, l.sample, true));
      H.save();
      fb.className = 'fb ok'; fb.textContent = 'טוב! עכשיו אתה יודע אותה';
      H.sfx.good();
      H.run.queue.push(r.word);
      setTimeout(() => this.next(), 1000);
    } else if(!r.guide){
      H.wrong();
      r.guide = true;
      H.showCompare();                      /* לפני הניקוי — מה שנכתב מול המילה */
      H.padClear(); H.padTemplate(true); H.padReveal();
      H.$('writeprompt').textContent = 'ככה כותבים אותה — עבור על הקו';
      H.$('writebtn').textContent = '✅ עברתי';
      fb.className = 'fb no';
      fb.innerHTML = 'לא בדיוק. ' + (H.trickyHint(r.word) || 'נסתכל יחד');
    } else {
      fb.className = 'fb no'; fb.textContent = 'עוד קצת — עבור על כל האותיות';
      H.sfx.bad();
      H.padClear(); H.padTemplate(true); H.padReveal();
    }
  }
});

/* ---------- משטח הכתיבה ---------- */
H.padInit = function(){
  const ink = H.$('inkCanvas'), tm = H.$('tmplCanvas'), wrap = H.$('padwrap');
  const p = H.pad;
  const w = Math.max(240, Math.min(520, wrap.clientWidth || 340));
  const h = Math.round(w * (w < 420 ? 0.46 : 0.34));
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  wrap.style.height = h + 'px';
  [ink, tm].forEach(c => { c.width = Math.round(w*dpr); c.height = Math.round(h*dpr); });
  p.W = ink.width; p.H = ink.height; p.dpr = dpr;
  p.ictx = ink.getContext('2d', {willReadFrequently:true});
  p.tctx = tm.getContext('2d',  {willReadFrequently:true});
  p.ictx.lineWidth = Math.max(5, 6*dpr);
  p.ictx.lineCap = 'round'; p.ictx.lineJoin = 'round';
  p.ictx.strokeStyle = '#2b2250';
  if(p.bound) return;
  p.bound = true;
  const at = e => {
    const r = ink.getBoundingClientRect();
    return [(e.clientX - r.left) * (p.W / r.width), (e.clientY - r.top) * (p.H / r.height)];
  };
  ink.addEventListener('pointerdown', e => {
    ink.setPointerCapture(e.pointerId); p.down = true;
    const [x, y] = at(e);
    p.ictx.beginPath(); p.ictx.moveTo(x, y); p.ictx.lineTo(x + 0.1, y); p.ictx.stroke();
    e.preventDefault();
  });
  ink.addEventListener('pointermove', e => {
    if(!p.down) return;
    const [x, y] = at(e); p.ictx.lineTo(x, y); p.ictx.stroke(); e.preventDefault();
  });
  /* בלי pointerleave — הוא היה קוטע את הקו כשהאצבע חוצה את הגבול */
  ['pointerup','pointercancel'].forEach(ev => ink.addEventListener(ev, () => { p.down = false; }));
  window.addEventListener('resize', () => {
    if(H.screen === 'write'){ H.padInit(); H.padClear(); if(H.run && H.run.guide) H.padTemplate(true); }
  });
};
H.padClear = function(){
  const p = H.pad;
  if(p.ictx) p.ictx.clearRect(0, 0, p.W, p.H);
  const fb = H.$('writefb'); if(fb) fb.textContent = '';
};
/* מצייר אות־אות ושומר את הטווח האופקי של כל אחת.
   אותה גיאומטריה משמשת גם לקו העזר וגם לחיתוך הכתב של הילד. */
H.padTemplate = function(visible){
  const p = H.pad, c = p.tctx, word = H.run.word;
  c.clearRect(0, 0, p.W, p.H);
  const fam = document.body.classList.contains('dfus')
    ? '"Arial Hebrew",sans-serif' : 'KtavYad,"Arial Hebrew",sans-serif';
  const cl = H.clusters(word);
  let size = Math.round(p.H * 0.58);
  const widths = () => { c.font = size + 'px ' + fam; return cl.map(ch => c.measureText(ch).width); };
  let w = widths(), total = w.reduce((a, b) => a + b, 0);
  while(total > p.W * 0.88 && size > 14){ size -= 2; w = widths(); total = w.reduce((a, b) => a + b, 0); }
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = visible ? '#c6d2e3' : '#000';
  const y = p.H * 0.52;
  let x = p.W / 2 + total / 2;              /* מימין לשמאל */
  p.boxes = [];
  cl.forEach((ch, i) => {
    x -= w[i];
    if(ch !== ' '){
      c.fillText(ch, x + w[i] / 2, y);
      p.boxes.push({ch, x0: x, x1: x + w[i]});
    }
  });
  /* טווח הרוחב בפונט אינו טווח הדיו — לאות יש שוליים.
     מודדים את הדיו עצמו, אחרת החיתוך של כתב הילד יוצא מוסט. */
  const tm = H.inkMap(c, p.W, p.H);
  const tcols = H.inkCols(tm, p.W, p.H);
  p.boxes = p.boxes.map(b => {
    let a = -1, z = -1;
    for(let x = Math.max(0, Math.floor(b.x0)); x <= Math.min(p.W-1, Math.ceil(b.x1)); x++)
      if(tcols[x]){ if(a < 0) a = x; z = x; }
    return (a < 0) ? null : {ch: b.ch, x0: a, x1: z};
  }).filter(Boolean);
  p.tx0 = Math.min(...p.boxes.map(b => b.x0));
  p.tx1 = Math.max(...p.boxes.map(b => b.x1));
  H.$('tmplCanvas').style.opacity = visible ? '1' : '0';
  p.fam = fam; p.size = size;
};
/* ==========================================================
   ציון הכתיבה. שני הצדדים מנורמלים לרשת אחת בגודל קבוע,
   כך שילד שכותב קטן, גדול או בצד מקבל את אותו ציון.
   ========================================================== */
H.SW = 48; H.SH = 16;          /* רשת ההשוואה של המילה כולה */

H.padScore = function(){
  const p = H.pad;
  const im = H.inkMap(p.ictx, p.W, p.H);
  const tm = H.inkMap(p.tctx, p.W, p.H);
  const I = H.sampleGrid(im, p.W, p.H, 0, p.W-1, 0, p.H-1, H.SW, H.SH);
  const T = H.sampleGrid(tm, p.W, p.H, 0, p.W-1, 0, p.H-1, H.SW, H.SH);
  if(I.n < H.MIN_INK || !T.cells) return {cover:0, stray:1, ratio:0, empty:true};

  let inter = 0, only = 0;
  for(let i = 0; i < I.g.length; i++){
    if(I.g[i] && T.g[i]) inter++;
    else if(I.g[i]) only++;
  }
  /* כמה תאים מהרשת מלאים — שרבוט ממלא הרבה יותר ממילה */
  const ratio = I.cells / T.cells;
  /* רוחב הכתיבה ביחס לרוחב המילה המוצגת. 1 = בגודל המילה או גדול ממנה */
  const cols = H.inkCols(im, p.W, p.H);
  let ix0 = -1, ix1 = -1;
  for(let x = 0; x < p.W; x++) if(cols[x]){ if(ix0 < 0) ix0 = x; ix1 = x; }
  const size = (p.tx1 > p.tx0 && ix0 >= 0) ? (ix1 - ix0) / (p.tx1 - p.tx0) : 1;
  return {cover: inter / T.cells, stray: I.cells ? only / I.cells : 1, ratio, size, empty:false};
};

/* ---------- משוב חזותי: מה שנכתב מול המילה ---------- */
/* חותך את התוכן של קנבס לתיבת הדיו שלו, על רקע לבן, ומחזיר כתובת תמונה */
H.cropToImage = function(src, color){
  const W = src.width, Hh = src.height;
  const m = H.inkMap(src.getContext('2d', {willReadFrequently:true}), W, Hh);
  let x0 = W, x1 = -1, y0 = Hh, y1 = -1;
  for(let y = 0; y < Hh; y++) for(let x = 0; x < W; x++)
    if(m[y * W + x]){ if(x < x0) x0 = x; if(x > x1) x1 = x; if(y < y0) y0 = y; if(y > y1) y1 = y; }
  if(x1 < 0) return '';
  const pad = 6, w = x1 - x0 + 1 + pad * 2, h = y1 - y0 + 1 + pad * 2;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, w, h);
  /* מציירים את הדיו בצבע אחיד, כדי שהמילה הנכונה לא תהיה בהירה מדי */
  const t = document.createElement('canvas'); t.width = w; t.height = h;
  const tx = t.getContext('2d');
  tx.drawImage(src, pad - x0, pad - y0);
  tx.globalCompositeOperation = 'source-in';
  tx.fillStyle = color; tx.fillRect(0, 0, w, h);
  x.drawImage(t, 0, 0);
  return c.toDataURL();
};
H.showCompare = function(){
  const p = H.pad;
  /* התבנית צריכה להיות מצוירת כדי שיהיה מה להשוות */
  if(!p.boxes || !p.boxes.length) H.padTemplate(false);
  const mine = H.cropToImage(H.$('inkCanvas'), '#2b2250');
  const word = H.cropToImage(H.$('tmplCanvas'), '#2b2250');
  if(!mine || !word) return H.hideCompare();
  H.$('cmpMine').src = mine; H.$('cmpWord').src = word;
  H.$('compare').style.display = '';
};
H.hideCompare = function(){
  const c = H.$('compare'); if(c) c.style.display = 'none';
};
/* חושף את קו העזר אות אחר אות, מימין לשמאל */
H.padReveal = function(){
  const t = H.$('tmplCanvas');
  const n = (H.pad.boxes || []).length || 1;
  t.classList.remove('reveal');
  t.style.clipPath = 'inset(0 0 0 100%)';
  void t.offsetWidth;                        /* מאלץ חישוב מחדש כדי שהמעבר יתחיל מההתחלה */
  t.style.setProperty('--reveal', Math.min(3, 0.35 * n + 0.4) + 's');
  t.classList.add('reveal');
  t.style.clipPath = 'inset(0 0 0 0)';
};

/* אותו משטח כתיבה, בלי שיפוט של האפליקציה. מועתק מהכתיבה אחרי שהיא הוגדרה. */
H.game(Object.assign({}, H.byId('write'), {
  id:'selfcheck', e:'📝', name:'כתיבה ובדיקה', desc:'כותבים, ואז בודקים מול המילה'
}));
