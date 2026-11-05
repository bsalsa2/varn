// Fails the build if anything from the private assistant is in the public bundle (dist/).
// Run automatically after `npm run build`. Private builds go to dist-private/ and are never checked here.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MARKERS = [
  'varn-ask', '/v1/ask', '/v1/login', 'VITE_ASK_URL', 'VITE_PRIVATE_ASK', 'propose_command', 'get_quake_summary', 'search_facts',
  'ASK_PASSWORD_HASH', 'ASK_SESSION_SECRET', 'ask-panel', 'ask-fab', "AI assistant. It can be wrong", 'workers.dev',
];

export function scan(dir) {
  const hits = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== 'cesium') walk(p); continue; }       // Cesium's own runtime files are third-party
      if (!/\.(js|mjs|css|html|json|map|txt|md)$/.test(e.name) || /\.(png|webp|jpg)$/.test(e.name)) continue;
      const text = fs.readFileSync(p, 'utf8');
      for (const m of MARKERS) if (text.includes(m)) hits.push(`${path.relative(dir, p)}: contains "${m}"`);
    }
  };
  walk(dir);
  return hits;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const dist = path.resolve(root, process.argv[2] || 'dist');
  if (!fs.existsSync(dist)) { console.error(`check-no-ask: ${dist} does not exist; build first`); process.exit(1); }
  const hits = scan(dist);
  if (hits.length) { console.error(`check-no-ask: the public build contains assistant code or settings:\n  ${hits.join('\n  ')}`); process.exit(1); }
  console.log('check-no-ask: ok (no assistant code, Worker URL or secrets in the public build)');
}
