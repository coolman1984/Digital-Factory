#!/usr/bin/env node
// Plant studio bridge: lets Claude Code, Codex or any MCP client move objects in the live 3D plant, while a person watches
// and edits by hand in the same scene. No dependencies (Node 22 or later).
//
//   agent ──MCP over stdio──▶ this process ──WebSocket──▶ plant.html (assets/js/plant/studio.js)
//
// The first process to start becomes the hub: it serves the site on http://localhost:5174 and holds the page's socket.
// Each later process (a second agent, another session) finds the port taken and relays through the hub, so several
// agents can work on one plant at once; each change carries its agent's name and colour.
// Every accepted change is also written to studio/layout.json, so the file and the live page never disagree.
//
//   node tools/studio-bridge/server.mjs              MCP server on stdio (what .mcp.json runs)
//   node tools/studio-bridge/server.mjs serve        the hub alone: serve the site and wait for agents
//   node tools/studio-bridge/server.mjs call <op> [json]   one operation from a shell, for agents without MCP
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, createReadStream } from 'node:fs';
import { join, extname, normalize, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = normalize(join(dirname(fileURLToPath(import.meta.url)), '..', '..'));
const PORT = +(process.env.STUDIO_PORT || 5174);
const LAYOUT = join(ROOT, 'studio', 'layout.json');
const URL_PAGE = `http://localhost:${PORT}/plant.html?bridge=${PORT}`;
const log = (...a) => process.stderr.write('[plant-studio] ' + a.join(' ') + '\n');   // stdout belongs to MCP

/* ---------------- WebSocket, the small part of RFC 6455 we need ---------------- */
function wsAccept(req, socket) {
  const key = req.headers['sec-websocket-key'];
  const accept = createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  socket.setNoDelay(true);
  const peer = { socket, onmessage: null, onclose: null, open: true };
  let buf = Buffer.alloc(0), parts = [];
  socket.on('data', d => {
    buf = Buffer.concat([buf, d]);
    for (;;) {
      if (buf.length < 2) return;
      const fin = buf[0] & 0x80, op = buf[0] & 0x0f, masked = buf[1] & 0x80; let len = buf[1] & 0x7f, off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; } else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
      const mk = masked ? 4 : 0; if (buf.length < off + mk + len) return;
      let data = buf.subarray(off + mk, off + mk + len);
      if (masked) { const m = buf.subarray(off, off + 4); data = Buffer.from(data.map((b, i) => b ^ m[i % 4])); }
      buf = buf.subarray(off + mk + len);
      if (op === 8) { close(peer); return; }
      if (op === 9) { frame(peer, data, 10); continue; }
      if (op === 1 || op === 0) { parts.push(data); if (fin) { const text = Buffer.concat(parts).toString('utf8'); parts = []; if (peer.onmessage) peer.onmessage(text); } }
    }
  });
  socket.on('close', () => close(peer)); socket.on('error', () => close(peer));
  return peer;
}
function frame(peer, data, op = 1) {
  if (!peer.open) return;
  const p = Buffer.isBuffer(data) ? data : Buffer.from(String(data), 'utf8'), n = p.length;
  const head = n < 126 ? Buffer.from([0x80 | op, n]) : n < 65536 ? Buffer.from([0x80 | op, 126, n >> 8, n & 255]) : (() => { const h = Buffer.alloc(10); h[0] = 0x80 | op; h[1] = 127; h.writeBigUInt64BE(BigInt(n), 2); return h; })();
  peer.socket.write(Buffer.concat([head, p]));
}
function close(peer) { if (!peer.open) return; peer.open = false; try { peer.socket.end(); } catch (e) { /* gone */ } if (peer.onclose) peer.onclose(); }

/* ---------------- the hub: the site, the page and the agents ---------------- */
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain' };
const pages = new Set(), relays = new Set(), names = new Map();   // names: peer or 'self' → agent name
const pending = new Map(); let seqId = 0, lastLayout = null;
const localOrigin = o => !o || new RegExp(`^https?://(localhost|127\\.0\\.0\\.1):${PORT}$`).test(o);
function agentsNow() { return [...new Set([...names.values()])]; }
function tellPages() { for (const p of pages) frame(p, JSON.stringify({ event: 'agents', agents: agentsNow() })); }
function saveLayout(layout) {
  if (!layout || !Array.isArray(layout.objects)) return;
  lastLayout = layout;
  try { mkdirSync(dirname(LAYOUT), { recursive: true }); writeFileSync(LAYOUT, JSON.stringify(layout, null, 2) + '\n'); } catch (e) { log('could not write', LAYOUT, e.message); }
}
function readLayoutFile() { try { return JSON.parse(readFileSync(LAYOUT, 'utf8')); } catch (e) { return null; } }
// one operation for the page; the newest open page answers
function toPage(op, by, args, baseRev) {
  const page = [...pages].pop();
  if (!page) {
    if (op === 'read') { const l = lastLayout || readLayoutFile(); return Promise.resolve({ ok: true, offline: true, message: `No plant page is open, so this is the last saved layout. Open ${URL_PAGE} to work live.`, rev: l ? l.rev : 0, design_objects: l ? l.objects : [] }); }
    return Promise.resolve({ ok: false, error: 'no page', message: `Open ${URL_PAGE} in a browser first; the studio applies changes in the live page.` });
  }
  const id = 'b' + (++seqId);
  return new Promise(res => {
    const t = setTimeout(() => { pending.delete(id); res({ ok: false, error: 'timeout', message: 'The page did not answer within 15 s.' }); }, 15000);
    pending.set(id, r => { clearTimeout(t); res(r); });
    frame(page, JSON.stringify({ id, op, by, args, baseRev }));
  });
}
function startHub() {
  return new Promise((resolve, reject) => {
    const srv = createServer((req, res) => {
      let path = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (path.endsWith('/')) path += 'index.html';
      const f = normalize(join(ROOT, path));
      if (!f.startsWith(ROOT + sep) || f.split(sep).some(s => s.startsWith('.') && s.length > 1) || !existsSync(f) || !statSync(f).isFile()) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
      createReadStream(f).pipe(res);
    });
    srv.on('upgrade', (req, socket) => {
      const path = new URL(req.url, 'http://x').pathname;
      if (!localOrigin(req.headers.origin) || (path !== '/studio' && path !== '/agent')) { socket.destroy(); return; }
      const peer = wsAccept(req, socket);
      if (path === '/studio') {
        pages.add(peer); log('page connected');
        frame(peer, JSON.stringify({ event: 'agents', agents: agentsNow() }));
        peer.onmessage = t => { let m; try { m = JSON.parse(t); } catch (e) { return; } if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } else if (m.event === 'layout') saveLayout(m.layout);
          else if (m.event === 'hello') {   // the file is the shared truth: a page that opens with a different layer loads it
            const f = readLayoutFile();
            if (f && Array.isArray(f.objects) && f.objects.length && JSON.stringify(f.objects) !== JSON.stringify((m.layout || {}).objects)) frame(peer, JSON.stringify({ event: 'load', layout: f }));
            else saveLayout(m.layout);
          } };
        peer.onclose = () => { pages.delete(peer); log('page closed'); };
      } else {
        relays.add(peer);
        peer.onmessage = async t => { let m; try { m = JSON.parse(t); } catch (e) { return; } if (m.event === 'agent') { names.set(peer, m.name); tellPages(); return; } if (m.id) frame(peer, JSON.stringify({ id: m.id, result: await toPage(m.op, m.by || names.get(peer) || 'agent', m.args, m.baseRev) })); };
        peer.onclose = () => { relays.delete(peer); names.delete(peer); tellPages(); };
      }
    });
    srv.once('error', reject);
    srv.listen(PORT, '127.0.0.1', () => { log(`hub on ${URL_PAGE}`); resolve(srv); });
  });
}

/* ---------------- an agent's way in: the hub itself, or a relay to it ---------------- */
let route = null;   // (op, by, args, baseRev) → Promise<result>
async function connectAsAgent(name) {
  try { await startHub(); names.set('self', name); tellPages(); route = toPage; return 'hub'; }
  catch (e) { if (e.code !== 'EADDRINUSE') throw e; }
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/agent`);
  const waits = new Map(); let n = 0;
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error(`port ${PORT} is taken by something that is not the studio bridge`)); });
  ws.send(JSON.stringify({ event: 'agent', name }));
  ws.onmessage = e => { const m = JSON.parse(e.data); if (waits.has(m.id)) { waits.get(m.id)(m.result); waits.delete(m.id); } };
  ws.onclose = () => { route = null; for (const w of waits.values()) w({ ok: false, error: 'hub closed', message: 'The studio hub stopped; the next call starts a new one.' }); waits.clear(); };
  route = (op, by, args, baseRev) => new Promise(res => { const id = 'r' + (++n); waits.set(id, res); ws.send(JSON.stringify({ id, op, by, args, baseRev })); });
  return 'relay';
}

/* ---------------- the tools ---------------- */
const KINDS = ['zone', 'machine', 'rack', 'conveyor', 'robot', 'wall', 'marker'];
const num = d => ({ type: 'number', description: d }), str = d => ({ type: 'string', description: d });
const sch = (props, req = []) => ({ type: 'object', properties: props, required: req, additionalProperties: false });
const BASE = num('The rev from studio_read or from your last change. A change on an older rev is refused with the current scene.');
const WHY = str('One short reason, shown to the person watching');
const TOOLS = [
  { name: 'studio_read', op: 'read', description: 'Read the live design layer of Plant EG-01 (a fictional TV plant): the current rev, plant size (264 x 168 m; x west to east, z north to south), its areas (zones with bounds), production lines, the kinds you can place with default sizes, every design object with its clashes and author, recent changes and who is present. Call before you start and whenever a change comes back stale.', inputSchema: sch({}) },
  { name: 'studio_find_free_spot', op: 'find_free_spot', description: 'A free place of a footprint inside an area, clear of machines, racks, aisles and design objects; spot is null when none fits.', inputSchema: sch({ zone: str('Zone id from studio_read'), w: num('Width along x, m'), d: num('Depth along z, m'), kind: { type: 'string', enum: KINDS } }, ['zone', 'w', 'd']) },
  { name: 'studio_add', op: 'add', description: 'Place a design object (zone, machine, rack, conveyor, robot, wall, marker). Returns it with its id, clashes and the new rev. The person watching sees it drop in, tagged with your name.', inputSchema: sch({ base_rev: BASE, kind: { type: 'string', enum: KINDS }, x: num('Centre x, m'), z: num('Centre z, m'), w: num('Width, m'), d: num('Depth, m'), h: num('Height, m'), rot: num('Rotation, degrees'), label: str('Short label'), color: str('Hex colour like #2D5BFF'), why: WHY }, ['base_rev', 'kind', 'x', 'z']) },
  { name: 'studio_update', op: 'update', description: 'Move, resize, turn, relabel or recolour a design object. Returns it with its clashes and the new rev. Refused while a person is dragging that object.', inputSchema: sch({ base_rev: BASE, id: str('Object id, like D3'), x: num('m'), z: num('m'), w: num('m'), d: num('m'), h: num('m'), rot: num('degrees'), label: str('label'), color: str('hex colour'), why: WHY }, ['base_rev', 'id']) },
  { name: 'studio_remove', op: 'remove', description: 'Delete a design object. Returns the new rev.', inputSchema: sch({ base_rev: BASE, id: str('Object id'), why: WHY }, ['base_rev', 'id']) },
  { name: 'studio_undo', op: 'undo', description: 'Undo your own last change (scope "mine", the default) or the last change by anyone ("all").', inputSchema: sch({ base_rev: BASE, scope: { type: 'string', enum: ['mine', 'all'] } }, ['base_rev']) },
  { name: 'studio_redo', op: 'redo', description: 'Redo the last undone change.', inputSchema: sch({ base_rev: BASE }, ['base_rev']) },
  { name: 'studio_look_at', op: 'look_at', description: 'Point the camera of the person watching at a zone, a design object or a point.', inputSchema: sch({ zone: str('zone id'), id: str('object id'), x: num('m'), z: num('m'), distance: num('m') }) }
];
async function callTool(name, args, by) {
  const t = TOOLS.find(x => x.name === name); if (!t) return { ok: false, error: `Unknown tool ${name}` };
  if (!route) await connectAsAgent(by);
  const a = Object.assign({}, args || {}); const baseRev = a.base_rev; delete a.base_rev;
  return route(t.op, by, a, baseRev);
}
const agentName = s => { s = String(s || 'agent').toLowerCase(); return /claude/.test(s) ? 'claude-code' : /codex/.test(s) ? 'codex' : s.replace(/[^a-z0-9-]+/g, '-').slice(0, 30) || 'agent'; };

/* ---------------- MCP over stdio (JSON-RPC 2.0, one message per line) ---------------- */
function mcp() {
  let by = process.env.STUDIO_AGENT || 'agent', buf = '';
  const send = m => process.stdout.write(JSON.stringify(m) + '\n');
  const INSTRUCTIONS = `Plant studio for Plant EG-01: you edit a design layer in a live 3D digital twin while a person watches and may edit by hand. Call studio_read first and pass its rev as base_rev on every change; each change returns the next rev. If a change comes back "stale", read again and build on what is there. Use studio_find_free_spot to place things inside an area, check the clashes each change returns, and give each change a short "why". The person sees the page at ${URL_PAGE}.`;
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', async d => {
    buf += d; let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!line) continue;
      let m; try { m = JSON.parse(line); } catch (e) { send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }); continue; }
      const reply = (result) => m.id !== undefined && send({ jsonrpc: '2.0', id: m.id, result });
      const fail = (code, message) => m.id !== undefined && send({ jsonrpc: '2.0', id: m.id, error: { code, message } });
      try {
        if (m.method === 'initialize') {
          by = process.env.STUDIO_AGENT || agentName(m.params && m.params.clientInfo && m.params.clientInfo.name);
          reply({ protocolVersion: (m.params && m.params.protocolVersion) || '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'plant-studio', version: '1.0.0' }, instructions: INSTRUCTIONS });
          connectAsAgent(by).then(r => log(`${by} joined as ${r}`)).catch(e => log(e.message));
        } else if (m.method === 'tools/list') reply({ tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
        else if (m.method === 'tools/call') { const r = await callTool(m.params.name, m.params.arguments, by); reply({ content: [{ type: 'text', text: JSON.stringify(r) }], isError: !(r && r.ok) }); }
        else if (m.method === 'ping') reply({});
        else if (m.id !== undefined && !String(m.method || '').startsWith('notifications/')) fail(-32601, `Method not found: ${m.method}`);
      } catch (e) { fail(-32603, String(e && e.message || e)); }
    }
  });
  process.stdin.on('end', () => process.exit(0));
}

/* ---------------- entry ---------------- */
const [cmd, ...rest] = process.argv.slice(2);
if (cmd === 'serve') {
  startHub().then(() => log('waiting for agents; press Ctrl+C to stop')).catch(e => { log(e.code === 'EADDRINUSE' ? `port ${PORT} is already in use (another bridge is running?)` : e.message); process.exit(1); });
} else if (cmd === 'call') {
  const [op, json] = rest; const t = TOOLS.find(x => x.op === op || x.name === op);
  if (!t) { log(`unknown operation "${op}"; one of: ${TOOLS.map(x => x.op).join(', ')}`); process.exit(2); }
  const by = process.env.STUDIO_AGENT || 'cli';
  (async () => {
    // a one-shot call joins a running hub; it never becomes the hub, since it would stop right after
    try { const ws = new WebSocket(`ws://127.0.0.1:${PORT}/agent`); await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; }); ws.close(); } catch (e) { log(`no studio hub on port ${PORT}. Start one with: node tools/studio-bridge/server.mjs serve`); process.exit(1); }
    await connectAsAgent(by);
    const r = await callTool(t.name, json ? JSON.parse(json) : {}, by);
    process.stdout.write(JSON.stringify(r, null, 2) + '\n'); process.exit(r && r.ok ? 0 : 1);
  })().catch(e => { log(e.message); process.exit(1); });
} else mcp();
