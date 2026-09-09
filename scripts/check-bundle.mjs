import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';

const LIMIT_MB = 5;
const DIST = 'dist';

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

let files;
try {
  files = walk(DIST);
} catch {
  console.error(`FAIL  no ${DIST}/ — run "npm run build" first`);
  process.exit(1);
}

const initial = files.filter((f) => /\.(html|js|css)$/.test(f));
let rawTotal = 0;
let gzTotal = 0;
for (const f of initial) {
  const buf = readFileSync(f);
  rawTotal += buf.length;
  gzTotal += gzipSync(buf).length;
}

const rawMb = rawTotal / 1024 / 1024;
const gzMb = gzTotal / 1024 / 1024;
const ok = rawMb <= LIMIT_MB;

for (const f of initial) {
  const buf = readFileSync(f);
  console.log(`  ${f}  ${(buf.length / 1024).toFixed(1)} kB  (gzip ${(gzipSync(buf).length / 1024).toFixed(1)} kB)`);
}
console.log(`${ok ? 'PASS' : 'FAIL'}  initial download ${rawMb.toFixed(2)} MB raw / ${gzMb.toFixed(2)} MB gzip (budget ${LIMIT_MB} MB raw)`);
process.exit(ok ? 0 : 1);
