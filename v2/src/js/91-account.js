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

/* Client ID של האפליקציה. הוא לא סוד: הוא גלוי בכל דף שמציג כפתור התחברות. */
H.DEFAULT_CLIENT_ID = '112684717494-sf1ajin7d13vpmkgd8nvtp9me5co1d7g.apps.googleusercontent.com';
H.clientId = function(){ try{ return localStorage.getItem(H.CID_KEY) || H.DEFAULT_CLIENT_ID; }catch(e){ return H.DEFAULT_CLIENT_ID; } };
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

/* שני הכפתורים תמיד מוצגים. מה שמשתנה הוא אם אפשר ללחוץ עליהם,
   והטקסט שמסביר למה. כפתור שנעלם בלי הסבר נראה כמו משהו שלא קיים. */
H.renderAccount = async function(){
  const cidIn = H.$('cidIn');
  if(cidIn && document.activeElement !== cidIn) cidIn.value = H.clientId();
  const $ = id => H.$(id) || {style:{}, classList:{toggle(){}}};     /* מסך שלא קיים לא מפיל */
  const login = $('loginbtn'), out = $('signoutbtn'), sync = $('syncnow');
  const g = $('gbtn'), hg = $('homeg'), msg = $('accmsg');
  const hin = $('homesignin'), hout = $('homesignout'), hmail = $('homeemail'), hadm = $('homeadmin');

  if(H.signedIn()){
    login.disabled = true;  login.textContent = '✅ מחובר';
    out.disabled = false;   sync.style.display = '';
    hin.style.display = 'none'; hout.disabled = false; hout.style.display = '';
    hmail.style.display = ''; hmail.textContent = '✅ ' + H.acc.email;
    H.checkAdmin();
    $('adminbtn').style.display = ''; $('delbtn').style.display = '';
    g.innerHTML = ''; hg.innerHTML = '';
    msg.className = 'note ok';
    msg.textContent = 'מחובר: ' + H.acc.email + ' · ההתקדמות מסתנכרנת';
    return;
  }
  login.disabled = false; login.textContent = '🔐 התחבר עם גוגל';
  out.disabled = true;    sync.style.display = 'none';
  hin.style.display = ''; hout.disabled = true; hout.style.display = '';
  hmail.style.display = 'none'; hadm.style.display = 'none';
  $('adminbtn').style.display = 'none'; $('delbtn').style.display = 'none';
  g.innerHTML = ''; hg.innerHTML = '';
  if(!H.clientId()){
    msg.className = 'note';
    msg.textContent = 'אי אפשר להתחבר עדיין: חסר Client ID מגוגל. כשיהיה, הדבק אותו בשדה למעלה.';
    return;
  }
  msg.className = 'note'; msg.textContent = '';
  try{
    await H.loadGsi();
    google.accounts.id.initialize({
      client_id: H.clientId(), callback: H.onCredential,
      auto_select: false, use_fedcm_for_prompt: true
    });
    const o = {theme:'outline', size:'large', text:'signin_with', locale:'iw', shape:'pill'};
    if(g.nodeType)  google.accounts.id.renderButton(g, o);
    if(hg.nodeType) google.accounts.id.renderButton(hg, o);
  }catch(e){
    msg.className = 'note bad';
    msg.textContent = 'אין חיבור לגוגל. התחברות דורשת אינטרנט.';
  }
};

/* האם המשתמש המחובר מנהל. השרת מחליט; כאן רק מציגים כפתור. */
H.adminOk = null;
H.checkAdmin = async function(){
  const b = H.$('homeadmin'); if(!b) return;
  if(H.adminOk === H.acc.email){ b.style.display = ''; return; }
  if(!H.apiUrl()) return;
  try{
    const r = await fetch(H.apiUrl() + '/admin?ping=1', {headers: H.authHeader()});
    if(r.ok){ H.adminOk = H.acc.email; b.style.display = ''; }
  }catch(e){}
};

/* לחיצה על "התחבר" עם או בלי Client ID */
H.login = async function(){
  if(!H.clientId()){
    H.setSyncMsg('חסר Client ID מגוגל. הדבק אותו בשדה "Client ID" ואז לחץ שוב.', true);
    const f = H.$('cidIn'); if(f) f.focus();
    return;
  }
  try{
    await H.loadGsi();
    google.accounts.id.initialize({client_id: H.clientId(), callback: H.onCredential, auto_select:false, use_fedcm_for_prompt:true});
    google.accounts.id.prompt();
  }catch(e){ H.setSyncMsg('אין חיבור לגוגל', true); }
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
H.apiUrl  = () => H.ocrUrl() ? H.ocrUrl().replace(/\/+$/, '') : '';
H.syncUrl = () => H.apiUrl() ? H.apiUrl() + '/sync' : '';

H.pull = async function(){
  const r = await fetch(H.syncUrl(), {headers: H.authHeader()});
  if(r.status === 401){ H.acc.exp = 0; H.renderAccount(); throw new Error('auth'); }
  if(!r.ok) throw new Error('http ' + r.status);
  return r.json();                                  /* {state, at} */
};
H.push = async function(keep){
  if(!H.signedIn() || !H.syncUrl()) return false;
  const r = await fetch(H.syncUrl(), {
    method: 'POST',
    headers: Object.assign({'Content-Type': 'application/json'}, H.authHeader()),
    body: JSON.stringify({state: H.state, at: H.state.updatedAt || Date.now()}),
    keepalive: !!keep          /* משתחרר גם כשסוגרים את הדף */
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
        H.state = H.cleanState(srv.state);
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
  H._pt = setTimeout(() => { H.push().catch(() => {}); }, 45000);   /* השרת מגביל במילא במיקר הקצר */
};
