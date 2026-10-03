/* ========== 3. שמע ובחר את הכתיב הנכון ========== */
H.game({
  id:'pick', e:'👂', name:'שמע ובחר',
  desc:'איזו כתיבה נכונה?',
  start(){ H.show('pick'); this.next(); },
  next(){
    const w = H.nextWord();
    if(!w) return H.endRound();
    const opts = H.shuffle([w].concat(H.variants(w, 2)));
    const box = H.$('pickopts'); box.innerHTML = '';
    opts.forEach(o => {
      const b = H.el('button', 'bigword', o);
      b.onclick = () => this.choose(b, o === w);
      box.appendChild(b);
    });
    H.$('pickfb').textContent = '';
    setTimeout(() => H.say(w), 300);
  },
  choose(btn, ok){
    if(H.run.picked) return;
    H.run.picked = true;
    if(ok){
      H.right(); btn.classList.add('right');
      H.$('pickfb').innerHTML = '<span class="ok">🎉 נכון!</span>';
    } else {
      H.wrong(); btn.classList.add('wrongpick');
      [...H.$('pickopts').children].forEach(b => { if(b.textContent === H.run.word) b.classList.add('right'); });
      H.$('pickfb').innerHTML = '<span class="no">זו הנכונה 👆</span><div id="pickseg" class="segbox"></div>';
      H.run.cancelSeg = H.segmentShow(H.run.word, H.$('pickseg'));
    }
    setTimeout(() => { if(H.run.cancelSeg) H.run.cancelSeg(); H.run.picked = false; this.next(); }, ok ? 850 : H.segmentMs(H.run.word) + 1200);
  }
});
