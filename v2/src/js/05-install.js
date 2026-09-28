/* ==========================================================
   שמירת ההתקדמות מתחילה כאן, לא בכפתור ייצוא.
   שני דברים שקורים לבד:
   1. בקשה מהדפדפן לא למחוק את האחסון אוטומטית.
   2. הצעה להתקין למסך הבית — לאתר מותקן דפדפנים נותנים
      אחסון קבוע הרבה יותר בקלות, וגם קל יותר לחזור אליו.
   ========================================================== */
H.installEvt = null;

H.askPersist = async function(){
  try{
    if(!navigator.storage || !navigator.storage.persist) return 'unsupported';
    if(await navigator.storage.persisted()) return 'already';
    return (await navigator.storage.persist()) ? 'granted' : 'denied';
  }catch(e){ return 'error'; }
};

H.initInstall = function(){
  /* אנדרואיד/כרום: הדפדפן מודיע שאפשר להתקין */
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    H.installEvt = e;
    H.showInstall(true);
  });
  window.addEventListener('appinstalled', () => {
    H.installEvt = null;
    H.showInstall(false);
    H.askPersist();
    H.toast('הותקן! 🎉 עכשיו ההתקדמות נשמרת טוב יותר', 'level');
  });
  /* אייפון לא שולח את האירוע, אז מציגים הסבר ידני */
  const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const standalone = window.matchMedia('(display-mode: standalone)').matches
                  || window.navigator.standalone === true;
  H.isInstalled = standalone;
  if(iOS && !standalone) H.showInstall(true, true);
};
H.showInstall = function(on, ios){
  const b = H.$('installbtn');
  if(!b) return;
  b.style.display = on ? '' : 'none';
  b.dataset.ios = ios ? '1' : '';
};
H.doInstall = async function(){
  if(H.$('installbtn').dataset.ios === '1'){
    alert('להתקנה באייפון:\n\n' +
          '1. לחץ על כפתור השיתוף למטה ⬆️\n' +
          '2. גלול ובחר "הוסף למסך הבית"\n' +
          '3. לחץ "הוסף"');
    return;
  }
  if(!H.installEvt) return;
  H.installEvt.prompt();
  const res = await H.installEvt.userChoice;
  if(res && res.outcome === 'accepted') H.installEvt = null;
};
