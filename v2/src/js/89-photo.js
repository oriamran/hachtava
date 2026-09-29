/* ==========================================================
   צילום דף ההכתבה כהפניה בזמן ההקלדה.
   לא זיהוי אוטומטי — התמונה פשוט נשארת על המסך מעל תיבת
   המילים, כדי שלא צריך לצאת לאפליקציית התמונות ולחזור.
   נשמרת במפתח נפרד, כדי שלא תנפח את קוד הגיבוי.
   ========================================================== */
H.PHOTO_KEY = 'hachtava_v2_photo';
H.PHOTO_MAX = 1000;          /* צלע ארוכה, פיקסלים */
H.PHOTO_Q   = 0.72;

H.loadPhoto = function(){
  try{ return localStorage.getItem(H.PHOTO_KEY) || ''; }catch(e){ return ''; }
};
H.savePhoto = function(url){
  try{
    if(url) localStorage.setItem(H.PHOTO_KEY, url);
    else localStorage.removeItem(H.PHOTO_KEY);
    return true;
  }catch(e){
    alert('התמונה גדולה מדי לאחסון המכשיר');
    return false;
  }
};
/* מקטין לפני שמירה — תמונה מהטלפון היא כמה מגה, ואין בזה צורך */
H.pickPhoto = function(input){
  const f = input.files && input.files[0];
  if(!f) return;
  const img = new Image();
  img.onload = () => {
    const s = Math.min(1, H.PHOTO_MAX / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width  = Math.round(img.width  * s);
    c.height = Math.round(img.height * s);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const url = c.toDataURL('image/jpeg', H.PHOTO_Q);
    if(H.savePhoto(url)){
      H.renderPhoto();
      H.toast('התמונה נשמרה ✔️', 'good');
    }
    URL.revokeObjectURL(img.src);
  };
  img.onerror = () => alert('לא הצלחתי לקרוא את התמונה');
  img.src = URL.createObjectURL(f);
  input.value = '';
};
H.clearPhoto = function(){
  if(!H.loadPhoto()) return;
  if(!confirm('להסיר את הצילום?')) return;
  H.savePhoto(''); H.renderPhoto();
};
H.togglePhoto = function(){
  const w = H.$('photowrap');
  w.classList.toggle('big');
};
H.renderPhoto = function(){
  const url = H.loadPhoto();
  ['photowrap','photowrap2'].forEach(id => {
    const w = H.$(id); if(!w) return;
    w.style.display = url ? '' : 'none';
    const img = w.querySelector('img');
    if(img && img.getAttribute('src') !== url) img.src = url;
  });
  if(H.renderOcr) H.renderOcr();
  const hint = H.$('photohint');
  if(hint) hint.style.display = url ? 'none' : '';
};
