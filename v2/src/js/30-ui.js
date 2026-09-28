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
  H.$('backbtn').classList.toggle('on', id !== 'home');
  document.body.classList.toggle('nav', id !== 'home');
  window.scrollTo(0, 0);
  H.paint();
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
  av.innerHTML = '<span class="av-e">' + a.e + '</span>' +
                 (hat && hat.e ? '<span class="av-hat">' + hat.e + '</span>' : '');
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
  H.$('againbtn').style.display = opt.onAgain ? '' : 'none';
  if(opt.xp) H.reward(opt.xp);
  if((opt.stars||0) >= 3) H.confetti(60);
  H.show('end');
};
