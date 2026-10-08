/* ==========================================================
   דיווח על בעיה מתוך המשחק. נשלח לשרת (אותו שרת של הסנכרון),
   ונקרא בלוח הניהול או בסקריפט tools/reports.mjs.
   נשלח: מה שהמשתמש כתב + מסך, גרסה, מכשיר, שגיאות אחרונות, וטקסט המסך.
   לא נשלחים: שם הילד. תמונה נשלחת רק אם המשתמש צירף אותה (צילום מסך). אימייל רק אם ההורה מחובר וסימן "אפשר לחזור אליי".
   ========================================================== */
H.REPORT_KEY = 'hachtava_report_draft';
H.reportCtx = function(){
  const sc = document.querySelector('.screen.on');
  let snap = sc ? sc.innerText.replace(/\s+/g, ' ').trim() : '';
  const nm = (H.state.name || '').trim(); if(nm.length > 1) snap = snap.split(nm).join('…');
  const ex = {};
  try{ if(H.screen === 'world' && H.world.diag) Object.assign(ex, H.world.diag()); if(H.screen === 'voxel' && H.vox.diag) Object.assign(ex, H.vox.diag()); }catch(e){}
  ex.stage = H.state.plan ? H.state.plan.n : 0;
  const pk = H.pack && H.pack();
  return {screen: H.screen, game: (H.run && H.run.game && H.run.game.id) || '', origin: (H.run && H.run.origin) || '',
    level: H.state.level, nikud: H.state.nikud, nikudOn: H.nikudOn ? H.nikudOn() : true, script: H.scriptNow ? H.scriptNow() : '',
    topic: pk ? pk.topic : '', words: pk ? pk.list.length : 0, draft: !!(pk && pk.draft),
    build: H.BUILD, vw: innerWidth, vh: innerHeight, dpr: devicePixelRatio, ua: navigator.userAgent, lang: navigator.language,
    online: navigator.onLine, signedIn: !!(H.signedIn && H.signedIn()), errs: H.errLog.slice(), snap, extra: ex};
};
H.openReport = function(){
  H.reportCtxNow = H.reportCtx();                       /* צילום מצב לפני שהחלון נפתח */
  const box = H.$('reportbox'); box.style.display = '';
  let draft = ''; try{ draft = localStorage.getItem(H.REPORT_KEY) || ''; }catch(e){}
  H.$('repText').value = draft; H.$('repMsg').textContent = ''; H.$('repMsg').className = 'note';
  H.$('repContactRow').style.display = (H.signedIn && H.signedIn()) ? '' : 'none';
  H.$('repContact').checked = false; H.$('repSend').disabled = false;
  H.repKind = 'bug'; H.renderRepKinds(); H.repImg = ''; H.renderRepImg();
  /* מתוך עולם תלת־ממדי: מצרפים אוטומטית תמונה של מה שרואים (אפשר להסיר) */
  try{
    const w = H.screen === 'world' ? H.world : (H.screen === 'voxel' ? H.vox : null), shot = w && w.snap ? w.snap() : '';
    if(shot) H.shrinkImage(shot, out => { if(out && !H.repImg){ H.repImg = out; H.renderRepImg(); } });
  }catch(e){}
  setTimeout(() => H.$('repText').focus(), 60);
};
H.renderRepKinds = function(){
  const K = [['bug', '🐞 משהו לא עובד'], ['confusing', '❓ משהו מבלבל'], ['idea', '💡 רעיון']];
  const row = H.$('repKinds'); row.innerHTML = '';
  K.forEach(([id, t]) => { const b = H.el('button', 'lvchip' + (H.repKind === id ? ' on' : ''), t); b.onclick = () => { H.repKind = id; H.renderRepKinds(); }; row.appendChild(b); });
};
/* תמונה מצורפת: מקטינים לצד של עד 1100 פיקסלים ול-JPEG, כדי שתישלח מהר גם בסלולר */
H.shrinkImage = function(src, done){
  const img = new Image();
  img.onload = () => {
    const sc = Math.min(1, 1100 / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height)), c = document.createElement('canvas');
    c.width = Math.max(1, Math.round((img.naturalWidth || img.width) * sc)); c.height = Math.max(1, Math.round((img.naturalHeight || img.height) * sc));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    let q = .7, out = c.toDataURL('image/jpeg', q);
    while(out.length > 290000 && q > .3){ q -= .1; out = c.toDataURL('image/jpeg', q); }
    done(out.length <= 300000 ? out : '');
  };
  img.onerror = () => done('');
  img.src = src;
};
H.renderRepImg = function(){
  const box = H.$('repImgBox'); if(!box) return;
  const can = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
  box.innerHTML = (H.repImg ? '<div class="rep-prev"><img alt="" src="' + H.repImg + '"><button class="mini" id="repImgX">✕ הסר</button></div>' : '') +
    '<div class="row"><button class="mini" id="repAttach">📎 צרף צילום מסך</button>' + (can ? '<button class="mini" id="repGrab">📸 צלם את המסך עכשיו</button>' : '') + '</div>';
  H.$('repAttach').onclick = () => H.$('repFile').click();
  const x = H.$('repImgX'); if(x) x.onclick = () => { H.repImg = ''; H.renderRepImg(); };
  const g = H.$('repGrab'); if(g) g.onclick = H.grabScreen;
};
H.pickRepFile = function(inp){
  const f = inp.files && inp.files[0]; inp.value = '';
  if(!f) return;
  if(!/^image\//.test(f.type)){ H.$('repMsg').className = 'note bad'; H.$('repMsg').textContent = 'אפשר לצרף רק תמונה'; return; }
  const rd = new FileReader();
  rd.onload = () => H.shrinkImage(rd.result, out => {
    if(!out){ H.$('repMsg').className = 'note bad'; H.$('repMsg').textContent = 'לא הצלחתי לקרוא את התמונה'; return; }
    H.repImg = out; H.$('repMsg').textContent = ''; H.renderRepImg();
  });
  rd.readAsDataURL(f);
};
/* צילום של הלשונית הנוכחית (מחשב). מסתירים את חלון הדיווח לרגע כדי שלא ייכנס לתמונה. */
H.grabScreen = async function(){
  const box = H.$('reportbox');
  try{
    const st = await navigator.mediaDevices.getDisplayMedia({video: true, audio: false, preferCurrentTab: true});
    box.style.visibility = 'hidden';
    const v = document.createElement('video'); v.srcObject = st; v.muted = true; await v.play();
    await new Promise(r => setTimeout(r, 450));
    const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext('2d').drawImage(v, 0, 0);
    st.getTracks().forEach(t => t.stop()); box.style.visibility = '';
    H.shrinkImage(c.toDataURL('image/png'), out => { if(out){ H.repImg = out; H.renderRepImg(); } });
  }catch(e){ box.style.visibility = ''; }
};
H.closeReport = function(){ H.$('reportbox').style.display = 'none'; };
H.sendReport = async function(){
  const text = H.$('repText').value.trim(), msg = H.$('repMsg');
  try{ localStorage.setItem(H.REPORT_KEY, text); }catch(e){}
  if(text.length < 3){ msg.className = 'note bad'; msg.textContent = 'כתוב בכמה מילים מה קרה'; return; }
  if(!H.apiUrl()){ msg.className = 'note bad'; msg.textContent = 'אין כתובת שרת'; return; }
  H.$('repSend').disabled = true; msg.className = 'note'; msg.textContent = 'שולח…';
  const contact = H.$('repContact').checked && H.signedIn && H.signedIn();
  try{
    const post = img => fetch(H.apiUrl() + '/report', {method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({text, kind: H.repKind, contact: !!contact, email: contact ? H.acc.email : '', ctx: H.reportCtxNow || H.reportCtx(), img})});
    let r = await post(H.repImg || ''), noImg = false;
    /* שרת ישן (לפני עדכון) דוחה בקשה גדולה: שולחים שוב בלי התמונה, כדי שהטקסט לפחות יגיע */
    if(!r.ok && r.status !== 429 && H.repImg){ r = await post(''); noImg = r.ok; }
    if(r.status === 429){ msg.className = 'note bad'; msg.textContent = 'נשלחו הרבה דיווחים. נסה שוב בעוד קצת.'; H.$('repSend').disabled = false; return; }
    if(!r.ok) throw new Error('http ' + r.status);
    try{ localStorage.removeItem(H.REPORT_KEY); }catch(e){}
    msg.className = 'note ok'; msg.textContent = noImg ? 'הדיווח נשלח, אבל בלי התמונה. נסו שוב מאוחר יותר.' : 'תודה! הדיווח נשלח 🙏'; H.sfx.good && H.sfx.good();
    setTimeout(H.closeReport, 1600);
  }catch(e){
    msg.className = 'note bad'; msg.textContent = 'לא הצלחתי לשלוח. בדוק חיבור ונסה שוב. הטקסט נשמר.'; H.$('repSend').disabled = false;
  }
};

/* ---------- קריאה בלוח הניהול ---------- */
H.openReports = async function(){
  H.show('admin');
  const body = H.$('admbody'); H.$('admsum').innerHTML = ''; body.innerHTML = '<p class="note">טוען דיווחים…</p>';
  if(!H.signedIn()){ body.innerHTML = '<p class="note bad">צריך להתחבר קודם.</p>'; return; }
  try{
    const r = await fetch(H.apiUrl() + '/admin/reports', {headers: H.authHeader()});
    if(r.status === 403){ body.innerHTML = '<p class="note bad">אין לך הרשאת ניהול.</p>'; return; }
    if(!r.ok) throw new Error('http ' + r.status);
    H.renderReports(await r.json());
  }catch(e){ body.innerHTML = '<p class="note bad">אין חיבור לשרת.</p>'; }
};
H.renderReports = function(d){
  const body = H.$('admbody'), list = Array.isArray(d.reports) ? d.reports : [];
  const open = list.filter(x => x.status !== 'done').length;
  H.$('admsum').innerHTML = '<div class="statbox"><b>' + (d.total || 0) + '</b><small>דיווחים</small></div><div class="statbox"><b>' + open + '</b><small>פתוחים</small></div>';
  body.innerHTML = '<div class="row"><button class="mini" onclick="H.openAdmin()">👥 משתמשים</button></div>';
  if(!list.length){ body.innerHTML += '<p class="note">אין דיווחים.</p>'; return; }
  const KI = {bug: '🐞', confusing: '❓', idea: '💡'};
  list.forEach(x => {
    const c = x.ctx || {}, card = H.el('div', 'repcard' + (x.status === 'done' ? ' done' : ''));
    const when = new Date(x.at || 0).toLocaleString('he-IL');
    card.innerHTML = '<div class="rc-h"><b>' + (KI[x.kind] || '🐞') + ' ' + H.esc(when) + '</b><small>' + H.esc(x.id) + '</small></div>' +
      '<p class="rc-t">' + H.esc(x.text) + '</p>' +
      '<p class="rc-c">' + H.esc([c.screen, c.game, 'כיתה ' + c.level, c.script, c.topic + ' (' + c.words + ')', c.build, c.vw + '×' + c.vh + '@' + c.dpr].filter(Boolean).join(' · ')) + '</p>' +
      '<p class="rc-c">' + H.esc((c.ua || '').slice(0, 110)) + '</p>' +
      ((c.errs && c.errs.length) ? '<p class="rc-e">' + c.errs.map(H.esc).join('<br>') + '</p>' : '') +
      (x.email ? '<p class="rc-c">📧 ' + H.esc(x.email) + '</p>' : '') +
      (x.hasImg ? '<button class="mini" data-img="' + H.esc(x.id) + '">🖼️ הצג תמונה מצורפת</button><div class="rc-img"></div>' : '') +
      (c.snap ? '<details><summary>מה היה על המסך</summary><p class="rc-c">' + H.esc(c.snap) + '</p></details>' : '');
    const ib = card.querySelector('[data-img]');
    if(ib) ib.onclick = async () => { ib.disabled = true;
      try{ const r = await fetch(H.apiUrl() + '/admin/reports?img=' + encodeURIComponent(x.id), {headers: H.authHeader()}), d = await r.json();
        if(d.img) card.querySelector('.rc-img').innerHTML = '<img alt="" src="' + d.img + '">'; else ib.textContent = 'אין תמונה'; }catch(e){ ib.disabled = false; } };
    const row = H.el('div', 'row');
    const done = H.el('button', 'mini', x.status === 'done' ? '↩️ פתח מחדש' : '✔ טופל');
    done.onclick = () => H.markReport(x.id, x.status === 'done' ? 'open' : 'done');
    const del = H.el('button', 'mini', '🗑️ מחק'); del.onclick = () => { if(confirm('למחוק את הדיווח?')) H.markReport(x.id, 'delete'); };
    row.appendChild(done); row.appendChild(del); card.appendChild(row); body.appendChild(card);
  });
};
H.markReport = async function(id, action){
  try{ await fetch(H.apiUrl() + '/admin/reports', {method: 'POST', headers: Object.assign({'Content-Type': 'application/json'}, H.authHeader()), body: JSON.stringify({id, action})}); }catch(e){}
  H.openReports();
};

/* כפתור דיווחים בראש לוח הניהול, עם מספר הפתוחים */
H.admReportsBtn = async function(){
  const body = H.$('admbody'); if(!body) return;
  const b = H.el('button', 'go', '🐞 דיווחים על בעיות'); b.style.margin = '0 0 12px'; b.onclick = () => H.openReports();
  body.insertBefore(b, body.firstChild);
  try{
    const r = await fetch(H.apiUrl() + '/admin/reports', {headers: H.authHeader()});
    if(!r.ok) return; const d = await r.json(), open = (d.reports || []).filter(x => x.status !== 'done').length;
    b.textContent = '🐞 דיווחים על בעיות · ' + (open ? open + ' חדשים' : 'אין חדשים');
  }catch(e){}
};
