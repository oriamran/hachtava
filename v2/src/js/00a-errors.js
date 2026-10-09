/* שגיאות אחרונות, כדי שדיווח על בעיה יכלול מה השתבש (בלי מידע אישי) */
H.errLog = [];
(function(){
  const add = t => { H.errLog.push(String(t).replace(/\s+/g, ' ').slice(0, 200)); if(H.errLog.length > 8) H.errLog.shift(); };
  window.addEventListener('error', e => add((e.message || 'error') + ' @' + String(e.filename || '').split('/').pop() + ':' + (e.lineno || 0)));
  window.addEventListener('unhandledrejection', e => add('promise: ' + (e.reason && e.reason.message || e.reason)));
})();

/* הגנה מהטמעה באתר זר (clickjacking). GitHub Pages לא מאפשר כותרת frame-ancestors, ובתגית meta היא לא נתמכת,
   אז אם הדף נטען בתוך מסגרת של מקור אחר, מסתירים אותו. הטמעה באותו מקור מותרת. */
try{
  if(window.top !== window.self){
    let same = false;
    try{ same = window.top.location.origin === location.origin; }catch(e){ same = false; }
    if(!same) document.documentElement.style.display = 'none';
  }
}catch(e){ document.documentElement.style.display = 'none'; }
