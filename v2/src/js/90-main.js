/* ========== הפעלה ========== */
H.refresh = function(){
  H.$('topic').textContent = H.topic() || '';
  H.$('hello').textContent = H.state.name
    ? 'היי ' + H.state.name + '!' : 'היי!';
  H.renderMap(); H.renderPlay(); H.renderAlbum(); H.renderShop(); H.renderReport();
  H.renderChallenge(); H.paint();
};

H.boot = function(){
  H.load();
  if(H.loadAcc) H.loadAcc();
  try{ if(localStorage.getItem('hachtava_script') === 'dfus'){
    document.body.classList.add('dfus');
    H.$('ktbtn').textContent = 'דפוס 🔤';
  } }catch(e){}
  H.initVoice();
  H.refresh();
  if(H.needsOnboard()) H.startOnboard(); else H.show('home');

  /* כפתורים קבועים */
  H.$('backbtn').onclick   = () => { H.sfx.tap(); H.home(); };
  H.$('againbtn').onclick  = () => { if(H.endAgain) H.endAgain(); };
  H.$('endhome').onclick   = () => H.home();
  H.$('buildcheck').onclick= () => H.byId('build').check();
  H.$('anacheck').onclick  = () => H.byId('anagram').check();
  H.$('buildhint').onclick = () => H.byId('build').hint();
  H.$('writebtn').onclick  = () => H.byId('write').check();
  H.$('writeclear').onclick= () => { H.sfx.tap(); H.padClear(); };
  H.$('ktbtn').onclick     = H.toggleScript;
  document.querySelectorAll('[data-go]').forEach(b =>
    b.onclick = () => { H.sfx.tap(); H.show(b.dataset.go); });
  /* בלי קול עברי הכפתור הזה חסר תועלת, אז הוא הופך ל"הצג שוב" */
  document.querySelectorAll('[data-say]').forEach(b => {
    b.onclick = () => { H.sfx.tap(); H.say(H.run && H.run.word); };
  });
  H.labelSay = () => document.querySelectorAll('[data-say]').forEach(b => {
    if(b.classList.contains('speaker')) { b.textContent = H.useAudio ? '\ud83d\udd0a' : '\ud83d\udc41\ufe0f'; return; }
    b.textContent = H.useAudio
      ? '\ud83d\udd0a \u05e9\u05de\u05e2 \u05e9\u05d5\u05d1'
      : '\ud83d\udc41\ufe0f \u05d4\u05e6\u05d2 \u05e9\u05d5\u05d1';
  });
  H.labelSay();

  /* פתיחת הקול דורשת מגע ראשון בדפדפנים */
  document.addEventListener('pointerdown', function once(){
    H.ac(); try{ speechSynthesis.resume(); }catch(e){}
    /* דפדפנים נוטים לאשר אחסון קבוע רק אחרי אינטראקציה אמיתית */
    H.askPersist();
    document.removeEventListener('pointerdown', once);
  }, {once:true});
  H.initInstall();
  if(H.trackStart) H.trackStart();

  if(!H.storageOK) H.toast('\u05d4\u05d4\u05ea\u05e7\u05d3\u05de\u05d5\u05ea \u05dc\u05d0 \u05ea\u05d9\u05e9\u05de\u05e8 \u05d1\u05de\u05db\u05e9\u05d9\u05e8 \u05d4\u05d6\u05d4 \u2014 \u05e4\u05ea\u05d7 \u05d3\u05e8\u05da \u05d4\u05e7\u05d9\u05e9\u05d5\u05e8', 'no');
  if(!H.useAudio) H.toast('\u05d0\u05d9\u05df \u05e7\u05d5\u05dc \u05e2\u05d1\u05e8\u05d9 \u05d1\u05de\u05db\u05e9\u05d9\u05e8 \u2014 \u05d4\u05de\u05d9\u05dc\u05d4 \u05ea\u05d5\u05e6\u05d2 \u05dc\u05e8\u05d2\u05e2 \u05d1\u05de\u05e7\u05d5\u05dd');
  if(H.state.daily.streak > 1) H.toast('🔥 רצף ' + H.state.daily.streak + ' ימים!', 'level');
  if(H.streakBonus) setTimeout(() => {
    H.toast('🎁 בונוס רצף: +' + H.streakBonus + ' מטבעות!', 'level');
    H.confetti(40); H.paint();
  }, 1800);
};
document.addEventListener('DOMContentLoaded', H.boot);
