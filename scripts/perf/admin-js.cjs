/* eslint-disable @typescript-eslint/no-require-imports */
// Perf measurement helper (read-only). Run: node --env-file=.env.local scripts/perf/admin-js.cjs
// Client JS per admin route from the build's client-reference manifests: route chunks (entryJSFiles) and total first load (+ root main files).
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const root = '.next/server/app/admin';
const routes = [];
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
  const p = path.join(d, e.name);
  if (e.isDirectory()) walk(p); else if (e.name === 'page_client-reference-manifest.js') routes.push(p);
});
walk(root);
const sizeOf = (f) => { const b = fs.readFileSync(path.join('.next', f)); return [b.length, zlib.gzipSync(b).length]; };
for (const m of routes.sort()) {
  globalThis.__RSC_MANIFEST = {};
  eval(fs.readFileSync(m, 'utf8'));
  const man = Object.values(globalThis.__RSC_MANIFEST)[0];
  const files = new Set();
  Object.values(man.entryJSFiles ?? {}).forEach((l) => l.forEach((f) => files.add(f)));
  let raw = 0, gz = 0;
  files.forEach((f) => { const [r, g] = sizeOf(f); raw += r; gz += g; });
  // + framework / runtime chunks every page loads (rootMainFiles) = total first-load JS
  const bm = path.join(path.dirname(m), 'page', 'build-manifest.json');
  let total = gz;
  if (fs.existsSync(bm)) {
    const all = new Set([...files, ...JSON.parse(fs.readFileSync(bm, 'utf8')).rootMainFiles]);
    total = 0;
    all.forEach((f) => (total += sizeOf(f)[1]));
  }
  console.log(m.split(path.sep).join('/').replace('.next/server/app', '').replace('/page_client-reference-manifest.js', '').padEnd(40), `${(gz / 1024).toFixed(0)} kB gz route`, `(${(raw / 1024).toFixed(0)} kB raw)`, `· first load ${(total / 1024).toFixed(0)} kB gz`, files.size, 'files');
}
