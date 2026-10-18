// Builds the plain-files version of the site into /out, ready to upload to any web host.
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

// Run Next.js through node directly (not npx / npm shims) so this also works in a folder whose name contains '&'.
const nextBin = createRequire(import.meta.url).resolve('next/dist/bin/next');
// A static export cannot contain server code (the form route, the admin dashboard, the proxy that guards it),
// so those are set aside during the build and always put back.
const ASIDE = [
  [path.join(process.cwd(), 'app', 'api'), path.join(process.cwd(), 'app', '_api-off')],
  [path.join(process.cwd(), 'app', 'admin'), path.join(process.cwd(), 'app', '_admin-off')],
  [path.join(process.cwd(), 'app', 'unsubscribe'), path.join(process.cwd(), 'app', '_unsubscribe-off')],
  [path.join(process.cwd(), 'proxy.js'), path.join(process.cwd(), '_proxy-off.js')],
];
for (const [from, to] of ASIDE) if (fs.existsSync(from)) fs.renameSync(from, to);
try {
  execFileSync(process.execPath, [nextBin, 'build', '--webpack'], { stdio: 'inherit', env: { ...process.env, STATIC_EXPORT: '1' } });
} finally {
  for (const [from, to] of ASIDE) if (fs.existsSync(to)) fs.renameSync(to, from);
}

const OUT = path.join(process.cwd(), 'out');
const KEEP = new Set(['_next', 'assets', 'icons', 'images']);
const pages = new Set(fs.readdirSync(OUT).filter((f) => f.endsWith('.html')).map((f) => f.slice(0, -5)));
let files = 0, dirs = 0;
// Next.js also writes data files for in-app navigation; this site uses normal links, so drop them.
for (const e of fs.readdirSync(OUT, { withFileTypes: true })) {
  const p = path.join(OUT, e.name);
  if (e.isFile() && e.name.endsWith('.txt') && e.name !== 'robots.txt') { fs.rmSync(p); files++; }
  else if (e.isDirectory() && !KEEP.has(e.name) && (pages.has(e.name) || e.name.startsWith('_not-found') || e.name.startsWith('__next.'))) { fs.rmSync(p, { recursive: true }); dirs++; }
}
if (fs.existsSync(path.join(OUT, '_not-found.html'))) fs.rmSync(path.join(OUT, '_not-found.html'));
fs.copyFileSync(path.join(process.cwd(), 'docs', 'htaccess-for-static-hosting.txt'), path.join(OUT, '.htaccess'));
console.log(`static build ready in /out (removed ${files} data files and ${dirs} folders, added .htaccess)`);
