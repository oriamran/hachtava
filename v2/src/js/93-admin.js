/* ==========================================================
   לוח ניהול: כמה נרשמו, ומה ההתקדמות והשימוש של כל אחד.
   השרת הוא שמחליט מי רשאי לראות אותו (רשימת מנהלים בסוד),
   כך שגם מי שיפתח את המסך הזה בכוח לא יקבל נתונים.
   נשמרים ונספרים רק מי שהתחבר: משתמש בלי חשבון לא נראה כאן.
   ========================================================== */
H.openAdmin = async function(){
  H.show('admin');
  const body = H.$('admbody'), sum = H.$('admsum');
  sum.innerHTML = ''; body.innerHTML = '';
  const msg = (t, bad) => { body.innerHTML = '<p class="note ' + (bad ? 'bad' : '') + '">' + H.esc(t) + '</p>'; };
  if(!H.signedIn()) return msg('צריך להתחבר קודם.', true);
  if(!H.apiUrl()) return msg('אין כתובת שרת.', true);
  msg('טוען…');
  try{
    const r = await fetch(H.apiUrl() + '/admin', {headers: H.authHeader()});
    if(r.status === 403) return msg('אין לך הרשאת ניהול.', true);
    if(r.status === 401){ H.acc.exp = 0; H.renderAccount(); return msg('ההתחברות פגה. התחבר מחדש.', true); }
    if(!r.ok) return msg('שגיאה ' + r.status, true);
    H.renderAdmin(await r.json());
    if(H.admReportsBtn) H.admReportsBtn();
  }catch(e){ msg('אין חיבור לשרת', true); }
};

/* גרף קווי קטן. points = [[x, y], ...] ו-x הוא האינדקס. מחזיר מחרוזת SVG. */
H.admLine = function(vals, color, W, Hh){
  if(vals.length < 2) return '';
  const max = Math.max.apply(null, vals) || 1, min = Math.min.apply(null, vals);
  const span = (max - min) || 1, pad = 6;
  const pts = vals.map((v, i) =>
    (pad + i * (W - 2 * pad) / (vals.length - 1)).toFixed(1) + ',' +
    (Hh - pad - (v - min) / span * (Hh - 2 * pad)).toFixed(1));
  return '<polyline fill="none" stroke="' + color + '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="' +
    pts.join(' ') + '"/><circle r="4" fill="' + color + '" cx="' + pts[pts.length - 1].split(',')[0] + '" cy="' + pts[pts.length - 1].split(',')[1] + '"/>';
};
H.admChart = function(hist){
  if(!hist || hist.length < 2) return '<p class="note">עוד אין מספיק ימים לגרף.</p>';
  const W = 300, Hh = 90;
  return '<svg class="admchart" viewBox="0 0 ' + W + ' ' + Hh + '" role="img" aria-label="התקדמות לאורך זמן">' +
    H.admLine(hist.map(h => h[2]), '#22b07d', W, Hh) +
    H.admLine(hist.map(h => h[1]), '#7c5cd6', W, Hh) + '</svg>' +
    '<div class="admlegend"><span style="color:#22b07d">● מילים שנכבשו (' + hist[hist.length - 1][2] + ')</span>' +
    '<span style="color:#7c5cd6">● ניסיון (' + hist[hist.length - 1][1] + ')</span></div>' +
    '<div class="admlegend"><small>' + H.esc(hist[0][0]) + '</small><small>' + H.esc(hist[hist.length - 1][0]) + '</small></div>';
};
H.gameName = id => { const g = H.byId && H.byId(id); return g ? g.e + ' ' + g.name : id; };
H.GRADE_NAME = {a2:'א׳–ב׳', d4:'ג׳–ד׳', f6:'ה׳–ו׳'};

H.admUser = function(u){
  const games = Object.keys(u.games || {}).sort((x, y) => u.games[y].sec - u.games[x].sec);
  const gt = games.length ? '<table class="admtbl small"><thead><tr><th>משחק</th><th>זמן</th><th>סבבים</th><th>דיוק</th></tr></thead><tbody>' +
    games.map(id => { const g = u.games[id], n = g.right + g.wrong;
      return '<tr><td>' + H.esc(H.gameName(id)) + '</td><td>' + H.esc(H.fmtDur(g.sec)) + '</td><td>' + g.rounds +
             '</td><td>' + (n ? Math.round(g.right / n * 100) + '%' : '–') + '</td></tr>'; }).join('') + '</tbody></table>'
    : '<p class="note">עוד לא שוחקו סבבים.</p>';
  const stuck = (u.stuck || []).length
    ? '<div class="chips">' + u.stuck.map(x => '<span class="chip bad">' + H.esc(x.w) + ' <small>' + x.bad + ' טעויות</small></span>').join('') + '</div>'
    : '<p class="note">אין מילים תקועות כרגע.</p>';
  const letters = (u.weakLetters || []).length
    ? '<div class="chips">' + u.weakLetters.map(x => '<span class="chip">' + H.esc(x.l) + ' <small>' + Math.round(x.bad / (x.ok + x.bad) * 100) + '% טעויות</small></span>').join('') + '</div>'
    : '<p class="note">אין עדיין מספיק נתוני כתיבה לאותיות.</p>';
  const d = document.createElement('details'); d.className = 'admuser';
  d.innerHTML = '<summary><span class="em">' + H.esc(u.email) + '</span>' +
    '<span>' + H.esc(H.GRADE_NAME[u.grade] || '') + '</span>' +
    '<span>' + H.esc(H.fmtDur(u.sec)) + '</span>' +
    '<span>' + (u.earned || 0) + '/' + (u.words || 0) + '</span>' +
    '<span>' + H.esc(H.fmtAgo(u.last)) + '</span></summary>' +
    '<div class="admdet"><h4>גרף התקדמות</h4>' + H.admChart(u.hist) +
    '<h4>במה שיחק</h4>' + gt +
    '<h4>איפה נתקע (מילים)</h4>' + stuck +
    '<h4>אותיות קשות</h4>' + letters +
    '<p class="note">נרשם: ' + H.esc(new Date(u.created || 0).toLocaleDateString('he-IL')) + ' · כניסות: ' + (u.visits || 0) + ' · רצף: ' + (u.streak || 0) + '</p></div>';
  return d;
};

H.renderAdmin = function(d){
  const users = Array.isArray(d.users) ? d.users : [];
  const now = Date.now(), DAY = 864e5;
  const active = users.filter(u => now - u.last < 7 * DAY).length;
  const fresh = users.filter(u => now - u.created < 7 * DAY).length;
  const sec = users.reduce((a, u) => a + (u.sec || 0), 0);
  const n = users.length || 1;
  H.$('admsum').innerHTML =
    '<div class="statbox"><b>' + (d.total || 0) + '</b><small>נרשמו</small></div>' +
    '<div class="statbox"><b>' + fresh + '</b><small>חדשים בשבוע</small></div>' +
    '<div class="statbox"><b>' + active + '</b><small>פעילים בשבוע</small></div>' +
    '<div class="statbox"><b>' + H.esc(H.fmtDur(sec)) + '</b><small>זמן משחק כולל</small></div>' +
    '<div class="statbox"><b>' + H.esc(H.fmtDur(sec / n)) + '</b><small>ממוצע למשתמש</small></div>';
  const body = H.$('admbody'); body.innerHTML = '';
  if(!users.length){ body.innerHTML = '<p class="note">עדיין אין משתמשים רשומים.</p>'; return; }

  /* נרשמים לפי יום, 30 ימים אחרונים */
  const days = [];
  for(let i = 29; i >= 0; i--){
    const t = new Date(now - i * DAY), k = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
    days.push([k, 0]);
  }
  users.forEach(u => {
    const t = new Date(u.created || 0), k = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
    const slot = days.find(x => x[0] === k); if(slot) slot[1]++;
  });
  const mx = Math.max.apply(null, days.map(x => x[1])) || 1;
  const reg = document.createElement('div');
  reg.innerHTML = '<h3>נרשמים ב־30 הימים האחרונים</h3><div class="admbars">' +
    days.map(x => '<i title="' + H.esc(x[0]) + ': ' + x[1] + '" style="height:' + (x[1] ? Math.max(8, x[1] / mx * 100) : 3) + '%"></i>').join('') + '</div>';
  body.appendChild(reg);

  /* סך הכול לפי משחק, על כל המשתמשים */
  const tot = {};
  users.forEach(u => Object.keys(u.games || {}).forEach(id => {
    const g = u.games[id], t = tot[id] || (tot[id] = {sec:0, rounds:0, right:0, wrong:0, users:0});
    t.sec += g.sec; t.rounds += g.rounds; t.right += g.right; t.wrong += g.wrong; t.users++;
  }));
  const ids = Object.keys(tot).sort((x, y) => tot[y].sec - tot[x].sec);
  const gm = document.createElement('div');
  gm.innerHTML = '<h3>איזה משחק משחקים</h3>' + (ids.length
    ? '<div class="admwrap"><table class="admtbl"><thead><tr><th>משחק</th><th>שחקנים</th><th>זמן</th><th>סבבים</th><th>דיוק</th></tr></thead><tbody>' +
      ids.map(id => { const t = tot[id], c = t.right + t.wrong;
        return '<tr><td>' + H.esc(H.gameName(id)) + '</td><td>' + t.users + '</td><td>' + H.esc(H.fmtDur(t.sec)) + '</td><td>' + t.rounds +
               '</td><td>' + (c ? Math.round(t.right / c * 100) + '%' : '–') + '</td></tr>'; }).join('') + '</tbody></table></div>'
    : '<p class="note">עוד אין נתונים לפי משחק. הם מתחילים להיאסף מהסבב הבא.</p>');
  body.appendChild(gm);

  /* מילים שהכי הרבה נתקעים בהן, בכל המשתמשים */
  const sw = {};
  users.forEach(u => (u.stuck || []).forEach(x => { sw[x.w] = (sw[x.w] || 0) + x.bad; }));
  const top = Object.keys(sw).sort((x, y) => sw[y] - sw[x]).slice(0, 10);
  if(top.length){
    const w = document.createElement('div');
    w.innerHTML = '<h3>איפה נתקעים הכי הרבה</h3><div class="chips">' +
      top.map(x => '<span class="chip bad">' + H.esc(x) + ' <small>' + sw[x] + '</small></span>').join('') + '</div>';
    body.appendChild(w);
  }

  body.appendChild(H.el('h3', '', 'כל משתמש (לחיצה פותחת)'));
  const head = H.el('div', 'admhead', '<span>הורה</span><span>כיתה</span><span>זמן</span><span>נכבשו</span><span>נראה</span>');
  body.appendChild(head);
  users.forEach(u => body.appendChild(H.admUser(u)));
  if(d.truncated) body.appendChild(H.el('p', 'note bad', 'הרשימה קוצרה — יש יותר מהשהוצג.'));
};

/* מחיקת החשבון והנתונים מהשרת, לבקשת ההורה */
H.deleteAccount = async function(){
  if(!H.signedIn() || !H.syncUrl()) return;
  if(!confirm('למחוק את הנתונים שלך מהשרת? ההתקדמות במכשיר הזה תישאר.')) return;
  try{
    const r = await fetch(H.syncUrl(), {method:'DELETE', headers: H.authHeader()});
    if(!r.ok) throw new Error('http ' + r.status);
    H.signOut();
    H.setSyncMsg('הנתונים נמחקו מהשרת ✔️');
  }catch(e){ H.setSyncMsg('לא הצלחתי למחוק', true); }
};
