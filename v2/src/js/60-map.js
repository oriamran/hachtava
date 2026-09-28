/* ==========================================================
   מפת המסע: תחנות שנפתחות לפי כוכבים
   ========================================================== */
H.STATIONS = [
  {id:0,  g:'memory',  t:'בית הזיכרון', e:'🏠'},
  {id:1,  g:'pick',    t:'אוזן קשבת',       e:'👂'},
  {id:2,  g:'build',   t:'מגדל האותיות', e:'🏰'},
  {id:3,  g:'missing', t:'מערת החידות',  e:'🕳️'},
  {id:4,  g:'bubbles', t:'אגם הבועות',    e:'🌊'},
  {id:5,  g:'write',   t:'גשר הכתב',        e:'✍️'},
  {id:6,  g:'memory',  t:'יער הזוגות',    e:'🌲'},
  {id:7,  g:'bubbles', t:'מפל האותיות',  e:'💦'},
  {id:8,  g:'build',   t:'סדנת המילים',  e:'🔨'},
  {id:9,  g:'missing', t:'פירמידת הניקוד', e:'🔺'},
  {id:10, g:'pick',    t:'צוק ההקשבה',    e:'⛰️'},
  {id:11, g:'anagram', t:'מערבולת האותיות', e:'🌪️'},
  {id:12, g:'catch',   t:'שדה הקטיף',   e:'🧺'},
  {id:13, g:'write',   t:'ארמון הכתב',    e:'🏵️'}
];
H.starsOf   = id => H.state.stars[id] || 0;
H.totalStars= () => H.STATIONS.reduce((a, s) => a + H.starsOf(s.id), 0);
H.unlocked  = id => id === 0 || H.starsOf(id - 1) > 0;

H.renderMap = function(){
  const box = H.$('maplist'); box.innerHTML = '';
  H.STATIONS.forEach(st => {
    const open = H.unlocked(st.id), s = H.starsOf(st.id);
    const g = H.byId(st.g);
    const el = H.el('button', 'station' + (open ? '' : ' locked') + (s === 3 ? ' perfect' : ''));
    el.innerHTML =
      '<span class="st-e">' + (open ? st.e : '🔒') + '</span>' +
      '<span class="st-txt"><b>' + st.t + '</b><small>' + g.e + ' ' + g.name + '</small></span>' +
      '<span class="st-stars">' + '⭐'.repeat(s) + '☆'.repeat(3 - s) + '</span>';
    if(open) el.onclick = () => { H.sfx.tap(); H.startRound(st.g, st.id); };
    else el.onclick = () => H.toast('סיים את התחנה שלפני כדי לפתוח');
    box.appendChild(el);
  });
  H.$('mapstars').textContent = H.totalStars() + ' / ' + (H.STATIONS.length * 3);
};

/* בחירה חופשית של מיני־משחק */
H.renderPlay = function(){
  const box = H.$('playlist'); box.innerHTML = '';
  H.GAMES.forEach(g => {
    const el = H.el('button', 'gamecard');
    el.innerHTML = '<span class="gc-e">' + g.e + '</span><b>' + g.name + '</b><small>' + g.desc + '</small>';
    el.onclick = () => { H.sfx.tap(); H.startRound(g.id, undefined); };
    box.appendChild(el);
  });
};
