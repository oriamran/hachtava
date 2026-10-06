/* ==========================================================
   בחירת נושא מילים כשנכנסים למשחק (מ"משחקים" ומהמסע).
   המסך מציג את הרשימות של הילד, ומתחתיהן את נושאי המאגר המובנה:
   בחירה בנושא מהמאגר מוסיפה אותו כחבילה ומתחילה איתו, בלי לעבור בהורים.
   ========================================================== */
H.pendingGame = null;
H.topicMore = false;

H.chooseTopic = function(gameId, station){
  const origin = H.screen === 'world' || gameId === null ? 'world' : (['play', 'map', 'plan'].includes(H.screen) ? H.screen : 'home');
  H.pendingGame = {gameId, station, origin};
  H.topicMore = false;
  H.renderTopic();
  H.show('topic');
};

H.startPending = function(){
  const pg = H.pendingGame;
  H.refresh();
  if(!pg.gameId) return H.returnToWorld();            /* בחירת נושא לטיול באי */
  H.startRound(pg.gameId, pg.station, undefined, {origin: pg.origin});
};

H.renderTopic = function(){
  const pg = H.pendingGame, g = pg.gameId ? H.byId(pg.gameId) : null;
  H.$('topictitle').textContent = g ? g.e + ' ' + g.name + ': באיזה נושא?' : '🏝️ באיזה נושא לטייל?';
  const box = H.$('topiclist'); box.innerHTML = '';

  const mine = H.state.packs.filter(p => p.list.some(w => String(w).trim()));
  if(mine.length){
    box.appendChild(H.el('h3', 'topich', 'הרשימות שלי'));
    const grid = H.el('div', 'playlist');
    mine.forEach(p => {
      const on = p.id === H.state.pack;
      const b = H.el('button', 'gamecard' + (on ? ' on' : ''),
        '<span class="gc-e">' + (on ? '✅' : '📝') + '</span><b>' + H.esc(p.topic || 'הכתבה') + '</b>' +
        '<small>' + p.list.length + ' מילים' + (p.draft ? ' · טיוטה' : '') + '</small>');
      b.onclick = () => { H.sfx.tap(); H.state.pack = p.id; H.syncStats(); H.save(); H.startPending(); };
      grid.appendChild(b);
    });
    box.appendChild(grid);
  }

  /* מהמאגר: הכיתה של הילד קודם, והשאר אחרי "עוד כיתות" */
  const have = new Set(H.state.packs.map(p => p.libId).filter(Boolean));
  const tiers = H.LIB.slice().sort((a, b) => (b.id === H.state.level) - (a.id === H.state.level));
  tiers.forEach((tier, i) => {
    if(i > 0 && !H.topicMore) return;
    const ts = tier.topics.filter(t => !have.has(tier.id + '/' + t.id));
    if(!ts.length) return;
    box.appendChild(H.el('h3', 'topich', 'מהמאגר: ' + tier.name + (tier.id === H.state.level ? ' · הכיתה שלך' : '')));
    const grid = H.el('div', 'playlist');
    ts.forEach(t => {
      const b = H.el('button', 'gamecard',
        '<span class="gc-e">' + t.e + '</span><b>' + H.esc(t.name) + '</b><small>' + t.words.length + ' מילים</small>');
      b.onclick = () => {
        H.sfx.tap();
        const p = H.addLibPack(tier.id, t.id);
        if(!p) return;
        H.state.pack = p.id; H.syncStats(); H.save();
        H.startPending();
      };
      grid.appendChild(b);
    });
    box.appendChild(grid);
  });
  if(!H.topicMore){
    const more = H.el('button', 'mini', '➕ נושאים של כיתות אחרות');
    more.onclick = () => { H.topicMore = true; H.renderTopic(); };
    box.appendChild(more);
  }
};
