/* ========== מסך הורה: רשימת מילים, פרס, שם ========== */
H.NIKPAD = [
  ["ְ","שווא"],["ַ","פתח"],["ָ","קמץ"],
  ["ֵ","צירה"],["ֶ","סגול"],["ִ","חיריק"],
  ["ֹ","חולם"],["ֻ","קבוץ"],["ּ","דגש"],
  ["ׁ","שין"],["ׂ","שין שמאלית"],
  ["ֱ","חטף סגול"],["ֲ","חטף פתח"],["ֳ","חטף קמץ"],
  ["ֺ","חולם חסר"],["ׇ","קמץ קטן"],["ֿ","רפה"]
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
  H.$('peekIn').checked = !!H.state.peekAlways; H.$('hideIn').checked = !!H.state.hideWord;
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
  H.renderQuota();
  H.renderAccount();
  H.renderTimeBox();
  H.show('settings');
};
/* המילים שבתיבה, נקיות ובלי מספור */
H.readWordsIn = () => H.$('wordsIn').value.split('\n')
  .map(x => H.cleanText(x.replace(/^\s*\d+[.)\.\s]\s*/, '').trim(), 60))
  .filter(x => x.length);
H.applySettings = function(){
  const list = H.readWordsIn();
  if(list.length < 2) return alert('צריך לפחות שתי מילים');
  H.state.name = H.cleanText(H.$('nameIn').value.trim(), 30);
  H.state.peekAlways = H.$('peekIn').checked; H.state.hideWord = H.$('hideIn').checked;
  const p = H.pack();
  p.topic = H.cleanText(H.$('topicIn').value.trim(), 80) || 'הכתבה';
  p.prize = H.cleanText(H.$('prizeIn').value.trim(), 80);
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
/* שתי אפשרויות ברורות: כתב או דפוס. הכפתור הפעיל מודגש. הבחירה נשמרת במכשיר. */
H.setScript = function(mode){
  const dfus = mode === 'dfus';
  document.body.classList.toggle('dfus', dfus);
  const k = H.$('ktbtn'), d = H.$('dfbtn');
  if(k) k.classList.toggle('on', !dfus);
  if(d) d.classList.toggle('on', dfus);
  try{ localStorage.setItem('hachtava_script', dfus ? 'dfus' : 'ktav'); }catch(e){}
};
H.scriptNow = () => document.body.classList.contains('dfus') ? 'dfus' : 'ktav';
H.toggleScript = function(){
  H.setScript(H.scriptNow() === 'dfus' ? 'ktav' : 'dfus');
};
