/* ==========================================================
   עברית: אשכולות אות+ניקוד, ניקוי ניקוד, ערבוב
   ========================================================== */
H.NIK = /[֑-ׇ]/;
H.HEB = "אבגדהוזחטיכלמנסעפצקרשת";
/* תנועות חוקיות בלבד — בלי דגש ובלי נקודת שין, שלא ייווצר ניקוד שלא קיים */
H.VOW = "ְִֵֶַָֹֻ";

/* "יוֹם" -> ["י","וֹ","ם"] — האות והניקוד שלה נשארים יחידה אחת */
H.clusters = function(w){
  const out = [];
  for(const ch of w){
    if(H.NIK.test(ch) && out.length) out[out.length-1] += ch;
    else out.push(ch);
  }
  return out;
};
H.strip = w => w.replace(/[֑-ׇ]/g, '');

/* אריח הסחה: אות אקראית עם תנועה חוקית */
H.randTile = function(withNikud){
  let b = H.HEB[Math.floor(Math.random()*H.HEB.length)];
  if(b === "ש") b += "ׁ";
  return withNikud ? b + H.VOW[Math.floor(Math.random()*H.VOW.length)] : b;
};
H.shuffle = function(a){
  a = a.slice();
  for(let i = a.length-1; i > 0; i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
/* גרסה של המילה עם אותיות חסרות, לשימוש כשאין קול עברי */
H.masked = w => H.clusters(w).map((c,i) => c === ' ' ? ' ' : (i%2 ? '_' : c)).join('');
