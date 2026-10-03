/* ==========================================================
   גיבוי ושחזור. ההתקנה ואחסון קבוע מטפלים ברוב המקרים,
   אבל ניקוי ידני של ההיסטוריה או מעבר למכשיר חדש מוחקים הכול,
   כולל פרופיל כתב היד שנבנה לאורך שבועות. זו רשת הביטחון.
   ========================================================== */
H.B64 = {
  enc: u => btoa(String.fromCharCode.apply(null, u)),
  dec: s => Uint8Array.from(atob(s), c => c.charCodeAt(0))
};
H.hasGzip = typeof CompressionStream !== 'undefined';

H.packCode = async function(obj){
  const json = JSON.stringify(obj);
  if(!H.hasGzip) return 'R.' + H.B64.enc(new TextEncoder().encode(json));
  const buf = await new Response(
    new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'))
  ).arrayBuffer();
  return 'Z.' + H.B64.enc(new Uint8Array(buf));
};
H.unpackCode = async function(code){
  code = (code || '').trim().replace(/\s+/g, '');
  const raw = code.startsWith('R.');
  const zip = code.startsWith('Z.');
  if(!raw && !zip) throw new Error('bad');
  const bytes = H.B64.dec(code.slice(2));
  if(raw) return JSON.parse(new TextDecoder().decode(bytes));
  const buf = await new Response(
    new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
  ).arrayBuffer();
  return JSON.parse(new TextDecoder().decode(buf));
};

/* קוד מלא — כולל פרופיל כתב היד */
H.exportAll = async function(){
  const code = await H.packCode(H.state);
  H.$('backupOut').value = code;
  H.$('backupOut').style.display = '';
  H.$('backupInfo').textContent =
    'העתק ושמור במקום בטוח · ' + code.length + ' תווים';
  H.$('backupOut').select();
};
/* קוד קצר להעברה למכשיר אחר — הכול חוץ מפרופיל כתב היד */
H.exportLight = async function(){
  const light = Object.assign({}, H.state); delete light.hand;
  const code = await H.packCode(light);
  H.$('backupOut').value = code;
  H.$('backupOut').style.display = '';
  H.$('backupInfo').textContent =
    'קוד העברה קצר, בלי פרופיל הכתב · ' + code.length + ' תווים';
  H.$('backupOut').select();
};
H.copyBackup = async function(){
  const t = H.$('backupOut');
  if(!t.value) return;
  try{ await navigator.clipboard.writeText(t.value); H.toast('הועתק ✔️', 'good'); }
  catch(e){ t.select(); document.execCommand && document.execCommand('copy'); H.toast('הועתק ✔️', 'good'); }
};
H.downloadBackup = async function(){
  const code = H.$('backupOut').value || await H.packCode(H.state);
  const name = 'hachtava-' + new Date().toISOString().slice(0,10) + '.txt';
  const url = URL.createObjectURL(new Blob([code], {type:'text/plain'}));
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click();
  a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
};
H.importBackup = async function(){
  const code = H.$('backupIn').value;
  if(!code.trim()) return;
  let data;
  try{ data = await H.unpackCode(code); }
  catch(e){ return alert('הקוד לא תקין'); }
  if(!data || !Array.isArray(data.packs))
    return alert('הקוד לא מכיל נתוני משחק');
  if(!confirm('להחליף את כל הנתונים במכשיר הזה?')) return;
  const keepHand = H.state.hand;           /* קוד קצר לא מוחק פרופיל קיים */
  H.state = H.cleanState(data);
  if(!data.hand && keepHand) H.state.hand = keepHand;
  H.syncStats(); H.save();
  H.toast('שוחזר ✔️', 'good');
  H.refresh(); H.home();
};
H.resetHand = function(){
  const hs = H.handStats();
  if(!hs.samples) return alert('עדיין אין פרופיל כתב');
  if(!confirm('למחוק את פרופיל כתב היד? (' + hs.samples + ' דגימות)')) return;
  H.state.hand = {}; H.save(); H.renderReport();
  H.toast('הפרופיל נמחק', 'no');
};
