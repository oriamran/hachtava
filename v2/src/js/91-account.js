/* ==========================================================
   התחברות עם גוגל וסנכרון ההתקדמות.
   נמצא כולו במסך ההורים: הילד לעולם לא מתחבר, והמשחק לא
   דורש חשבון. בלי Client ID לא נטען שום דבר מגוגל והמשחק
   נשאר אופליין כמו קודם.

   סנכרון: מי שכתב אחרון מנצח. אין מיזוג, בכוונה — מיזוג שגוי
   של התקדמות גרוע מלאבד מהלך אחד.
   ========================================================== */
H.CID_KEY = 'hachtava_v2_client_id';
H.ACC_KEY = 'hachtava_v2_account';
H.acc = {token:'', email:'', exp:0};

H.clientId = function(){ try{ return localStorage.getItem(H.CID_KEY) || ''; }catch(e){ return ''; } };
H.setClientId = function(v){
  v = (v || '').trim();
  try{ v ? localStorage.setItem(H.CID_KEY, v) : localStorage.removeItem(H.CID_KEY); }catch(e){}
  H.gsiLoaded = false;
  H.renderAccount();
};

/* טוקן של גוגל תקף בערך שעה. שומרים אותו רק כדי לשרוד רענון. */
H.loadAcc = function(){
  try{
    const a = JSON.parse(localStorage.getItem(H.ACC_KEY) || 'null');
    if(a && a.exp * 1000 > Date.now() + 60000) H.acc = a;
  }catch(e){}
};
H.saveAcc = function(){ try{ localStorage.setItem(H.ACC_KEY, JSON.stringify(H.acc)); }catch(e){} };
H.signedIn = () => !!H.acc.token && H.acc.exp * 1000 > Date.now() + 30000;
H.authHeader = () => H.signedIn() ? {'Authorization': 'Bearer ' + H.acc.token} : {};

H.parseJwt = function(t){
  try{
    const p = t.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
    return JSON.parse(decodeURIComponent(escape(atob(p + '='.repeat((4 - p.length % 4) % 4)))));
  }catch(e){ return null; }
};

/* מטעינים את הסקריפט של גוגל רק כשצריך, ורק עם Client ID */
H.loadGsi = function(){
  return new Promise((ok, no) => {
    if(window.google && google.accounts && google.accounts.id) return ok();
    if(H.gsiLoading) return H.gsiLoading.then(ok, no);
    H.gsiLoading = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = res; s.onerror = () => { H.gsiLoading = null; rej(new Error('offline')); };
      document.head.appendChild(s);
    });
    H.gsiLoading.then(ok, no);
  });
};

H.renderAccount = async function(){
  const box = H.$('accbox'); if(!box) return;
  const cidIn = H.$('cidIn');
  if(cidIn && document.activeElement !== cidIn) cidIn.value = H.clientId();
  const btn = H.$('gbtn'), msg = H.$('accmsg'), out = H.$('signoutbtn'), sync = H.$('syncnow');

  if(H.signedIn()){
    btn.innerHTML = ''; out.style.display = ''; sync.style.display = '';
    msg.className = 'note ok';
    msg.textContent = 'מחובר כע' + H.acc.email + ' · ההתקדמות מסתנכרנת';
    return;
  }
  out.style.display = 'none'; sync.style.display = 'none';
  if(!H.clientId()){
    btn.innerHTML = '';
    msg.className = 'note';
    msg.textContent = 'בלי Client ID אין התחברות, והמשחק שומר הכל רק במכשיר הזה.';
    return;
  }
  try{
    await H.loadGsi();
    google.accounts.id.initialize({
      client_id: H.clientId(),
      callback: H.onCredential,
      auto_select: false,
      use_fedcm_for_prompt: true
    });
    btn.innerHTML = '';
    google.accounts.id.renderButton(btn, {theme:'outline', size:'large', text:'signin_with', locale:'iw', shape:'pill'});
    msg.className = 'note'; msg.textContent = '';
  }catch(e){
    btn.innerHTML = '';
    msg.className = 'note bad';
    msg.textContent = 'אין חיבור לגוגל. התחברות דורשת אינטרנט.';
  }
};

H.onCredential = function(resp){
  const p = H.parseJwt(resp && resp.credential);
  if(!p || !p.exp){ H.toast('ההתחברות נכשלה', 'no'); return; }
  H.acc = {token: resp.credential, email: p.email || '', exp: p.exp};
  H.saveAcc();
  H.toast('מחובר ✔️', 'good');
  H.renderAccount();
  H.syncOnSignIn();
};

H.signOut = function(){
  H.acc = {token:'', email:'', exp:0};
  try{ localStorage.removeItem(H.ACC_KEY); }catch(e){}
  try{ if(window.google && google.accounts) google.accounts.id.disableAutoSelect(); }catch(e){}
  H.renderAccount();
};

/* ---------- סנכרון ---------- */
H.syncUrl = () => H.ocrUrl() ? H.ocrUrl().replace(/\/+$/, '') + '/sync' : '';

H.pull = async function(){
  const r = await fetch(H.syncUrl(), {headers: H.authHeader()});
  if(r.status === 401){ H.acc.exp = 0; H.renderAccount(); throw new Error('auth'); }
  if(!r.ok) throw new Error('http ' + r.status);
  return r.json();                                  /* {state, at} */
};
H.push = async function(){
  if(!H.signedIn() || !H.syncUrl()) return false;
  const r = await fetch(H.syncUrl(), {
    method: 'POST',
    headers: Object.assign({'Content-Type': 'application/json'}, H.authHeader()),
    body: JSON.stringify({state: H.state, at: H.state.updatedAt || Date.now()})
  });
  if(r.status === 409) return 'stale';              /* בשרת יש גרסה חדשה יותר */
  return r.ok;
};

/* בהתחברות: אם בשרת יש התקדמות חדשה יותר — שואלים, לא דורסים בשקט */
H.syncOnSignIn = async function(){
  if(!H.syncUrl()){ H.setSyncMsg('אין כתובת שרת. הסנכרון דורש אותה.', true); return; }
  try{
    const srv = await H.pull();
    const mine = H.state.updatedAt || 0;
    if(srv.state && srv.at > mine){
      const stars = Object.keys(srv.state.stars || {}).length;
      if(confirm('נמצאה התקדמות שמורה בחשבון (' +
              (srv.state.xp || 0) + ' נקודות, ' + stars + ' תחנות). לשחזר אותה במכשיר הזה?')){
        H.state = Object.assign(H.blank(), srv.state);
        H.syncStats(); H.save(true); H.refresh();
        H.setSyncMsg('שוחרר מהחשבון ✔️');
        return;
      }
    }
    await H.push();
    H.setSyncMsg('נשמר בחשבון ✔️');
  }catch(e){
    H.setSyncMsg('לא הצלחתי לסנכרן', true);
  }
};
H.syncNow = async function(){
  const ok = await H.push().catch(() => false);
  H.setSyncMsg(ok === true ? 'נשמר בחשבון ✔️'
             : ok === 'stale' ? 'בחשבון יש גרסה חדשה יותר — התחבר מחדש כדי לשחזר'
             : 'לא הצלחתי לסנכרן', ok !== true);
};
H.setSyncMsg = function(t, bad){
  const m = H.$('accmsg'); if(!m) return;
  m.className = bad ? 'note bad' : 'note ok'; m.textContent = t;
};

/* שמירה אוטומטית לשרת, מרוכזת: לא קריאה על כל לחיצה */
H.pushSoon = function(){
  if(!H.signedIn() || !H.syncUrl()) return;
  clearTimeout(H._pt);
  H._pt = setTimeout(() => { H.push().catch(() => {}); }, 6000);
};
