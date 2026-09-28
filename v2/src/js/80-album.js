/* ========== אלבום: מדבקה לכל מילה שנכבשה ========== */
H.STICKERS = ['🍎','🍌','🍇','🍓','🍉','🥝','🍑','🍍',
              '⭐','🌈','🚀','🎈','🎁','💎','🎯','🎨'];
H.renderAlbum = function(){
  const box = H.$('albumlist'); box.innerHTML = '';
  H.words().forEach((w, i) => {
    const s = H.state.stats[w] || {run:0};
    const got = s.run >= H.MASTER_AT;
    const el = H.el('div', 'sticker' + (got ? ' got' : ''));
    el.innerHTML = '<span class="stk-e">' + (got ? H.STICKERS[i % H.STICKERS.length] : '❓') + '</span>' +
                   '<span class="stk-w">' + w + '</span>' +
                   '<span class="stk-p">' + '⭐'.repeat(Math.min(s.run, H.MASTER_AT)) +
                   '☆'.repeat(Math.max(0, H.MASTER_AT - s.run)) + '</span>';
    el.onclick = () => H.speak(w);
    box.appendChild(el);
  });
  const done = H.mastered(), all = H.words().length;
  H.$('albumcount').textContent = done + ' / ' + all;
  const pb = H.$('albumfill');
  pb.style.width = Math.round(100 * done / Math.max(1, all)) + '%';
  H.$('prizestate').innerHTML = done >= all
    ? '🎁 <b>הפרס שלך:</b> ' + H.prize()
    : '🎁 יש פרס מסתור כשתכבוש את כל המילים';
};
