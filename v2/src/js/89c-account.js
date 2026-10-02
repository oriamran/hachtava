/* ==========================================================
   חשבון הורה וגיבוי בענן.
   התחברות עם Google, והעתק אחד של ההתקדמות בשרת. אופציונלי:
   בלי כתובת שרת ובלי מזהה לקוח המשחק עובד כמו תמיד, במכשיר.

   הכלל: לא דורסים בשקט. כששני הצדדים מחזיקים התקדמות שונה,
   ההורה בוחר. התקדמות של ילד שנמחקת בטעות גרועה מכל חיכוך.
   ========================================================== */
/* מזהה הלקוח מ-Google Cloud Console. לא סוד. חייב להיות זהה לשרת. */
H.GOOGLE_CLIENT_ID = 'PASTE_CLIENT_ID.apps.googleusercontent.com';
H.ACCT_KEY = 'hachtava_v2_acct';

H.acctConfigured = () =>
  !!H.apiUrl() && !/^PASTE_/.test(H.GOOGLE_CLIENT_ID);
H.acct = (function(){
  try{ return JSON.parse(localStorage.getItem(H.ACCT_KEY) || 'null'); }catch(e){ return null; }
})();
H.setAcct = function(a){
  H.acct = a;
  try{ a ? localStorage.setItem(H.ACCT_KEY, JSON.stringify(a)) : localStorage.removeItem(H.ACCT_KEY); }catch(e){}
};
/* ה-ID token תקף בערך שעה. אחרי זה צריך להתחבר מחדש */
H.tokenOk = () => !!(H.acct && H.acct.tok && H.acct.exp * 1000 > Date.now() + 30000);
H.parseJwt = function(t){
  try{
    const p = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(escape(atob(p + '='.repeat((4 - p.length % 4) % 4)))));
  }catch(e){ return null; }
};

/* ---------- קריאות לשרת ---------- */
H.cloudCall = async function(method, body){
  const res = await fetch(H.apiUrl() + '/sync', {
    method,
    headers: Object.assign({'Authorization': 'Bearer ' + H.acct.tok},
                           body ? {'Content-Type': 'application/json'} : {}),
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => null);
  return {status: res.status, data};
};
H.localIsBlank = () => !H.state.xp && !H.state.album.length && !Object.keys(H.state.log).length;

H.cloudPush = async function(quiet){
  if(!H.tokenOk()) { if(!quiet) H.toast('צריך להתחבר מחדש', 'no'); return false; }
  try{
    const r = await H.cloudCall('POST', {state: H.state, at: H.state._mod || Date.now()});
    if(r.status === 200){ H.acct.last = Date.now(); H.setAcct(H.acct); H.renderAccount(); if(!quiet) H.toast('גובה בענן ✔️', 'good'); return true; }
    if(r.status === 409){ if(!quiet || !H.acct.warnedStale){ H.acct.warnedStale = true; H.setAcct(H.acct); H.toast('בענן יש גרסה חדשה יותר — לחץ "שחזר מהענן"', 'no'); } return false; }
    if(!quiet) H.toast('הגיבוי נכשל (' + r.status + ')', 'no');
  }catch(e){ if(!quiet) H.toast('אין חיבור לשרת', 'no'); }
  return false;
};
H.cloudSyncNow = async function(){
  /* גם ידנית לא דורסים עותק חדש יותר — השרת מסרב ואנחנו מסבירים */
  await H.cloudPush(false);
};
H.cloudRestore = async function(){
  if(!H.tokenOk()) return H.toast('צריך להתחבר מחדש', 'no');
  try{
    const r = await H.cloudCall('GET');
    if(r.status !== 200 || !r.data || !r.data.state) return H.toast('אין עדיין גיבוי בענן', 'no');
    if(!H.localIsBlank() && !confirm('לשחזר מהענן? ההתקדמות שבמכשיר הזה תוחלף בעותק מהענן.')) return;
    H.applyCloud(r.data);
  }catch(e){ H.toast('אין חיבור לשרת', 'no'); }
};
H.applyCloud = function(d){
  H._keepMod = true;                       /* החותמת היא של הענן, לא של עכשיו */
  H.state = Object.assign(H.blank(), d.state);
  H.state._mod = d.at;
  delete H.state.words;
  H.syncStats(); H.save();
  H._keepMod = false;
  H.refresh && H.refresh();
  H.toast('שוחזר מהענן ✔️', 'good');
  H.renderAccount();
};

/* אחרי הכניסה: מחליטים מה לעשות עם שני העותקים */
H.afterSignIn = async function(){
  try{
    const r = await H.cloudCall('GET');
    if(r.status !== 200) return H.toast('ההתחברות הצליחה, אבל השרת לא ענה (' + r.status + ')', 'no');
    const cloud = r.data && r.data.state ? r.data : null;
    if(!cloud) return H.cloudPush(false);                       /* ענן ריק: מעלים */
    if(H.localIsBlank()) return H.applyCloud(cloud);            /* מכשיר ריק: מורידים */
    if(confirm('נמצאה התקדמות שמורה בענן, וגם במכשיר הזה יש התקדמות.\n\nאישור = לשחזר מהענן (ההתקדמות שבמכשיר תוחלף).\nביטול = להשאיר את המכשיר, והעותק בענן יוחלף בו.'))
      return H.applyCloud(cloud);
    H.toast('נשארה ההתקדמות שבמכשיר. הענן יתעדכן בו בגיבוי הבא.');
  }catch(e){ H.toast('אין חיבור לשרת', 'no'); }
};

/* ---------- התחברות Google ---------- */
H.onGoogle = function(resp){
  const p = H.parseJwt(resp.credential);
  if(!p) return H.toast('ההתחברות נכשלה', 'no');
  H.setAcct({tok: resp.credential, exp: p.exp, email: p.email || ''});
  H.renderAccount();
  H.afterSignIn();
};
H.signOut = function(){
  H.setAcct(null);
  try{ window.google && google.accounts.id.disableAutoSelect(); }catch(e){}
  H.renderAccount();
};
H.loadGsi = () => new Promise((ok, no) => {
  if(window.google && google.accounts) return ok();
  const s = document.createElement('script');
  s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
  s.onload = ok; s.onerror = no;
  document.head.appendChild(s);
});
H.renderAccount = async function(){
  const msg = H.$('acctmsg'), btn = H.$('gbtn'), box = H.$('acctbtns');
  if(!msg) return;
  btn.innerHTML = '';
  if(!H.acctConfigured()){
    msg.textContent = 'גיבוי בענן עדיין לא הוגדר. המשחק עובד במכשיר בלבד.';
    box.style.display = 'none'; return;
  }
  if(H.tokenOk()){
    msg.textContent = 'מחובר: ' + H.acct.email +
      (H.acct.last ? ' · גיבוי אחרון: ' + new Date(H.acct.last).toLocaleString('he-IL') : '');
    box.style.display = ''; return;
  }
  box.style.display = 'none';
  msg.textContent = H.acct
    ? 'ההתחברות פגה. התחבר שוב כדי להמשיך לגבות (' + (H.acct.email || '') + ')'
    : 'התחבר כדי לשמור את ההתקדמות בענן ולהעביר בין מכשירים. לא חובה.';
  try{
    await H.loadGsi();
    google.accounts.id.initialize({client_id: H.GOOGLE_CLIENT_ID, callback: H.onGoogle});
    google.accounts.id.renderButton(btn, {theme:'outline', size:'large', text:'signin_with', locale:'he'});
  }catch(e){
    msg.textContent += ' (אין חיבור ל-Google כרגע)';
  }
};

/* גיבוי אוטומטי שקט, אחרי שהמשחק נשמר. לא מציף את השרת */
H.onSaved = function(){
  if(!H.acctConfigured() || !H.tokenOk()) return;
  clearTimeout(H._pushT);
  H._pushT = setTimeout(() => H.cloudPush(true), 10000);
};
