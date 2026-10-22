# Plant studio bridge

Lets coding agents (Claude Code, Codex, any MCP client) move objects in the live 3D plant while a person watches and edits
by hand in the same scene. No dependencies; Node 22 or later. Plan and phases: `docs/PLANT-STUDIO.md`.

```
agent ──MCP over stdio──▶ server.mjs (hub) ──WebSocket──▶ plant.html?bridge=5174 (assets/js/plant/studio.js)
second agent ──MCP──▶ server.mjs (relay) ──▶ hub
```

## Use it

**Claude Code:** the repository's `.mcp.json` registers the server as `plant-studio`. Approve it once, then open
<http://localhost:5174/plant.html?bridge=5174> in a browser and ask, for example, "add a screw cell next to main line 3".

**Codex or another MCP client:** add a stdio server with command `node` and arguments
`["tools/studio-bridge/server.mjs"]`, run from the repository root.

**Any agent with a shell:** start the hub with `node tools/studio-bridge/server.mjs serve`, open the page, then

```bash
STUDIO_AGENT=my-agent node tools/studio-bridge/server.mjs call read
STUDIO_AGENT=my-agent node tools/studio-bridge/server.mjs call add '{"base_rev": 3, "kind": "rack", "x": 230, "z": 140, "why": "overflow"}'
```

**No bridge at all:** edit `studio/layout.json` (format `df-studio/2`) and open the page with `?studio=file`, or tick
*Follow the layout file* in the studio panel. Only what changed in the file since the page last read it is applied, so
edits made by hand elsewhere stay.

## Tools

| Tool | What it does |
|---|---|
| `studio_read` | The current `rev`, plant size and areas, production lines, kinds with default sizes, every design object with its clashes and author, recent changes, who is present |
| `studio_find_free_spot` | A free place of a footprint inside an area |
| `studio_add` · `studio_update` · `studio_remove` | Change the layer; each needs `base_rev` and returns the next `rev` |
| `studio_undo` · `studio_redo` | Undo your own last change (or anyone's with `scope: "all"`) |
| `studio_look_at` | Point the watcher's camera |

A change based on an old `rev` comes back `stale` with the current scene: read it and build on it. A change to an object
that a person is dragging comes back `locked`. Every accepted change is written to `studio/layout.json`.

## Safety

The hub listens on 127.0.0.1 only, accepts WebSocket connections only from its own origin, serves no dotfiles, and is a
development tool: the public site never gets a write path. Set `STUDIO_PORT` to use another port.
