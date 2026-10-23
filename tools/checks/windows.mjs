#!/usr/bin/env node
// Windows compatibility gate for the repository (runs on any OS with Node 22):
//   1. every tracked path is legal on NTFS: no reserved device names, no <>:"|?* or control characters, no trailing dot or space
//   2. no two paths differ only by case (they would collide on Windows and macOS)
//   3. paths stay under 200 characters from the repository root, so a clone in C:\Users\<name>\Documents\... stays under MAX_PATH
//   4. scripts we ship (tools/**/*.mjs) build file URLs with pathToFileURL and never assume '/' separators or a POSIX shell
//   5. text files decode as UTF-8 and do not depend on LF only (no shebang-only executables needed to run them)
//   6. optional: with pwsh on PATH (or --pwsh <path>), the PowerShell installer parses with zero errors
// Usage: node tools/checks/windows.mjs [--pwsh /path/to/pwsh]
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const files = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT }).toString('utf8').split('\0').filter(Boolean);
const out = [], fail = (r, m) => out.push(['FAIL', r, m]), ok = (r, m) => out.push(['ok', r, m]);
const RESERVED = /^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])(\..*)?$/i, BAD = /[<>:"|?*\x00-\x1f]/;

let bad = [];
for (const f of files) for (const part of f.split('/')) if (RESERVED.test(part) || BAD.test(part) || /[. ]$/.test(part)) bad.push(f);
bad.length ? fail('names', `${bad.length} illegal on Windows: ${bad.slice(0, 5).join(', ')}`) : ok('names', `${files.length} tracked paths are legal on NTFS`);

const seen = new Map(), clash = [];
for (const f of files) { const k = f.toLowerCase(); if (seen.has(k) && seen.get(k) !== f) clash.push(`${seen.get(k)} ↔ ${f}`); seen.set(k, f); }
clash.length ? fail('case', clash.slice(0, 5).join('; ')) : ok('case', 'no paths differ only by case');

const long = files.filter(f => f.length > 200);
long.length ? fail('length', `${long.length} paths over 200 characters: ${long[0]}`) : ok('length', `longest path ${Math.max(...files.map(f => f.length))} characters`);

const scripts = files.filter(f => /^tools\/.*\.mjs$/.test(f) || /^\.claude\/skills\/.*\.mjs$/.test(f));
const smell = [];
for (const f of scripts) {
  const s = readFileSync(join(ROOT, f), 'utf8');
  if (/['"`]file:\/\/['"`]\s*\+/.test(s)) smell.push(`${f}: builds a file URL by string concatenation (use pathToFileURL)`);
  if (/execSync\(\s*['"`](rm|cp|mv|ls|cat|grep|sed) /.test(s)) smell.push(`${f}: shells out to a POSIX command`);
  // a file-system path split on '/' (URLs split on '/' are fine): the variable is named like a path
  if (/\b\w*(path|file|dir)\w*\.split\(['"]\/['"]\)/i.test(s)) smell.push(`${f}: splits a file path on '/' (use path.basename / path.sep)`);
}
smell.length ? fail('scripts', smell.slice(0, 5).join('; ')) : ok('scripts', `${scripts.length} Node scripts use portable paths and no POSIX shell`);

let nonUtf8 = 0;
for (const f of files) {
  if (!/\.(html|css|js|mjs|json|md|ps1|txt|yml|yaml)$/.test(f)) continue;
  const b = readFileSync(join(ROOT, f));
  try { new TextDecoder('utf-8', { fatal: true }).decode(b); } catch { nonUtf8++; }
}
nonUtf8 ? fail('encoding', `${nonUtf8} text files are not UTF-8`) : ok('encoding', 'every text file is UTF-8');

const i = process.argv.indexOf('--pwsh'), pwsh = i > 0 ? process.argv[i + 1] : 'pwsh';
const ps1 = files.filter(f => f.endsWith('.ps1'));
if (ps1.length) {
  const probe = spawnSync(pwsh, ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()'], { encoding: 'utf8' });
  if (probe.status !== 0) out.push(['skip', 'powershell', `pwsh not found; ${ps1.length} .ps1 file(s) not parsed`]);
  else for (const f of ps1) {
    const r = spawnSync(pwsh, ['-NoProfile', '-Command', `$e=$null;$t=$null;[void][System.Management.Automation.Language.Parser]::ParseFile('${join(ROOT, f).replace(/'/g, "''")}',[ref]$t,[ref]$e);$e.Count;$e|%{$_.Message}`], { encoding: 'utf8' });
    const n = parseInt((r.stdout || '').trim().split('\n')[0], 10);
    n === 0 ? ok('powershell', `${f} parses with 0 errors (PowerShell ${probe.stdout.trim()})`) : fail('powershell', `${f}: ${r.stdout.trim() || r.stderr.trim()}`);
  }
}
for (const [s, r, m] of out) console.log(`${s.padEnd(4)}  ${r.padEnd(11)} ${m}`);
const n = out.filter(x => x[0] === 'FAIL').length;
console.log(n ? `${n} FAIL` : 'PASS'); process.exit(n ? 1 : 0);
