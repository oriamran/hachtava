import { sanitizeState, summarize, saveState, loadState, deleteState, adminList } from "../src/sync.ts";
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { (cond ? pass++ : fail++); console.log((cond ? "  ✓ " : "  ✗ ") + name + (cond ? "" : "   " + extra)); };

/* a tiny in-memory KV with the same surface the code uses */
const kv = () => { const m = new Map(); return {
  get: async k => m.get(k) ?? null, put: async (k, v) => { m.set(k, v); }, delete: async k => { m.delete(k); },
  list: async ({ prefix }) => ({ keys: [...m.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true }),
  _m: m }; };
const user = (n) => ({ sub: "u" + n, email: `p${n}@x.com`, emailVerified: true });

console.log("sanitizeState");
ok("rejects non-objects", sanitizeState(null) === null && sanitizeState([]) === null && sanitizeState("x") === null);
const dirty = JSON.parse(`{"xp":-50,"coins":1e99,"name":"${"ש".repeat(500)}","evil":"<script>","__proto__":{"polluted":1},
  "stats":{"__proto__":{"ok":9},"constructor":{"ok":9},"שלום":{"ok":"nope","bad":5,"run":1e12}},
  "packs":[{"id":"p1","topic":"t","list":["a","b",7,null,{"x":1}],"prize":"p"}],
  "stars":{"0":99,"__proto__":3},"album":["a",5,null],"daily":{"streak":-4}}`);
const c = sanitizeState(dirty);
ok("drops unknown keys", !("evil" in c));
ok("clamps negatives and huge numbers", c.xp === 0 && c.coins === 10_000_000, JSON.stringify([c.xp, c.coins]));
ok("truncates long strings", c.name.length === 30);
ok("keeps only strings in lists", JSON.stringify(c.packs[0].list) === '["a","b"]');
ok("no prototype pollution", ({}).polluted === undefined && !Object.keys(c.stats).includes("__proto__") && !Object.keys(c.stats).includes("constructor"));
ok("clamps nested numbers", c.stats["שלום"].run === 1_000_000 && c.stats["שלום"].ok === 0);
ok("clamps stars to 0..3", c.stars["0"] === 3);
ok("album only strings", JSON.stringify(c.album) === '["a"]');
ok("negative streak -> 0", c.daily.streak === 0);
const big = { packs: [{ id: "x", list: Array(100000).fill("w") }], stats: Object.fromEntries(Array.from({ length: 9000 }, (_, i) => ["w" + i, { ok: 1 }])) };
const cb = sanitizeState(big);
ok("caps list sizes", cb.packs[0].list.length === 200 && Object.keys(cb.stats).length === 2000);

console.log("saveState / load / delete / admin");
const env = { DATA: kv() };
const st = { xp: 500, packs: [{ id: "p1", list: ["a", "b", "c"] }], pack: "p1", stats: { a: { run: 3 }, b: { run: 1 } }, album: [], daily: { streak: 4 }, stars: { 0: 3, 1: 2 }, usage: { first: 1000, last: 2000, visits: 7, activeSec: 1800 } };
let r = await saveState(env.DATA ? env : env, user(1), st, 100);
ok("first save works", r.ok === true && !r.skipped, JSON.stringify(r));
r = await saveState(env, user(1), { ...st, xp: 600 }, 200);
ok("a second save within 15s is skipped, not written", r.ok && r.skipped === true);
const loaded = await loadState(env, user(1));
ok("skipped write did not overwrite", loaded.state.xp === 500, String(loaded.state.xp));
env.DATA._m.set("s:u1", JSON.stringify({ ...JSON.parse(env.DATA._m.get("s:u1")), serverAt: Date.now() - 60000 }));
r = await saveState(env, user(1), { ...st, xp: 600 }, 50);
ok("an older copy is refused (stale)", r.ok === false && r.stale === true);
r = await saveState(env, user(1), { ...st, xp: 600 }, 300);
ok("a newer copy after the gap is written", r.ok === true && !r.skipped);
ok("invalid payload refused", (await saveState(env, user(2), "garbage", 1)).invalid === true);
await saveState(env, user(2), { ...st, xp: 1300, usage: { first: 1, last: 5000, visits: 2, activeSec: 60 } }, 10);
const sm = summarize(user(1), sanitizeState(st));
ok("summary: mastered 1/3, level 5, 7 visits, 30 min", sm.earned === 1 && sm.words === 3 && sm.level === 5 && sm.visits === 7 && sm.sec === 1800, JSON.stringify(sm));
ok("summary holds email and no child name", sm.email === "p1@x.com" && !("name" in sm));
const adm = await adminList(env);
ok("admin: 2 registered, most recent first", adm.total === 2 && adm.users[0].email === "p2@x.com", JSON.stringify(adm.users.map(u => u.email)));
await deleteState(env, user(1));
ok("delete removes the account's data", (await loadState(env, user(1))).state === null && (await adminList(env)).total === 1);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
