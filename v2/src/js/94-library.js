/* ==========================================================
   ספריית מילים מוכנות, לפי כיתה ונושא.

   המילים כתובות על ידי מודל ולא נבדקו על ידי מורה. שגיאת ניקוד
   בחבילה מוכנה הייתה נלמדת לילד כנכונה, ולכן כל חבילה נכנסת
   כטיוטה: ההורה פותח אותה בעורך הניקוד, רואה כל מילה, ולוחץ
   "אישרתי". עד אז מוצג בשוליים שהמילים לא נבדקו.
   ========================================================== */
H.LIB = [
  {id:'a2', name:'כיתות א׳–ב׳', note:'עם ניקוד', topics:[
    {id:'family', e:'👨‍👩‍👧', name:'משפחה', words:[
      'אִמָּא','אַבָּא','סַבָּא','סַבְתָּא','אָח','אָחוֹת','תִּינוֹק','יֶלֶד',
      'יַלְדָּה','דּוֹד','דּוֹדָה','מִשְׁפָּחָה','בֵּן','בַּת','חָבֵר']},
    {id:'home', e:'🏠', name:'בית', words:[
      'בַּיִת','דֶּלֶת','חַלּוֹן','שֻׁלְחָן','כִּסֵּא','מִטָּה','מִטְבָּח','סָלוֹן',
      'גַּג','קִיר','רִצְפָּה','מַפְתֵּחַ','מַנְעוּל','מִקְלַחַת','מַדָּף']},
    {id:'animals', e:'🐶', name:'חיות', words:[
      'כֶּלֶב','חָתוּל','סוּס','פָּרָה','כֶּבֶשׂ','עֵז','אַרְיֵה','פִּיל',
      'קוֹף','דָּג','צִפּוֹר','צָב','אַרְנָב','דֹּב','נָחָשׁ']},
    {id:'school', e:'🏫', name:'בית ספר', words:[
      'כִּתָּה','מוֹרָה','מוֹרֶה','תַּלְמִיד','תַּלְמִידָה','סֵפֶר','מַחְבֶּרֶת','עִפָּרוֹן',
      'עֵט','מַחֲק','לוּחַ','תִּיק','שִׁעוּר','הַפְסָקָה','צֶבַע']},
    {id:'holidays', e:'🕎', name:'חגים', words:[
      'שׁוֹפָר','תַּפּוּחַ','דְּבַשׁ','סֻכָּה','לוּלָב','אֶתְרוֹג','חֲנֻכִּיָּה','סְבִיבוֹן',
      'סוּפְגָּנִיָּה','מְגִלָּה','פּוּרִים','מַצָּה','הַגָּדָה','שַׁבָּת','נֵר']}
  ]}
];

H.openLibrary = function(){ H.renderLibrary(); H.show('lib'); };

H.renderLibrary = function(){
  const box = H.$('libbody'); box.innerHTML = '';
  const have = new Set(H.state.packs.map(p => p.libId).filter(Boolean));
  H.LIB.forEach(tier => {
    box.appendChild(H.el('h3', '', tier.name + ' · ' + tier.note));
    const grid = H.el('div', 'libgrid');
    tier.topics.forEach(t => {
      const id = tier.id + '/' + t.id, added = have.has(id);
      const el = H.el('div', 'libcard');
      el.innerHTML = '<div class="lib-h"><span class="lib-e">' + t.e + '</span><b>' + t.name + '</b>' +
        '<small>' + t.words.length + ' מילים</small></div>' +
        '<div class="lib-w">' + t.words.slice(0, 5).join(' · ') + ' …</div>';
      const b = H.el('button', 'mini', added ? '✅ כבר ברשימות שלך' : '➕ הוסף לרשימות שלי');
      b.disabled = added;
      b.onclick = () => H.importTopic(tier.id, t.id);
      el.appendChild(b); grid.appendChild(el);
    });
    box.appendChild(grid);
  });
};

H.importTopic = function(tierId, topicId){
  const tier = H.LIB.find(x => x.id === tierId), t = tier && tier.topics.find(x => x.id === topicId);
  if(!t) return;
  if(H.state.packs.length >= 20) return H.toast('יש יותר מדי חבילות. מחק אחת קודם.', 'no');
  const p = H.addPack(t.name, t.words.slice(), H.prize());
  p.draft = true; p.libId = tierId + '/' + topicId;
  H.syncStats(); H.save(); H.refresh();
  H.toast('החבילה נוספה כטיוטה — עבור על הניקוד', 'level');
  H.openNikud();                       /* ישר לבדיקה, לא לשחק */
};

/* ההורה עבר על כל המילים ואישר */
H.approvePack = function(){
  const p = H.pack(); if(!p) return;
  p.draft = false; H.save(); H.refresh(); H.renderNikud();
  H.toast('אושר ✔️', 'good');
};
