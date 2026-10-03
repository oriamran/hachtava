/* בונה קובץ HTML יחיד ואופליין מתוך src/ */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root  = dirname(fileURLToPath(import.meta.url));
const src   = join(root, 'src');
const fontB64 = readFileSync(join(root, '..', 'fonts', 'DanaYadAlefAlefAlef-Normal.woff')).toString('base64');

const css = readFileSync(join(src, 'css', 'font.css'), 'utf8').replace('__FONT__', fontB64)
          + '\n' + readFileSync(join(src, 'css', 'app.css'), 'utf8');

const jsFiles = readdirSync(join(src, 'js')).filter(f => f.endsWith('.js')).sort();
const js = jsFiles.map(f => '/* ===== ' + f + ' ===== */\n' + readFileSync(join(src, 'js', f), 'utf8')).join('\n');

const styleTxt  = '\n' + css + '\n';
const scriptTxt = '\n' + js + '\n';
const sha = t => "'sha256-" + createHash('sha256').update(t, 'utf8').digest('base64') + "'";

/* מדיניות אבטחת תוכן. רק הסקריפט והעיצוב שלנו (לפי גיבוב) רשאים לרוץ,
   כך שגם אם טקסט זדוני יתגנב לדף, אי אפשר יהיה להריץ ממנו קוד חיצוני
   או לשלוח נתונים החוצה. הכתובת היחידה שהדף רשאי לפנות אליה היא השרת שלנו.
   מגבלה ידועה: מטא־תג אינו יכול לכלול frame-ancestors, ו-onclick בתוך ה-HTML
   מחייב script-src-attr 'unsafe-inline'. מעבר ל-GitHub Pages אינו מאפשר כותרות. */
const API = 'https://hachtava-ocr.milim1.workers.dev';
const csp = [
  "default-src 'none'",
  "script-src " + sha(scriptTxt) + " https://accounts.google.com/gsi/client",
  "script-src-attr 'unsafe-inline'",
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
  "form-action 'none'"
].join('; ');

const html = readFileSync(join(src, 'index.html'), 'utf8')
  .replace('<!--CSP-->', '<meta http-equiv="Content-Security-Policy" content="' + csp + '">')
  .replace('<!--STYLE-->',  '<style>' + styleTxt + '</style>')
  .replace('<!--SCRIPT-->', '<script>' + scriptTxt + '</script>');

writeFileSync(join(root, 'index.html'), html);
console.log('built v2/index.html  ' + (Buffer.byteLength(html)/1024).toFixed(0) + 'KB  from ' + jsFiles.length + ' js files');
