/* ==========================================================
   כפתור "אחורה" של המכשיר: החלקה באייפון, כפתור אחורה באנדרואיד
   ובדפדפן. בכל מסך שאינו הראשי יש ערך אחד נוסף בהיסטוריה. כשהמשתמש
   חוזר אחורה, האפליקציה סוגרת חלון פתוח (דיווח, קוד, תפריט), ואם אין
   כזה, מבצעת את אותה "חזרה" של כפתור החץ באפליקציה (H.goBack).
   במסך הראשי אין ערך נוסף, וחזרה אחורה יוצאת מהאתר כרגיל.
   ========================================================== */
(function(){
  let guard = false, ignore = 0;
  const vis = id => { const e = H.$(id); return !!e && e.style.display !== 'none' && e.style.visibility !== 'hidden'; };
  /* סוגר את החלון העליון הפתוח. מחזיר true אם סגר משהו. */
  H.navClose = function(){
    if(H.$('pinov')){ const c = H.$('pincancel'); if(c) c.click(); else H.$('pinov').remove(); return true; }
    if(vis('limover')){ const b = H.$('limhome'); if(b) b.click(); else H.$('limover').style.display = 'none'; return true; }
    if(vis('reportbox')){ H.closeReport(); return true; }
    if(vis('vxquiz')){ const b = H.$('vxqx'); if(b) b.click(); return true; }
    if(H.screen === 'voxel' && vis('vxpal')){ H.$('vxpal').style.display = 'none'; return true; }
    return false;
  };
  const needGuard = () => H.screen && !['home', 'onboard', 'tour'].includes(H.screen);
  /* נקרא בסוף כל H.show: מוסיף או מסיר את הערך הנוסף בהיסטוריה */
  H.navSync = function(){
    try{
      if(needGuard() && !guard){ history.pushState({hg: 1}, ''); guard = true; }
      else if(!needGuard() && guard){ guard = false; ignore++; history.back(); }
    }catch(e){}
  };
  window.addEventListener('popstate', () => {
    if(ignore > 0){ ignore--; return; }
    if(!guard) return;                         /* אין לנו ערך: זו יציאה רגילה מהאתר */
    guard = false;                             /* הערך שלנו הוצא מההיסטוריה */
    if(!H.navClose() && H.goBack && needGuard()) H.goBack();
    H.navSync();                               /* אם עדיין לא במסך הראשי, מחזירים את הערך */
  });
})();
