/* ==========================================================
   קריאת המילים מהצילום.
   המשחק עצמו לא יודע לקרוא תמונה — הוא שולח אותה לשרת קטן
   שמחזיק את המפתח, ומקבל בחזרה רשימת מילים מנוקדות.
   בלי כתובת שרת הכפתור פשוט לא מוצג, והמשחק נשאר אופליין.
   ========================================================== */
/* \u05dc\u05d0\u05df \u05e4\u05d5\u05e0\u05d9\u05dd \u05db\u05e9\u05e0\u05d2\u05de\u05e8\u05ea \u05d4\u05de\u05db\u05e1\u05d4. \u05e9\u05e0\u05d4 \u05db\u05d0\u05df. */
H.CONTACT = 'hachtava@example.com';
H.OCR_KEY = 'hachtava_v2_ocr_url';
/* \u05e7\u05d5\u05d3 \u05d2\u05d9\u05e9\u05d4 \u05dc\u05e1\u05e8\u05d9\u05e7\u05d4. \u05db\u05dc \u05e2\u05d5\u05d3 \u05d6\u05d4 \u05d1\u05d1\u05e0\u05d9\u05d9\u05d4,
   \u05e8\u05e7 \u05de\u05d9 \u05e9\u05de\u05d7\u05d6\u05d9\u05e7 \u05d0\u05d5\u05ea\u05d5 \u05d9\u05db\u05d5\u05dc \u05dc\u05e1\u05e8\u05d5\u05e7. */
H.TOK_KEY = 'hachtava_v2_scan_token';
H.scanToken = function(){ try{ return localStorage.getItem(H.TOK_KEY) || ''; }catch(e){ return ''; } };
H.setScanToken = function(t){
  t = (t || '').trim();
  try{ t ? localStorage.setItem(H.TOK_KEY, t) : localStorage.removeItem(H.TOK_KEY); }catch(e){}
};
H.DEV_KEY = 'hachtava_v2_device';
/* מזהה מכשיר, כדי שהמכסה תהיה לכל משתמש ולא אחת לכולם.
   ניקוי אחסון מאפס אותו — מקובל: מי שיטרח לעקוף ממילא לא היה משלם. */
H.deviceId = function(){
  try{
    let d = localStorage.getItem(H.DEV_KEY);
    if(!d){
      d = (crypto.randomUUID ? crypto.randomUUID()
           : String(Date.now()) + '-' + Math.random().toString(16).slice(2));
      localStorage.setItem(H.DEV_KEY, d);
    }
    return d;
  }catch(e){ return '00000000-0000-0000-0000-000000000000'; }
};
H.quota = null;
/* כתובת השרת — משמשת גם לסנכרון, לא רק לסריקה */
H.apiUrl  = function(){
  try{ return localStorage.getItem(H.OCR_KEY) || ''; }catch(e){ return ''; }
};
H.ocrUrl  = function(){
  try{ return localStorage.getItem(H.OCR_KEY) || ''; }catch(e){ return ''; }
};
H.setOcrUrl = function(u){
  u = (u || '').trim().replace(/\/+$/, '');
  try{ u ? localStorage.setItem(H.OCR_KEY, u) : localStorage.removeItem(H.OCR_KEY); }catch(e){}
  H.renderOcr();
};
H.renderOcr = function(){
  const btn = H.$('ocrbtn'), inp = H.$('ocrUrlIn');
  if(inp && document.activeElement !== inp) inp.value = H.ocrUrl();
  const t = H.$('scanTokIn');
  if(t && document.activeElement !== t) t.value = H.scanToken();
  if(btn) btn.style.display = (H.ocrUrl() && H.loadPhoto()) ? '' : 'none';
};
H.readPhoto = async function(){
  const url = H.ocrUrl(), photo = H.loadPhoto();
  if(!url || !photo) return;
  const btn = H.$('ocrbtn'), msg = H.$('ocrmsg');
  btn.disabled = true;
  const label = btn.textContent;
  btn.textContent = 'קורא את הדף…';
  msg.className = 'note'; msg.textContent = '';
  try{
    const m = /^data:([^;]+);/.exec(photo);
    const res = await fetch(url, {
      method: 'POST',
      headers: Object.assign({'Content-Type': 'application/json'},
               H.scanToken() ? {'X-Scan-Token': H.scanToken()} : {}),
      body: JSON.stringify({image: photo, mediaType: m ? m[1] : 'image/jpeg',
                            deviceId: H.deviceId()})
    });
    const data = await res.json().catch(() => null);
    if(data && data.quota){ H.quota = data.quota; H.renderQuota(); }
    /* 402 = נגמרה המכסה החודשית. לא שגיאה, אלא החומה. */
    if(res.status === 402 || (data && data.upgrade)){
      msg.className = 'note bad';
      msg.textContent = (data && data.error) || 'ניצלת את המכסה החודשית';
      H.$('upgradebox').style.display = '';
      return;
    }
    if(!res.ok || !data){
      msg.className = 'note bad';
      msg.textContent = (data && data.error) || ('שגיאה ' + res.status);
      return;
    }
    if(!data.words || !data.words.length){
      msg.className = 'note bad';
      msg.textContent = 'לא מצאתי מילים בתמונה';
      return;
    }
    /* לא דורסים בשקט — מה שהיה בתיבה נשאר עד שהוא שומר */
    H.$('wordsIn').value = data.words.join('\n');
    msg.className = 'note ok';
    msg.textContent = 'נמצאו ' + data.words.length +
      ' מילים. עבור עליהן ולחץ שמור.' +
      (data.note ? ' · ' + data.note : '');
    H.sfx.good();
  }catch(e){
    msg.className = 'note bad';
    msg.textContent = 'אין חיבור לשרת';
  }finally{
    btn.disabled = false; btn.textContent = label;
  }
};

/* כמה סריקות נשארו החודש */
H.renderQuota = function(){
  const c = H.$('contactline'); if(c) c.textContent = H.CONTACT;
  const el = H.$('quotamsg');
  if(!el) return;
  if(!H.ocrUrl() || !H.quota){ el.style.display = 'none'; return; }
  el.style.display = '';
  if(H.quota.unlimited){
    el.className = 'note ok';
    el.textContent = '\u05de\u05e0\u05d5\u05d9 \u05e4\u05e2\u05d9\u05dc \u00b7 \u05e1\u05e8\u05d9\u05e7\u05d5\u05ea \u05dc\u05dc\u05d0 \u05d4\u05d2\u05d1\u05dc\u05d4';
    H.$('upgradebox').style.display = 'none';
    return;
  }
  const left = Math.max(0, H.quota.limit - H.quota.used);
  el.className = left ? 'note' : 'note bad';
  /* \u05d0\u05d7\u05ea, \u05dc\u05d0 "1 \u05e1\u05e8\u05d9\u05e7\u05d5\u05ea" */
  el.textContent = left === 0 ? '\u05dc\u05d0 \u05e0\u05e9\u05d0\u05e8\u05d5 \u05e1\u05e8\u05d9\u05e7\u05d5\u05ea \u05d4\u05d7\u05d5\u05d3\u05e9'
    : left === 1 ? '\u05e0\u05e9\u05d0\u05e8\u05d4 \u05e1\u05e8\u05d9\u05e7\u05d4 \u05d0\u05d7\u05ea \u05d4\u05d7\u05d5\u05d3\u05e9'
    : '\u05e0\u05e9\u05d0\u05e8\u05d5 ' + left + ' \u05e1\u05e8\u05d9\u05e7\u05d5\u05ea \u05d4\u05d7\u05d5\u05d3\u05e9';
  if(!left) H.$('upgradebox').style.display = '';
};
