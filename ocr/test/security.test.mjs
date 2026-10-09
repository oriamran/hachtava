/* בדיקות אבטחה של ה-Worker המלא (נבנה ל-bundle אמיתי עם wrangler --dry-run), מול KV מדומה.
   בודקות את מה שחשוב: שער המקורות, התחברות, הרשאות מנהל, הגבלות דיווח, כותרות ושגיאות. */
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url)), out = mkdtempSync(join(tmpdir(), "wk-"));
execFileSync("npx", ["wrangler", "deploy", "--dry-run", "--outdir", out], { cwd: join(here, ".."), stdio: "ignore" });
const worker = (await import(pathToFileURL(join(out, "worker.js")).href)).default;

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { (cond ? pass++ : fail++); console.log((cond ? "  ✓ " : "  ✗ ") + name + (cond ? "" : "   " + extra)); };
const kv = () => { const m = new Map(); return { get: async k => m.get(k) ?? null, put: async (k, v) => { m.set(k, v); }, delete: async k => { m.delete(k); },
  list: async ({ prefix }) => ({ keys: [...m.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true }), _m: m }; };
const ORIGIN = "https://oriamran.github.io";
const mkEnv = () => ({ ALLOWED_ORIGINS: ORIGIN + ",http://localhost:8788", GOOGLE_CLIENT_ID: "test-client.apps.googleusercontent.com", SCANS_ENABLED: "false",
  ADMIN_EMAILS: "admin@example.com", DATA: kv(), RATE: kv() });
const call = (env, path, init = {}, origin = ORIGIN) => worker.fetch(new Request("https://w.example" + path, { ...init, headers: { ...(origin ? { Origin: origin } : {}), ...(init.headers || {}) } }), env);
let ipN = 0;   /* כל קריאה מכתובת אחרת, כדי שהגבלת הקצב בזיכרון לא תפריע לבדיקות אחרות */
const post = (env, path, body, extra = {}) => call(env, path, { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), headers: { "Content-Type": "application/json", "CF-Connecting-IP": "10.0.0." + (++ipN), ...extra } });
const GOOD_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP4z8CAFTEMLQkA3Qz/EQ0ALVIAAAAASUVORK5CYII=";

console.log("origin gate and CORS");
{ const env = mkEnv();
  let r = await call(env, "/sync", {}, null); ok("no Origin header: 403", r.status === 403);
  r = await call(env, "/sync", {}, "https://evil.example"); ok("foreign origin: 403", r.status === 403);
  ok("foreign origin gets no ACAO", !r.headers.get("Access-Control-Allow-Origin"));
  r = await call(env, "/sync", { method: "OPTIONS" }); ok("allowed origin preflight: 204", r.status === 204);
  ok("ACAO echoes only the allowed origin", r.headers.get("Access-Control-Allow-Origin") === ORIGIN);
  ok("no wildcard", r.headers.get("Access-Control-Allow-Origin") !== "*");
  ok("no credentials header", !r.headers.get("Access-Control-Allow-Credentials")); }

console.log("authentication");
{ const env = mkEnv();
  for (const [p, m] of [["/sync", "GET"], ["/sync", "POST"], ["/sync", "DELETE"], ["/admin", "GET"], ["/admin/reports", "GET"], ["/admin/reports", "POST"]]) {
    let r = await call(env, p, { method: m, body: m === "POST" ? "{}" : undefined }); ok(`${m} ${p} without token: 401`, r.status === 401, String(r.status));
    r = await call(env, p, { method: m, body: m === "POST" ? "{}" : undefined, headers: { Authorization: "Bearer aaa.bbb.ccc" } }); ok(`${m} ${p} with a forged token: 401`, r.status === 401, String(r.status));
    r = await call(env, p, { method: m, body: m === "POST" ? "{}" : undefined, headers: { Authorization: "Bearer " + btoa('{"alg":"none"}') + "." + btoa('{"sub":"x","aud":"test-client.apps.googleusercontent.com","exp":9999999999,"iss":"accounts.google.com"}') + "." } });
    ok(`${m} ${p} with an alg=none token: 401`, r.status === 401, String(r.status)); } }

console.log("reports");
{ const env = mkEnv();
  let r = await call(env, "/report"); ok("GET /report: 405", r.status === 405);
  r = await post(env, "/report", { text: "ab" }); ok("too short: 400", r.status === 400);
  r = await post(env, "/report", "not json"); ok("bad json: 400", r.status === 400);
  r = await post(env, "/report", { text: "x".repeat(400_000) }); ok("oversized body: 413", r.status === 413);
  r = await post(env, "/report", { text: "בדיקה תקינה", img: GOOD_PNG }); const d = await r.json();
  ok("valid report with image: 200", r.status === 200 && /^\d{13}-/.test(d.id));
  ok("image stored separately", [...env.DATA._m.keys()].some(k => k.startsWith("ri:")));
  const env2 = mkEnv();
  await post(env2, "/report", { text: "בדיקה תקינה", img: "data:image/png;base64,PGh0bWw+PHNjcmlwdD4=" });
  ok("html disguised as png is dropped", ![...env2.DATA._m.keys()].some(k => k.startsWith("ri:")));
  await post(env2, "/report", { text: "בדיקה תקינה", img: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=" });
  ok("svg is dropped", ![...env2.DATA._m.keys()].some(k => k.startsWith("ri:")));
  const env3 = mkEnv(); const day = new Date().toISOString().slice(0, 10);
  await env3.RATE.put("rep:" + day, "120");
  r = await post(env3, "/report", { text: "בדיקה תקינה" }); ok("daily cap: 429", r.status === 429);
  const env4 = mkEnv(); await env4.RATE.put("repimg:" + day, "30");
  await post(env4, "/report", { text: "בדיקה תקינה", img: GOOD_PNG });
  ok("image cap: report kept, image dropped", [...env4.DATA._m.keys()].some(k => k.startsWith("r:")) && ![...env4.DATA._m.keys()].some(k => k.startsWith("ri:")));
  const inj = mkEnv(); r = await post(inj, "/report", { text: "<img src=x onerror=alert(1)>", ctx: { snap: "<script>1</script>" } });
  ok("script text is stored as data and returns 200 (escaped at display)", r.status === 200); }

console.log("per-IP limit");
{ const env = mkEnv(); let last = 0; for(let i = 0; i < 8; i++){ const r = await call(env, "/report", { method: "POST", body: JSON.stringify({ text: "בדיקה תקינה " + i }), headers: { "CF-Connecting-IP": "9.9.9.9", "Content-Type": "application/json" } }); last = r.status; }
  ok("the 8th report from one IP in an hour is refused (429)", last === 429, String(last)); }

console.log("headers, routes and errors");
{ const env = mkEnv();
  let r = await call(env, "/nope"); ok("unknown path: 404", r.status === 404);
  ok("nosniff", r.headers.get("X-Content-Type-Options") === "nosniff");
  ok("HSTS", /max-age=\d+/.test(r.headers.get("Strict-Transport-Security") || ""));
  ok("locked-down CSP", (r.headers.get("Content-Security-Policy") || "").includes("default-src 'none'"));
  ok("no-store", r.headers.get("Cache-Control") === "no-store");
  r = await post(env, "/", { image: "x", deviceId: "abcdef12-3456" }); ok("scan is disabled (not 200)", r.status !== 200, String(r.status));
  const bad = mkEnv(); bad.RATE.get = async () => { throw new Error("secret internal stack detail"); };
  r = await post(bad, "/report", { text: "בדיקה תקינה" }); const t = await r.text();
  ok("unexpected failure: 500, generic body", r.status === 500 && t === '{"error":"server error"}', t);
  ok("no internal detail leaked", !/secret|stack|\bat \w/.test(t)); }

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
