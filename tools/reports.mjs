#!/usr/bin/env node
/* קורא דיווחי בעיות מהשרת (KV) ומדפיס אותם. דורש wrangler מחובר (npx wrangler login).
   שימוש:  node tools/reports.mjs            כל החדשים
           node tools/reports.mjs --all      כולל מטופלים
           node tools/reports.mjs --done ID  מסמן כמטופל
           node tools/reports.mjs --img ID   שומר את התמונה המצורפת בקובץ
           node tools/reports.mjs --delete ID מוחק */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const cwd = join(dirname(fileURLToPath(import.meta.url)), '..', 'ocr');
const NS = 'e858ccd79f9140868096a85bb385cbb7';          /* DATA ב-wrangler.toml */
const wr = (...a) => execFileSync('npx', ['wrangler', ...a, '--namespace-id', NS, '--remote'], {cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
const args = process.argv.slice(2);
const flag = f => args.indexOf(f), val = f => args[args.indexOf(f) + 1];
if(flag('--img') >= 0){
  const id = val('--img'), out = join(dirname(fileURLToPath(import.meta.url)), 'report-' + id + '.jpg');
  const d = wr('kv', 'key', 'get', 'ri:' + id).trim(), m = d.match(/^data:image\/(\w+);base64,(.+)$/);
  if(!m){ console.log('אין תמונה'); process.exit(1); }
  writeFileSync(out, Buffer.from(m[2], 'base64')); console.log(out); process.exit(0);
}
if(flag('--done') >= 0 || flag('--delete') >= 0){
  const del = flag('--delete') >= 0, id = val(del ? '--delete' : '--done'), key = 'r:' + id;
  if(del){ wr('kv', 'key', 'delete', key); console.log('נמחק', id); }
  else { const r = JSON.parse(wr('kv', 'key', 'get', key)); r.status = 'done'; execFileSync('npx', ['wrangler', 'kv', 'key', 'put', key, JSON.stringify(r), '--namespace-id', NS, '--remote', '--ttl', String(60 * 86400)], {cwd}); console.log('סומן כמטופל', id); }
  process.exit(0);
}
const keys = JSON.parse(wr('kv', 'key', 'list', '--prefix', 'r:')).map(k => k.name).sort().reverse();
let shown = 0;
for(const k of keys){
  let r; try{ r = JSON.parse(wr('kv', 'key', 'get', k)); }catch(e){ continue; }
  if(r.status === 'done' && flag('--all') < 0) continue;
  const c = r.ctx || {}; shown++;
  console.log('─'.repeat(60));
  console.log(`${r.id}  ${new Date(r.at).toLocaleString('he-IL')}  [${r.kind}] ${r.status}`);
  console.log(r.text);
  console.log(`מסך: ${c.screen}${c.game ? ' / ' + c.game : ''}  כיתה: ${c.level}  כתב: ${c.script}  נושא: ${c.topic} (${c.words})  גרסה: ${c.build}`);
  console.log(`מכשיר: ${(c.ua || '').slice(0, 120)}  ${c.vw}x${c.vh}@${c.dpr}  ${c.online ? 'מחובר' : 'לא מחובר'}`);
  if(c.extra) console.log('נוסף:', JSON.stringify(c.extra));
  if(c.errs && c.errs.length) console.log('שגיאות:\n  ' + c.errs.join('\n  '));
  if(c.snap) console.log('על המסך:', c.snap.slice(0, 400));
  if(r.email) console.log('קשר:', r.email);
  if(r.hasImg) console.log('תמונה מצורפת: node tools/reports.mjs --img ' + r.id);
}
console.log('─'.repeat(60)); console.log(shown ? shown + ' דיווחים' : 'אין דיווחים חדשים');
