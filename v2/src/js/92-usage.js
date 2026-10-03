/* ==========================================================
   מעקב שימוש: כניסות וזמן פעיל. נשמר בהתקדמות, ומגיע לשרת רק
   אם ההורה התחבר. אין כאן שום שליחה אנונימית: בלי חשבון, כל מה
   שנמדד נשאר במכשיר.

   "זמן פעיל" נספר רק כשהדף גלוי ויש מגע בשישים השניות האחרונות,
   אחרת טאב שנשכח פתוח היה נספר כשעות משחק.
   ========================================================== */
H.IDLE_MS   = 60000;
H.VISIT_GAP = 30 * 60000;          /* מרווח של חצי שעה מתחיל "כניסה" חדשה */
H._lastTouch = 0; H._ticks = 0;

H.touch = () => { H._lastTouch = Date.now(); };

H.trackStart = function(){
  const u = H.usage(), now = Date.now();
  if(!u.first) u.first = now;
  if(now - (u.last || 0) > H.VISIT_GAP) u.visits++;
  u.last = now; H._lastTouch = now;
  H.saveQuiet();
  ['pointerdown','keydown','touchstart'].forEach(e =>
    addEventListener(e, H.touch, {capture:true, passive:true}));
  setInterval(H.tick, 5000);
  document.addEventListener('visibilitychange', () => {
    if(document.visibilityState === 'hidden') H.flush();
  });
  addEventListener('pagehide', H.flush);
};

H.tick = function(){
  if(document.visibilityState !== 'visible') return;
  const now = Date.now();
  if(now - H._lastTouch > H.IDLE_MS) return;
  const u = H.usage();
  u.activeSec += 5; u.last = now;
  if(++H._ticks % 6 === 0) H.saveQuiet();
};

/* בסגירת הדף: שומרים מקומית, ואם יש חשבון — דוחפים עכשיו */
H.flush = function(){
  H.saveQuiet();
  if(H.signedIn && H.signedIn() && H.syncUrl && H.syncUrl()) H.push(true).catch(() => {});
};

H.fmtDur = function(sec){
  sec = Math.round(sec || 0);
  if(sec < 60) return sec + ' שנ׳';
  const m = Math.round(sec / 60);
  if(m < 60) return m + ' דק׳';
  return Math.floor(m / 60) + ' ש׳ ' + (m % 60) + ' דק׳';
};
H.fmtAgo = function(ts){
  if(!ts) return '—';
  const d = Math.floor((Date.now() - ts) / 864e5);
  return d <= 0 ? 'היום' : d === 1 ? 'אתמול' : 'לפני ' + d + ' ימים';
};
