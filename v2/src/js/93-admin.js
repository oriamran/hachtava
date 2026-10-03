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
  }catch(e){ msg('אין חיבור לשרת', true); }
};

H.renderAdmin = function(d){
  const users = Array.isArray(d.users) ? d.users : [];
  const now = Date.now(), week = 7 * 864e5;
  const active = users.filter(u => now - u.last < week).length;
  const sec = users.reduce((a, u) => a + (u.sec || 0), 0);
  const visits = users.reduce((a, u) => a + (u.visits || 0), 0);
  const n = users.length || 1;
  H.$('admsum').innerHTML =
    '<div class="statbox"><b>' + (d.total || 0) + '</b><small>נרשמו</small></div>' +
    '<div class="statbox"><b>' + active + '</b><small>פעילים בשבוע</small></div>' +
    '<div class="statbox"><b>' + H.esc(H.fmtDur(sec / n)) + '</b><small>זמן ממוצע</small></div>' +
    '<div class="statbox"><b>' + (visits / n).toFixed(1) + '</b><small>כניסות ממוצע</small></div>';
  if(!users.length){
    H.$('admbody').innerHTML = '<p class="note">עדיין אין משתמשים רשומים.</p>';
    return;
  }
  H.$('admbody').innerHTML = '<div class="admwrap"><table class="admtbl"><thead><tr>' +
    '<th>הורה</th><th>נראה</th><th>כניסות</th><th>זמן</th>' +
    '<th>רמה</th><th>מילים</th><th>רצף</th></tr></thead><tbody>' +
    users.map(u =>
      '<tr><td class="em">' + H.esc(u.email) + '</td>' +
      '<td>' + H.esc(H.fmtAgo(u.last)) + '</td>' +
      '<td>' + (u.visits || 0) + '</td>' +
      '<td>' + H.esc(H.fmtDur(u.sec)) + '</td>' +
      '<td>' + (u.level || 1) + '</td>' +
      '<td>' + (u.earned || 0) + '/' + (u.words || 0) + '</td>' +
      '<td>' + (u.streak || 0) + '</td></tr>').join('') +
    '</tbody></table></div>' +
    (d.truncated ? '<p class="note bad">הרשימה קוצרה — יש יותר מהשהוצג.</p>' : '');
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
