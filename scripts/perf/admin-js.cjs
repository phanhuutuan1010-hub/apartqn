/* eslint-disable @typescript-eslint/no-require-imports */
// Perf measurement helper (read-only). Run: node --env-file=.env.local scripts/perf/admin-js.cjs
// Client JS per admin route (first load) from the build's client-reference manifests: entryJSFiles + root main files.
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
  console.log(m.split(path.sep).join('/').replace('.next/server/app', '').replace('/page_client-reference-manifest.js', '').padEnd(40), `${(gz / 1024).toFixed(0)} kB gz`, `(${(raw / 1024).toFixed(0)} kB)`, files.size, 'files');
}
