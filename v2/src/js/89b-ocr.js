/* ==========================================================
   קריאת המילים מהצילום.
   המשחק עצמו לא יודע לקרוא תמונה — הוא שולח אותה לשרת קטן
   שמחזיק את המפתח, ומקבל בחזרה רשימת מילים מנוקדות.
   בלי כתובת שרת הכפתור פשוט לא מוצג, והמשחק נשאר אופליין.
   ========================================================== */
H.OCR_KEY = 'hachtava_v2_ocr_url';
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
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({image: photo, mediaType: m ? m[1] : 'image/jpeg'})
    });
    const data = await res.json().catch(() => null);
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
