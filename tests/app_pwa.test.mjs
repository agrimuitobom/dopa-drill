// PWA: the manifest is valid and the service worker caches every game file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const APP = new URL('../app/', import.meta.url).pathname;
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });

test('manifest has the fields needed to install', () => {
  const m = JSON.parse(readFileSync(join(APP, 'manifest.webmanifest'), 'utf8'));
  for (const k of ['name', 'short_name', 'start_url', 'display', 'icons']) assert.ok(m[k], k);
  for (const size of ['192x192', '512x512']) assert.ok(m.icons.some((i) => i.sizes === size), size);
  for (const i of m.icons) statSync(join(APP, i.src));
});

test('service worker precaches every game file', () => {
  const src = readFileSync(join(APP, 'sw.js'), 'utf8');
  assert.match(src, /const VERSION = 'dev';/); // stamped by the deploy workflow
  const assets = new Set([...src.match(/const ASSETS = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]));
  const files = walk(APP).map((p) => relative(APP, p)).filter((f) => !/^(_headers|sw\.js)$|\.txt$|\.DS_Store$/.test(f));
  for (const f of files) assert.ok(assets.has(f), `sw.js does not cache ${f}`);
  for (const a of assets) if (a !== './') statSync(join(APP, a));
});
