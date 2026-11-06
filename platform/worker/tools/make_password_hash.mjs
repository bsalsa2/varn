#!/usr/bin/env node
// Run locally:  node tools/make_password_hash.mjs --put     (saves both secrets to Cloudflare for you)
//               node tools/make_password_hash.mjs         (prints them instead, to paste by hand)
// Reads a password without echoing it (at least 10 characters, typed twice), then prints ASK_PASSWORD_HASH and a new
// ASK_SESSION_SECRET. The password is never written to a file, a log, a command line or the clipboard.
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { hashPassword, MAX_ITERATIONS, b64u } from '../src/auth.js';

export const MIN_LENGTH = 10;
export const checkPolicy = (pw) => (typeof pw !== 'string' || [...pw].length < MIN_LENGTH ? `Use at least ${MIN_LENGTH} characters.` : /^\s|\s$/.test(pw) ? 'Remove spaces at the start or end.' : null);

export async function makeSecrets(password, random = (n) => crypto.getRandomValues(new Uint8Array(n))) {
  const problem = checkPolicy(password);
  if (problem) throw new Error(problem);
  return { ASK_PASSWORD_HASH: await hashPassword(password, { iterations: MAX_ITERATIONS, salt: random(16) }), ASK_SESSION_SECRET: b64u.enc(random(32)) };
}

/** Saves one secret by piping it into `wrangler secret put`'s stdin: the value is never on a command line, on screen or in a file. */
export function putSecret(name, value, run = spawnSync) {
  const r = run('npx', ['wrangler', 'secret', 'put', name], { input: value, encoding: 'utf8', shell: process.platform === 'win32' });
  return { ok: r.status === 0, output: `${r.stdout || ''}${r.stderr || ''}`.trim().split('\n').slice(-4).join('\n') };
}

/** Saves both secrets. Reports names and success only, never values. */
export function savePair(secrets, log = console.log, run = spawnSync) {
  let allOk = true;
  for (const name of ['ASK_PASSWORD_HASH', 'ASK_SESSION_SECRET']) {
    const r = putSecret(name, secrets[name], run);
    allOk = allOk && r.ok;
    log(`${name}: ${r.ok ? 'saved to Cloudflare' : 'FAILED'}`);
    if (!r.ok) log(Object.values(secrets).reduce((text, v) => text.split(v).join('[hidden]'), r.output));
  }
  return allOk;
}

function readHidden(prompt) {
  return new Promise((resolve, reject) => {
    const { stdin, stderr } = process;
    if (!stdin.isTTY) return reject(new Error('Run this in a terminal so the password is not echoed or piped.'));
    stderr.write(prompt);
    let buf = '';
    stdin.setRawMode(true); stdin.resume(); stdin.setEncoding('utf8');
    const done = (fn, v) => { stdin.setRawMode(false); stdin.pause(); stdin.removeListener('data', on); stderr.write('\n'); fn(v); };
    const on = (c) => {
      for (const ch of c) {
        if (ch === '\u0003') return done(reject, new Error('Cancelled.'));
        if (ch === '\r' || ch === '\n') return done(resolve, buf);
        if (ch === '\u007f' || ch === '\b') buf = [...buf].slice(0, -1).join(''); else buf += ch;
      }
    };
    stdin.on('data', on);
  });
}

// Compare as file URLs: `file://${argv[1]}` never matches on Windows (C:\... vs file:///C:/...), which made this script do nothing there.
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const a = await readHidden(`New password (min ${MIN_LENGTH} characters, not shown): `);
    const problem = checkPolicy(a);
    if (problem) throw new Error(problem);
    const b = await readHidden('Type it again: ');
    if (a !== b) throw new Error('The two entries did not match.');
    const s = await makeSecrets(a);
    if (process.argv.includes('--put')) {
      // No copying and no pasting: the values go straight to Cloudflare and are never shown.
      console.error('\nSaving to Cloudflare (run from the worker folder, after `npx wrangler login`)...');
      if (!savePair(s)) process.exit(1);
      console.error('\nDone. Nothing was printed or saved on this computer. Keep your password in a password manager.');
    } else {
      console.log('\nPaste each value when wrangler asks for it (do not put them on a command line):\n');
      console.log(`ASK_PASSWORD_HASH=${s.ASK_PASSWORD_HASH}`);
      console.log(`ASK_SESSION_SECRET=${s.ASK_SESSION_SECRET}\n`);
      console.error('Nothing was saved. Close this terminal when done; keep the password in your password manager.');
    }
  } catch (e) { console.error(`\n${e.message}`); process.exit(1); }
}
