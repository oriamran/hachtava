/* ========== מסך הורה: רשימת מילים, פרס, שם ========== */
H.NIKPAD = [
  ["ְ","שווא"],["ַ","פתח"],["ָ","קמץ"],
  ["ֵ","צירה"],["ֶ","סגול"],["ִ","חיריק"],
  ["ֹ","חולם"],["ֻ","קבוץ"],["ּ","דגש"],
  ["ׁ","שין"],["ׂ","שין שמאלית"]
];
H.renderPacks = function(){
  const box = H.$('packlist'); box.innerHTML = '';
  H.state.packs.forEach(p => {
    const el = H.el('button', 'packchip' + (p.id === H.state.pack ? ' on' : ''),
      p.topic + ' <small>' + p.list.length + '</small>');
    el.onclick = () => { H.state.pack = p.id; H.syncStats(); H.save(); H.openSettings(); };
    box.appendChild(el);
  });
  const add = H.el('button', 'packchip add', '\u2795 \u05d7\u05d1\u05d9\u05dc\u05d4');
  add.onclick = () => {
    H.addPack('', [], H.prize());
    H.syncStats(); H.openSettings();
  };
  box.appendChild(add);
};
H.removePack = function(){
  const p = H.pack();
  if(H.state.packs.length < 2)
    return alert('\u05e6\u05e8\u05d9\u05db\u05d4 \u05dc\u05d4\u05d9\u05e9\u05d0\u05e8 \u05dc\u05e4\u05d7\u05d5\u05ea \u05d7\u05d1\u05d9\u05dc\u05d4 \u05d0\u05d7\u05ea');
  if(!confirm('\u05dc\u05de\u05d7\u05d5\u05e7 \u05d0\u05ea "' + p.topic + '"?')) return;
  H.delPack(p.id); H.openSettings();
};
H.openSettings = function(){
  const p = H.pack();
  H.renderPacks();
  H.$('nameIn').value  = H.state.name || '';
  H.$('peekIn').checked = !!H.state.peekAlways;
  H.$('topicIn').value = p.topic || '';
  H.$('prizeIn').value = p.prize || '';
  H.$('wordsIn').value = p.list.join('\n');
  const pad = H.$('nikpad'); pad.innerHTML = '';
  H.NIKPAD.forEach(([m, n]) => {
    const b = H.el('button', 'nikbtn', 'א' + m + '<small>' + n + '</small>');
    b.onclick = () => {
      const ta = H.$('wordsIn'), i = ta.selectionStart;
      ta.value = ta.value.slice(0, i) + m + ta.value.slice(ta.selectionEnd);
      ta.focus(); ta.selectionStart = ta.selectionEnd = i + m.length;
    };
    pad.appendChild(b);
  });
  H.renderPhoto();
  H.renderOcr();
  H.show('settings');
};
H.applySettings = function(){
  const list = H.$('wordsIn').value.split('\n')
    .map(x => x.replace(/^\s*\d+[.)\.\s]\s*/, '').trim())
    .filter(x => x.length);
  if(list.length < 2) return alert('צריך לפחות שתי מילים');
  H.state.name = H.$('nameIn').value.trim();
  H.state.peekAlways = H.$('peekIn').checked;
  const p = H.pack();
  p.topic = H.$('topicIn').value.trim() || 'הכתבה';
  p.prize = H.$('prizeIn').value.trim();
  p.list  = list;
  H.syncStats(); H.save();
  H.toast('נשמר ✔️', 'good');
  H.refresh(); H.home();
};
H.resetWords = function(){
  if(!confirm('להחזיר את מילות חגי תשרי?')) return;
  const p = H.pack();
  p.topic = H.DEFAULT_TOPIC; p.list = H.DEFAULT_WORDS.slice();
  H.syncStats(); H.save(); H.openSettings();
};
H.toggleScript = function(){
  const dfus = document.body.classList.toggle('dfus');
  H.$('ktbtn').textContent = dfus ? 'דפוס 🔤' : 'כתב ✏️';
  try{ localStorage.setItem('hachtava_script', dfus ? 'dfus' : 'ktav'); }catch(e){}
};
