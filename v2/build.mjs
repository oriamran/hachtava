/* בונה קובץ HTML יחיד ואופליין מתוך src/ */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root  = dirname(fileURLToPath(import.meta.url));
const src   = join(root, 'src');
const fontB64 = readFileSync(join(root, '..', 'fonts', 'DanaYadAlefAlefAlef-Normal.woff')).toString('base64');

const css = readFileSync(join(src, 'css', 'font.css'), 'utf8').replace('__FONT__', fontB64)
          + '\n' + readFileSync(join(src, 'css', 'app.css'), 'utf8');

const jsFiles = readdirSync(join(src, 'js')).filter(f => f.endsWith('.js')).sort();
let stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
try{ stamp += ' ' + execSync('git rev-parse --short HEAD', {cwd: root, stdio: ['ignore', 'pipe', 'ignore']}).toString().trim(); }catch(e){}
const js = jsFiles.map(f => '/* ===== ' + f + ' ===== */\n' + readFileSync(join(src, 'js', f), 'utf8')).join('\n').replace('__BUILD__', stamp);

const styleTxt  = '\n' + css + '\n';
const scriptTxt = '\n' + js + '\n';
const sha = t => "'sha256-" + createHash('sha256').update(t, 'utf8').digest('base64') + "'";

/* מדיניות אבטחת תוכן. רק הסקריפט והעיצוב שלנו (לפי גיבוב) רשאים לרוץ,
   כך שגם אם טקסט זדוני יתגנב לדף, אי אפשר יהיה להריץ ממנו קוד חיצוני
   או לשלוח נתונים החוצה. הכתובת היחידה שהדף רשאי לפנות אליה היא השרת שלנו.
   אין קוד מוטמע בתכונות HTML (onclick וכו'), ולכן script-src-attr 'none'.
   מגבלה ידועה: מטא־תג אינו יכול לכלול frame-ancestors. מעבר ל-GitHub Pages אינו מאפשר כותרות. */
const API = 'https://hachtava-ocr.milim1.workers.dev';
const csp = [
  "default-src 'none'",
  "script-src " + sha(scriptTxt) + " https://accounts.google.com/gsi/client",
  "script-src-attr 'none'",
  /* הגיבוב השני הוא בלוק העיצוב שגוגל מזריקה לדף בעצמה כשהכפתור נטען.
     אם גוגל תשנה אותו, הכפתור עדיין יופיע, רק בלי העיצוב הזה — בדוק בקונסול. */
  "style-src " + sha(styleTxt) + " 'sha256-bPYX3s9ZtkBLGfQigE2LegGDbGe5nQ/S37hvxd2mbUk=' https://accounts.google.com/gsi/style",
  "style-src-attr 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src data:",
  "connect-src 'self' " + API + " https://accounts.google.com/gsi/",
  "frame-src https://accounts.google.com/gsi/",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "upgrade-insecure-requests"
].join('; ');

/* בדיקת אבטחה בזמן בנייה: אם מישהו מוסיף דפוס מסוכן, הבנייה נכשלת ולא נפרסת.
   אלה בדיוק הדברים שה-CSP כבר חוסם או שמרחיבים את משטח התקיפה. */
{
  const htmlSrc = readFileSync(join(src, 'index.html'), 'utf8');
  const BAD = [
    [/\son(click|change|input|submit|error|load|focus|blur|key\w+|mouse\w+|touch\w+)\s*=/i, 'מאזין אירועים בתוך HTML (השתמש ב-data-act)'],
    [/javascript:/i, 'כתובת javascript:'],
    [/\beval\s*\(/, 'eval'],
    [/new\s+Function\s*\(/, 'new Function'],
    [/document\.write\s*\(/, 'document.write'],
    [/\.outerHTML\s*=/, 'השמה ל-outerHTML'],
    [/insertAdjacentHTML/, 'insertAdjacentHTML (השתמש ב-H.el או בקידוד עם H.esc)'],
    [/<script[^>]*\ssrc=["']http:\/\//i, 'סקריפט ב-http'],
    [/target=["']_blank["'](?![^>]*rel=["'][^"']*noopener)/i, 'target=_blank בלי rel=noopener'],
    [/\bsrc=["']http:\/\//i, 'משאב ב-http לא מאובטח']
  ];
  const problems = [];
  const scan = (name, text) => text.split('\n').forEach((line, i) => BAD.forEach(([re, why]) => { if(re.test(line)) problems.push(name + ':' + (i + 1) + '  ' + why); }));
  scan('src/index.html', htmlSrc);
  jsFiles.forEach(f => { if(!/^98[c-d]?-/.test(f) && f !== '98-models.js') scan('src/js/' + f, readFileSync(join(src, 'js', f), 'utf8')); });
  if(!csp.includes("script-src-attr 'none'") || /script-src[^;]*unsafe-inline/.test(csp) || /script-src[^;]*unsafe-eval/.test(csp)) problems.push('ה-CSP הוחלש');
  if(problems.length){ console.error('בדיקת אבטחה נכשלה:\n  ' + problems.join('\n  ')); process.exit(1); }
}

const html = readFileSync(join(src, 'index.html'), 'utf8')
  .replace('<!--CSP-->', '<meta http-equiv="Content-Security-Policy" content="' + csp + '">')
  .replace('<!--STYLE-->',  '<style>' + styleTxt + '</style>')
  .replace('<!--SCRIPT-->', '<script>' + scriptTxt + '</script>');

writeFileSync(join(root, 'index.html'), html);
console.log('built v2/index.html  ' + (Buffer.byteLength(html)/1024).toFixed(0) + 'KB  from ' + jsFiles.length + ' js files');
