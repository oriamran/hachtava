/* בונה קובץ HTML יחיד ואופליין מתוך src/ */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root  = dirname(fileURLToPath(import.meta.url));
const src   = join(root, 'src');
const fontB64 = readFileSync(join(root, '..', 'fonts', 'DanaYadAlefAlefAlef-Normal.woff')).toString('base64');

const css = readFileSync(join(src, 'css', 'font.css'), 'utf8').replace('__FONT__', fontB64)
          + '\n' + readFileSync(join(src, 'css', 'app.css'), 'utf8');

const jsFiles = readdirSync(join(src, 'js')).filter(f => f.endsWith('.js')).sort();
const js = jsFiles.map(f => '/* ===== ' + f + ' ===== */\n' + readFileSync(join(src, 'js', f), 'utf8')).join('\n');

const html = readFileSync(join(src, 'index.html'), 'utf8')
  .replace('<!--STYLE-->',  '<style>\n' + css + '\n</style>')
  .replace('<!--SCRIPT-->', '<script>\n' + js + '\n</script>');

writeFileSync(join(root, 'index.html'), html);
console.log('built v2/index.html  ' + (Buffer.byteLength(html)/1024).toFixed(0) + 'KB  from ' + jsFiles.length + ' js files');
