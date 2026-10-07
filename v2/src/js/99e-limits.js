/* ==========================================================
   זמן מסך: מגבלה יומית ל"האי שלי" ולעולם הבנייה, בנק זמן משותף
   שהילד מרוויח מלמידה, וקוד הורים של 4 ספרות שנועל את מסך ההורים.

   - ההורה קובע כמה דקות ביום בכל עולם (0 = בלי הגבלה).
   - משחקי הלמידה בתוך העולמות (ציד אותיות, בונים מילה) לא נספרים.
   - תשובה נכונה = חצי דקה בבנק, סיבוב מושלם +2 דקות, אתגר היום +5 דקות.
     תקרה של 30 דקות ביום. הבנק מתאפס בכל יום.
   - את הזמן הבסיסי אפשר לשנות רק אחרי שהושלם אתגר היום (הגדרה ראשונה חופשית).
     הוספת זמן חד־פעמית (10/15/30 דקות) תמיד אפשרית אחרי הקוד.
   ========================================================== */
H.LIM_CAP = 1800;                 /* תקרת זמן שמרוויחים ביום, בשניות */
H.LIM_CHOICES = [0, 10, 15, 20, 30, 45, 60];
H.LIM_ADD = [10, 15, 30];

H.lim = function(){
  const s = H.state, L = s.lim || (s.lim = {i: 0, b: 0, bank: 0, d: '', ui: 0, ub: 0, earn: 0, set: false, pin: ''});
  if(L.d !== H.today()){ L.d = H.today(); L.ui = 0; L.ub = 0; L.bank = 0; L.earn = 0; }
  return L;
};
const base = (L, w) => (w === 'i' ? L.i : L.b) * 60;
const used = (L, w) => w === 'i' ? L.ui : L.ub;
/* כמה שניות נשארו בעולם הזה היום. Infinity = בלי הגבלה */
H.limLeft = function(w){
  const L = H.lim(), b = base(L, w);
  if(!b) return Infinity;
  return Math.max(0, b - used(L, w)) + Math.max(0, L.bank);
};
H.limFmt = function(sec){
  sec = Math.max(0, Math.round(sec));
  const m = Math.floor(sec / 60), s = sec % 60;
  return m + ':' + (s < 10 ? '0' : '') + s;
};
H.limMin = sec => { const m = Math.round(sec / 60); return m === 1 ? 'דקה' : m + ' דקות'; };

/* נקרא מכל פריים בעולם: מוסיף זמן שימוש. מחזיר false כשהזמן נגמר. */
let tickAcc = 0, warned = {};
H.limTick = function(w, dt){
  const L = H.lim(), b = base(L, w);
  if(!b) return true;
  if(used(L, w) < b){ if(w === 'i') L.ui += dt; else L.ub += dt; }
  else L.bank = Math.max(0, L.bank - dt);
  tickAcc += dt; if(tickAcc > 15){ tickAcc = 0; H.save(); }
  const left = H.limLeft(w);
  [120, 60].forEach(t => { const k = w + t; if(left <= t && !warned[k]){ warned[k] = 1; H.toast('⏱️ נשארו ' + (t === 120 ? 'שתי דקות' : 'דקה'), 'no'); } });
  if(left > 130) warned = {};
  return left > 0;
};
/* הרווחת זמן מלמידה. מחזיר כמה שניות נוספו. */
H.limEarn = function(sec){
  const L = H.lim();
  if(!(L.i || L.b)) return 0;
  const g = Math.min(sec, Math.max(0, H.LIM_CAP - L.earn));
  if(g <= 0) return 0;
  L.earn += g; L.bank += g;
  if(H.run) H.run.earn = (H.run.earn || 0) + g;
  return g;
};
H.limAdd = function(min){
  const L = H.lim(); L.bank += min * 60; H.save();
  H.toast('➕ נוספו ' + min + ' דקות', 'good');
};

/* ---------- מסך "נגמר הזמן" ---------- */
H.limBlock = function(w){
  speechSynthesis.cancel();
  let ov = H.$('limover');
  if(!ov){ ov = H.el('div', 'limover'); ov.id = 'limover'; document.body.appendChild(ov); }
  const name = w === 'i' ? 'האי שלי' : 'עולם הבנייה';
  ov.style.display = '';
  ov.innerHTML = '<div class="lim-card"><div class="lim-e">🌙</div><h2>נגמר הזמן ב' + H.esc(name) + ' להיום</h2>' +
    '<p>רוצים עוד? בכל תשובה נכונה במשחקי הלמידה מרוויחים זמן: ' +
    'תשובה נכונה = חצי דקה, סיבוב מושלם = 2 דקות, אתגר היום = 5 דקות.</p>' +
    '<div class="lim-btns"><button class="go" id="limplay">🎮 משחקי למידה</button>' +
    '<button class="mini" id="limhome">🏠 הביתה</button><button class="mini" id="limparent">👨‍👩‍👧 הורה: הוסף זמן</button></div></div>';
  H.$('limplay').onclick = () => { ov.style.display = 'none'; H.sfx.tap(); H.renderPlay(); H.show('play'); };
  H.$('limhome').onclick = () => { ov.style.display = 'none'; H.home(); };
  H.$('limparent').onclick = () => H.askPin(() => {
    ov.querySelector('.lim-btns').innerHTML = H.LIM_ADD.map(m => '<button class="go" data-m="' + m + '">➕ ' + m + ' דקות</button>').join('');
    ov.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { H.limAdd(Number(b.dataset.m)); ov.style.display = 'none'; (w === 'i' ? H.returnToWorld : H.returnToVoxel)(); });
  });
};
/* בדיקה לפני כניסה לעולם. true = חסום (והמסך "נגמר הזמן" מוצג) */
H.limGate = function(w){
  if(H.limLeft(w) > 0) return false;
  H.show(w === 'i' ? 'world' : 'voxel');
  H.limBlock(w);
  return true;
};

/* שבב זמן שנשאר, בפינה, בזמן שמשחקים בעולם */
setInterval(() => {
  let chip = H.$('limchip');
  const w = H.screen === 'world' && H.world && H.world.mode() === 'explore' ? 'i' : (H.screen === 'voxel' && H.vox && H.vox.mode() === 'free' ? 'b' : '');
  const left = w ? H.limLeft(w) : Infinity, ov = H.$('limover');
  if(!w || left === Infinity || (ov && ov.style.display !== 'none')){ if(chip) chip.style.display = 'none'; return; }
  if(!chip){ chip = H.el('div', 'limchip'); chip.id = 'limchip'; document.body.appendChild(chip); }
  chip.style.display = ''; chip.classList.toggle('low', left < 120);
  chip.textContent = '⏱️ ' + H.limFmt(left);
}, 1000);
window.addEventListener('pagehide', () => { try{ H.save(); }catch(e){} });

/* ---------- קוד הורים ---------- */
H.pinHash = async function(code){
  const t = 'hachtava-parent:' + code;
  try{
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t));
    return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
  }catch(e){ let h = 5381; for(let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) >>> 0; return ('0000000000000000000000000000000000000000000000000000000000000000' + h.toString(16)).slice(-64); }
};
H.parentUntil = 0;
H.parentOpen = () => Date.now() < H.parentUntil;
/* חלון קוד: onOk נקרא רק אחרי קוד נכון (או אחרי בחירת קוד חדש). */
H.askPin = function(onOk, opts){
  opts = opts || {};
  const L = H.lim();
  if(!opts.force && H.parentOpen()){ onOk(); return; }
  const setup = opts.change || !L.pin;
  let ov = H.$('pinov'); if(ov) ov.remove();
  ov = H.el('div', 'pinov'); ov.id = 'pinov'; document.body.appendChild(ov);
  let code = '', first = '', step = setup ? 'new' : 'ask';
  const titles = {new: 'בחר קוד הורים של 4 ספרות', again: 'הקלד שוב את הקוד', ask: 'קוד הורים'};
  const close = () => { ov.remove(); window.removeEventListener('keydown', onKey, true); };
  const paint = (msg, bad) => {
    ov.innerHTML = '<div class="pin-card"><h3>' + H.esc(titles[step]) + '</h3><div class="pin-dots">' +
      [0, 1, 2, 3].map(i => '<i class="' + (i < code.length ? 'on' : '') + '"></i>').join('') + '</div>' +
      '<p class="pin-msg' + (bad ? ' bad' : '') + '">' + H.esc(msg || (step === 'new' ? 'הקוד נועל את מסך ההורים והגדרות הזמן' : '')) + '</p>' +
      '<div class="pin-pad">' + [1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '⌫'].map(k => k === '' ? '<span></span>' : '<button data-k="' + k + '">' + k + '</button>').join('') + '</div>' +
      '<div class="row">' + (step === 'ask' && H.signedIn && H.signedIn() ? '<button class="mini" id="pinforgot">שכחתי קוד</button>' : '') + '<button class="mini" id="pincancel">ביטול</button></div></div>';
    ov.querySelectorAll('[data-k]').forEach(b => b.onclick = () => key(b.dataset.k));
    H.$('pincancel').onclick = close;
    const f = H.$('pinforgot');
    if(f) f.onclick = () => { if(confirm('לאפס את קוד ההורים? תבחר קוד חדש. (אפשר רק כשמחוברים עם גוגל)')){ L.pin = ''; H.save(); close(); H.askPin(onOk, opts); } };
  };
  const done = async () => {
    if(step === 'new'){ first = code; code = ''; step = 'again'; return paint(); }
    if(step === 'again'){
      if(code !== first){ code = ''; first = ''; step = 'new'; return paint('הקודים לא זהים. נסה שוב', true); }
      L.pin = await H.pinHash(code); H.save(); H.parentUntil = Date.now() + 10 * 60000; close(); H.toast('🔒 קוד ההורים נקבע', 'good'); return onOk();
    }
    if(await H.pinHash(code) === L.pin){ H.parentUntil = Date.now() + 10 * 60000; close(); return onOk(); }
    code = ''; H.sfx.bad(); paint('קוד שגוי', true);
  };
  const key = k => {
    if(k === '⌫') code = code.slice(0, -1);
    else if(code.length < 4) code += k;
    paint(); if(code.length === 4) setTimeout(done, 120);
  };
  const onKey = e => { if(/^[0-9]$/.test(e.key)) key(e.key); else if(e.key === 'Backspace') key('⌫'); else if(e.key === 'Escape') close(); else return; e.preventDefault(); e.stopPropagation(); };
  window.addEventListener('keydown', onKey, true);
  paint();
};
/* מסך ההורים והדוח נפתחים רק אחרי קוד */
{
  const rawShow = H.show;
  H.show = function(id){
    if((id === 'settings' || id === 'report') && !H.parentOpen()){ H.askPin(() => rawShow.call(H, id)); return; }
    if(id === 'settings' || id === 'report') H.parentUntil = Date.now() + 10 * 60000;
    return rawShow.call(H, id);
  };
}

/* ---------- אזור זמן מסך במסך ההורים ---------- */
H.renderTimeBox = function(){
  const box = H.$('timebox'); if(!box) return;
  const L = H.lim(), canBase = !L.set || H.challengeDone();
  const sel = (id, v) => '<select id="' + id + '"' + (canBase ? '' : ' disabled') + '>' + H.LIM_CHOICES.map(m => '<option value="' + m + '"' + (m === v ? ' selected' : '') + '>' + (m ? m + ' דקות ביום' : 'בלי הגבלה') + '</option>').join('') + '</select>';
  const u = (w) => { const b = base(L, w); return b ? ' · היום ' + Math.round(used(L, w) / 60) + ' מתוך ' + (b / 60) + ' דק׳' : ''; };
  box.innerHTML = '<label class="lbl">⏱️ זמן מסך</label>' +
    '<label class="lbl">🏝️ האי שלי' + H.esc(u('i')) + sel('limI', L.i) + '</label>' +
    '<label class="lbl">🧱 עולם הבנייה' + H.esc(u('b')) + sel('limB', L.b) + '</label>' +
    (canBase ? '' : '<p class="note">את הזמן הבסיסי אפשר לשנות רק אחרי שהילד משלים את אתגר היום.</p>') +
    '<p class="note">בנק זמן להיום: ' + H.esc(H.limMin(L.bank)) + ' (הילד מרוויח מלמידה, עד חצי שעה ביום)</p>' +
    '<div class="row">' + H.LIM_ADD.map(m => '<button class="mini" data-add="' + m + '">➕ ' + m + ' דקות</button>').join('') + '<button class="mini" id="pinchange">🔑 שנה קוד</button></div>';
  const apply = () => { L.i = Number(H.$('limI').value); L.b = Number(H.$('limB').value); L.set = true; H.save(); H.renderTimeBox(); H.toast('נשמר', 'good'); };
  if(canBase){ H.$('limI').onchange = apply; H.$('limB').onchange = apply; }
  box.querySelectorAll('[data-add]').forEach(b => b.onclick = () => { H.limAdd(Number(b.dataset.add)); H.renderTimeBox(); });
  H.$('pinchange').onclick = () => H.askPin(() => H.renderTimeBox(), {change: true, force: true});
};
