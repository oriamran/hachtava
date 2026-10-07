/* ==========================================================
   ניווט בין מסכים, פסי מצב, הודעות קופצות, קונפטי
   ========================================================== */
H.$ = id => document.getElementById(id);
H.el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if(cls) e.className = cls;
  if(html !== undefined) e.innerHTML = html;
  return e;
};

H.screen = 'home';
H.show = function(id){
  if(H.hidePeek) H.hidePeek();
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('on'));
  const s = H.$('s-' + id);
  if(s) s.classList.add('on');
  H.screen = id;
  const bare = (id === 'home' || id === 'onboard' || id === 'tour');   /* אין לאן לחזור משם */
  H.$('backbtn').classList.toggle('on', !bare);
  document.body.classList.toggle('nav', !bare);
  if(id === 'tips') H.renderTips();
  document.body.classList.toggle('inworld', id === 'world' || id === 'voxel');
  window.scrollTo(0, 0);
  H.paint();
};
/* חזרה אחורה: ממשחק חוזרים למקום שממנו התחלנו (רשימת המשחקים, המפה, התוכנית) ולא תמיד לבית */
H.GAME_SCREENS = new Set(['memory','build','pick','missing','bubbles','write','anagram','catch','proof','tricky','flash','search','letters','world','voxel','end']);
/* חזרה לאי אחרי משחק שנפתח משער */
H.returnToWorld = function(){
  speechSynthesis.cancel();
  H.show('world');
  if(!H.world.open('explore', true)){ H.home(); }
};
/* חזרה לעולם הבנייה אחרי משחק שנפתח משם */
H.returnToVoxel = function(){
  speechSynthesis.cancel();
  H.show('voxel');
  if(!H.vox.open('free')){ H.home(); }
};
H.goBack = function(){
  if(H.screen === 'world' && H.world.mode() === 'explore') return H.home();     /* יציאה מהאי */
  if(H.screen === 'voxel' && H.vox.mode() === 'free'){ H.vox.flush(); return H.home(); }
  if(H.screen === 'topic' && H.pendingGame && H.pendingGame.origin === 'world') return H.returnToWorld();
  if(H.screen === 'topic' && H.pendingGame && H.pendingGame.origin !== 'home'){
    if(H.pendingGame.origin === 'map') H.renderMap();
    if(H.pendingGame.origin === 'play') H.renderPlay();
    return H.show(H.pendingGame.origin);
  }
  const o = H.run && H.run.origin;
  if(H.GAME_SCREENS.has(H.screen) && o && o !== 'home'){
    speechSynthesis.cancel();
    if(H.loop){ cancelAnimationFrame(H.loop); H.loop = null; }
    if(H.run.game && H.run.game.stop) H.run.game.stop();
    if(o === 'map') H.renderMap();
    if(o === 'play') H.renderPlay();
    if(o === 'plan') H.renderPlan();
    if(o === 'world') return H.returnToWorld();
    if(o === 'voxel') return H.returnToVoxel();
    return H.show(o);
  }
  H.home();
};
H.home = function(){
  speechSynthesis.cancel();
  if(H.loop){ cancelAnimationFrame(H.loop); H.loop = null; }
  H.show('home');
};

/* פס עליון: רמה, XP, מטבעות, רצף */
H.paint = function(){
  const s = H.state;
  H.$('lvl').textContent   = H.level();
  H.$('coins').textContent = s.coins;
  H.$('streak').textContent = s.daily.streak;
  H.$('xpfill').style.width = Math.round(100 * H.inLevel() / H.LEVEL_STEP) + '%';
  const a = H.AVATARS.find(a => a.id === s.avatar) || H.AVATARS[0];
  const hat = H.HATS.find(h => h.id === s.hat);
  const ring = H.RINGS.find(r => r.id === s.ring) || H.RINGS[0];
  const av = H.$('avatarchip');
  av.style.background = ring.css;
  const pet = H.PETS.find(p => p.id === s.pet);
  av.innerHTML = '<span class="av-e">' + a.e + '</span>' +
                 (hat && hat.e ? '<span class="av-hat">' + hat.e + '</span>' : '') +
                 (pet && pet.e ? '<span class="av-pet">' + pet.e + '</span>' : '');
  document.body.dataset.bg = H.BGS.some(b => b.id === s.bg) ? s.bg : 'day';
};

/* הודעה קופצת */
H.toast = function(text, kind){
  const t = H.el('div', 'toast ' + (kind || ''), text);
  H.$('toasts').appendChild(t);
  setTimeout(() => t.classList.add('out'), 1600);
  setTimeout(() => t.remove(), 2200);
};

/* פרס XP עם אנימציה, ועלייה ברמה */
H.reward = function(xp, why){
  const up = H.addXp(xp);
  H.sfx.coin();
  H.toast('+' + xp + ' ⭐' + (why ? ' ' + why : ''), 'good');
  if(up){
    H.sfx.level();
    setTimeout(() => { H.toast('עלית לרמה ' + up + '! 🎊', 'level'); H.confetti(); }, 500);
  }
  H.paint();
};

H.confetti = function(n){
  const box = H.$('confetti');
  const cols = ['#ffd84d','#ff6b8b','#7ef0c4','#9bd7ff','#c9a7ff','#ff9f1c'];
  for(let i = 0; i < (n || 40); i++){
    const d = H.el('i');
    d.style.left = Math.random()*100 + '%';
    d.style.background = cols[i % cols.length];
    d.style.animationDelay = (Math.random()*0.9) + 's';
    d.style.animationDuration = (1.5 + Math.random()*1.5) + 's';
    box.appendChild(d);
    setTimeout(() => d.remove(), 3600);
  }
};

/* מסך סיום אחיד לכל מיני־משחק */
H.finish = function(opt){
  /* opt: {title, emoji, text, stars, xp, station, onAgain} */
  H.$('endemoji').textContent = opt.emoji || '🌟';
  H.$('endtitle').textContent = opt.title || 'כל הכבוד!';
  H.$('endtext').innerHTML = opt.text || '';
  const st = H.$('endstars');
  st.innerHTML = '';
  for(let i = 1; i <= 3; i++){
    st.appendChild(H.el('span', 'bigstar' + (i <= (opt.stars||0) ? ' lit' : ''), '⭐'));
  }
  if(opt.station !== undefined && (opt.stars||0) > (H.state.stars[opt.station]||0)){
    H.state.stars[opt.station] = opt.stars; H.save();
  }
  H.endAgain = opt.onAgain || null;
  const og = H.run && H.run.origin;
  H.$('endhome').textContent = og === 'play' ? '🎮 למשחקים' : og === 'map' ? '🗺️ למפה' : og === 'plan' ? '📅 לתוכנית' : og === 'world' ? '🏝️ לאי' : '🏠 בית';
  H.$('againbtn').style.display = opt.onAgain ? '' : 'none';
  H.$('againbtn').textContent = opt.againLabel || '🔁 עוד פעם';
  if(opt.xp) H.reward(opt.xp);
  if((opt.stars||0) >= 3) H.confetti(60);
  H.show('end');
};
