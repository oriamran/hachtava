/* ==========================================================
   בחירת נושא מילים כשנכנסים למשחק (מ"משחקים" ומהמסע).
   עם חבילה אחת אין מה לבחור, והמשחק מתחיל ישר.
   ========================================================== */
H.pendingGame = null;
H.chooseTopic = function(gameId, station){
  const packs = H.state.packs.filter(p => p.list.some(w => String(w).trim()));
  const origin = ['play', 'map', 'plan'].includes(H.screen) ? H.screen : 'home';
  if(packs.length < 2){ return H.startRound(gameId, station, undefined, {origin}); }
  H.pendingGame = {gameId, station, origin};
  const g = H.byId(gameId);
  H.$('topictitle').textContent = g.e + ' ' + g.name + ': באיזה נושא?';
  const box = H.$('topiclist'); box.innerHTML = '';
  packs.forEach(p => {
    const on = p.id === H.state.pack;
    const b = H.el('button', 'gamecard' + (on ? ' on' : ''),
      '<span class="gc-e">' + (on ? '✅' : '📝') + '</span><b>' + H.esc(p.topic || 'הכתבה') + '</b>' +
      '<small>' + p.list.length + ' מילים' + (p.draft ? ' · טיוטה' : '') + '</small>');
    b.onclick = () => {
      H.sfx.tap();
      H.state.pack = p.id; H.syncStats(); H.save(); H.refresh();
      const pg = H.pendingGame;
      H.startRound(pg.gameId, pg.station, undefined, {origin: pg.origin});
    };
    box.appendChild(b);
  });
  const lib = H.el('button', 'mini', '📚 עוד נושאים מהמאגר');
  lib.onclick = () => H.openLibrary();
  box.appendChild(lib);
  H.show('topic');
};
