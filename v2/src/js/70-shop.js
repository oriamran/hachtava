/* ========== חנות: דמויות, כובעים, רקעים ========== */
H.renderShop = function(){
  const mk = (items, kind, cur) => {
    const box = H.$('shop-' + kind); box.innerHTML = '';
    items.forEach(it => {
      const owned = it.cost === 0 || H.owns(it.id);
      const on = H.state[kind] === it.id;
      const el = H.el('button', 'shopitem' + (on ? ' on' : '') + (owned ? '' : ' buyable'));
      const face = (kind === 'ring' || kind === 'bg')
        ? '<span class="' + (kind === 'bg' ? 'bgdot' : 'ringdot') + '" style="background:' + it.css + '"></span>'
        : '<span class="shop-e">' + (it.e || '—') + '</span>';
      el.innerHTML = face + '<b>' + it.name + '</b>' +
        (owned ? (on ? '<small class="tagon">נבחר</small>' : '<small>שלך</small>')
               : '<small class="price">' + it.cost + ' 🪙</small>');
      el.onclick = () => {
        if(!owned){
          if(!H.buy(it.id, it.cost)) return H.sfx.bad(), H.toast('אין מספיק מטבעות', 'no');
          H.sfx.coin(); H.toast('קנית! 🎉', 'good');
        } else H.sfx.tap();
        H.state[kind] = it.id;
        H.save(); H.renderShop(); H.paint();
      };
      box.appendChild(el);
    });
  };
  mk(H.AVATARS, 'avatar');
  mk(H.HATS,    'hat');
  mk(H.RINGS,   'ring');
  mk(H.BGS,     'bg');
  mk(H.PETS,    'pet');
  H.$('shopcoins').textContent = H.state.coins;
};
