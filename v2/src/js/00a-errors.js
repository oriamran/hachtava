/* שגיאות אחרונות, כדי שדיווח על בעיה יכלול מה השתבש (בלי מידע אישי) */
H.errLog = [];
(function(){
  const add = t => { H.errLog.push(String(t).replace(/\s+/g, ' ').slice(0, 200)); if(H.errLog.length > 8) H.errLog.shift(); };
  window.addEventListener('error', e => add((e.message || 'error') + ' @' + String(e.filename || '').split('/').pop() + ':' + (e.lineno || 0)));
  window.addEventListener('unhandledrejection', e => add('promise: ' + (e.reason && e.reason.message || e.reason)));
})();
