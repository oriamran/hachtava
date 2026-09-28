/* ========== הפעלה ========== */
H.refresh = function(){
  H.$('topic').textContent = H.topic() || '';
  H.$('hello').textContent = H.state.name
    ? 'היי ' + H.state.name + '!' : 'היי!';
  H.renderMap(); H.renderPlay(); H.renderAlbum(); H.renderShop(); H.renderReport(); H.paint();
};

H.boot = function(){
  H.load();
  try{ if(localStorage.getItem('hachtava_script') === 'dfus'){
    document.body.classList.add('dfus');
    H.$('ktbtn').textContent = 'דפוס 🔤';
  } }catch(e){}
  H.initVoice();
  H.refresh();
  H.show('home');

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
  document.querySelectorAll('[data-say]').forEach(b =>
    b.onclick = () => H.speak(H.run && H.run.word));

  /* פתיחת הקול דורשת מגע ראשון בדפדפנים */
  document.addEventListener('pointerdown', function once(){
    H.ac(); try{ speechSynthesis.resume(); }catch(e){}
    document.removeEventListener('pointerdown', once);
  }, {once:true});

  if(H.state.daily.streak > 1) H.toast('🔥 רצף ' + H.state.daily.streak + ' ימים!', 'level');
};
document.addEventListener('DOMContentLoaded', H.boot);
