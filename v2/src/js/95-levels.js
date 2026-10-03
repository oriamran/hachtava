/* ==========================================================
   התאמה לכיתה. נבחרת במסך הראשי, ומשנה בפועל:
   - ניקוד: כיתות א׳–ב׳ עם ניקוד, מכיתה ג׳ בלי (בטקסט מהחיים אין ניקוד)
   - כמה מילים בסבב
   - כמה זמן יש בערבוביה
   - כמה מהטעויות האפשריות הן אותיות שנשמעות דומה

   הערכים הם נקודת פתיחה סבירה ולא נבדקו מול ילדים. אפשר לשנות
   כל אחד מהם כאן. הניקוד אפשר גם לעקוף ידנית, למי שצריך.
   ========================================================== */
H.LEVELS = [
  {id:'a2', name:'א׳–ב׳', ages:'גילאי 6 עד 8',  nikud:true,  round:4, ana:40, homo:0.40,
   hint:'עם ניקוד, סבבים קצרים והרבה זמן'},
  {id:'d4', name:'ג׳–ד׳', ages:'גילאי 8 עד 10', nikud:false, round:5, ana:30, homo:0.55,
   hint:'בלי ניקוד, ודגש על אותיות שנשמעות דומה'},
  {id:'f6', name:'ה׳–ו׳', ages:'גילאי 10 עד 12', nikud:false, round:6, ana:22, homo:0.75,
   hint:'בלי ניקוד, סבבים ארוכים ופחות זמן'}
];
H.grade     = () => H.LEVELS.find(l => l.id === H.state.level) || H.LEVELS[0];
H.nikudOn   = () => H.state.nikud === 'on' ? true : (H.state.nikud === 'off' ? false : H.grade().nikud);
H.roundSize = () => H.grade().round;

H.setLevel = function(id){
  if(!H.LEVELS.some(l => l.id === id)) return;
  H.state.level = id; H.save(); H.sfx.tap();
  H.refresh();
  H.toast('הותאם לכיתה ' + H.grade().name, 'good');
};
H.cycleNikud = function(){
  const next = {auto:'on', on:'off', off:'auto'};
  H.state.nikud = next[H.state.nikud] || 'auto';
  H.save(); H.sfx.tap(); H.renderLevels();
};

H.renderLevels = function(){
  const box = H.$('lvchips'); if(!box) return;
  box.innerHTML = '';
  H.LEVELS.forEach(l => {
    const b = H.el('button', 'lvchip' + (l.id === H.state.level ? ' on' : ''), l.name + '<small>' + l.ages.replace('גילאי ', '') + '</small>');
    b.onclick = () => H.setLevel(l.id);
    box.appendChild(b);
  });
  const l = H.grade();
  H.$('lvhint').textContent = l.ages + ' · ' + l.hint + ' · ' + l.round + ' מילים בסבב';
  const m = H.state.nikud;
  H.$('tgNikud').textContent = m === 'on' ? 'ניקוד: עם' : m === 'off' ? 'ניקוד: בלי'
                             : 'ניקוד: לפי הכיתה (' + (l.nikud ? 'עם' : 'בלי') + ')';
};
