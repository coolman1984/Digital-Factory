# Plant studio: the plan

How we build a chat-driven 3D layout studio for Plant EG-01 that does what Spline for ChatGPT does and goes well past it.
Part 1 is the plan for the owner, in Arabic. Part 2 is the build specification for the coding agents, in English.
Version 1 is live (`assets/js/plant/studio.js`, merged in coolman1984/Digital-Factory#27); this document covers what comes next.

---

<div dir="rtl" lang="ar">

## الجزء الأول: الخطة

### ١. الهدف

نخلي أي حد، سواء إنسان أو وكيل ذكاء اصطناعي، يقدر يغيّر تخطيط المصنع ثلاثي الأبعاد وهو شايفه حي قدامه، ويعرف فورًا أثر التغيير ده على الإنتاج والأمان والتكلفة قبل ما أي حاجة تتحرك في الأرض.

### ٢. منتج Spline بيعمل إيه بالظبط

| الفكرة | عندهم |
|---|---|
| الربط | الشات بيكلّم المحرر عن طريق «خادم أدوات» (بروتوكول MCP) فيه أدوات زي: أضف عنصر، عدّل خامة، حرّك كاميرا |
| المكان | المحرر بيفتح جنب المحادثة، فالشخص بيشوف المشهد بيتبني قدامه |
| الشراكة | الذكاء الاصطناعي بيقرا المشهد من جديد قبل كل تعديل، فيكمّل على تعديلات الإنسان ومايمسحهاش |
| اليدوي | الإنسان يقدر يمسك أي عنصر ويحركه بإيده في أي وقت |
| المحرك | عرض ثلاثي الأبعاد في المتصفح (WebGPU مع بديل WebGL) |

**نقطة ضعفهم:** Spline محرر أشكال وبس. مايعرفش إن الرف ده لو اتحط هنا هيقفل ممر الرافعة، ولا إن الخط ده لو اتنقل هيطوّل مشوار التوريد ويقلل الإنتاج.

### ٣. اللي عندنا النهارده (الإصدار الأول)

- ✅ طبقة تصميم فوق المصنع الحي فيها سبع أنواع عناصر.
- ✅ أوامر بالعربي والإنجليزي من غير مفتاح، وClaude بأدوات لو فيه مفتاح.
- ✅ سحب وتحريك ولف باليد.
- ✅ كشف التداخل مع الماكينات والرفوف والممرات والحيطان.
- ✅ تراجع وإعادة، وحفظ في المتصفح، وتصدير واستيراد ملف.

### ٤. إزاي هنبقى أحسن منهم بكتير

| عندهم | عندنا |
|---|---|
| بيرسم أشكال | بيفهم المصنع: ماكينات وخطوط وممرات وطلبيات وعمال |
| مايعرفش أثر التعديل | **بيحسب الأثر**: إنتاج الساعة، مشوار الرافعة والقطار، الطاقة، التكلفة، قبل وبعد |
| تصميم واحد | **مقارنة بدائل**: تصميم «أ» قدام تصميم «ب» بالأرقام، والوكيل القائد يرشّح الأحسن |
| مفيش قواعد أمان | **قواعد هندسية**: مسافات أمان حول الروبوت، عرض الممرات، مخارج الطوارئ، حمولة الأرضية |
| وكيل واحد في الشات | **فريق وكلاء**: Claude Code ووكلاء برمجة تانيين ووكلاء المصنع التسعة، كل واحد ليه اسم ولون، والكل شايف الكل |
| الإنجليزي أساسًا | **عربي وإنجليزي** بالكامل |
| لازم إنترنت وحساب | **بيشتغل من غير مفتاح** بالمساعد المحلي |
| تاريخ بسيط | **سجل كامل**: مين غيّر إيه وإمتى وليه، وتقدر ترجع لأي لحظة |
| النتيجة شكل | **النتيجة قرار**: التصميم يتحول لاقتراح عليه موافقة في غرفة التحكم، ويظهر في العرض التقديمي |

### ٥. ثلاث طرق للتحريك

1. **🤖 أنا (Claude Code) والوكلاء البرمجيين التانيين:** هنبني «جسر» صغير على جهاز التطوير. الوكيل يكلّم الجسر بأدوات واضحة (اقرا المشهد، دوّر على مكان فاضي، أضف، حرّك، احذف، احسب الأثر)، والجسر يوصّل الأمر للصفحة المفتوحة عند العميل، فيشوف العنصر بيتحرك قدامه لحظة بلحظة. ولو مفيش جسر شغال، الوكيل يقدر يعدّل ملف التصميم في المشروع نفسه، والصفحة تقراه.
2. **💬 Claude جوه الصفحة:** للعميل اللي معاه مفتاح، زي النهارده، بنفس الأدوات بالظبط.
3. **✋ يدوي:** للعميل اللي عاوز يجرب بإيده: سحب، أسهم، لف، تعديل المقاسات واللون.

**القاعدة الذهبية:** الطرق الثلاثة بتشتغل على نفس العناصر ونفس العمليات. كل تعديل بيتسجل باسم صاحبه، ولو اتنين عدّلوا نفس العنصر في نفس اللحظة، التاني بيترفض ويقرا الجديد الأول، فمحدش بيمسح شغل التاني.

### ٦. المراحل

| المرحلة | الناتج | هنعرف إنها نجحت إزاي |
|---|---|---|
| ١. الأساس المشترك | كل العمليات في مكان واحد، ورقم نسخة لكل تعديل، وسجل باسم صاحب كل تعديل | التراجع والسجل شغالين لكل الطرق، ومفيش تعديل بيضيع |
| ٢. ملف التصميم | ملف في المشروع الوكلاء يعدّلوه والصفحة تقراه وتتحدث لوحدها | أعدّل الملف فالعنصر يتحرك في الصفحة في أقل من ثانيتين |
| ٣. جسر الوكلاء | جسر محلي بأدوات MCP، يوصّل Claude Code والوكلاء التانيين بالصفحة الحية | أقول لـ Claude Code «حط خلية روبوت جنب الخط 3» فتظهر قدام العميل |
| ٤. حضور الوكلاء | كل وكيل ليه اسم ولون ومؤشر، والعميل يشوف مين بيشتغل فين | وكيلين بيشتغلوا مع بعض من غير تعارض |
| ٥. حساب الأثر | قبل وبعد: الإنتاج، مشاوير النقل، الطاقة، التكلفة، الأمان | كل تصميم ليه بطاقة أرقام، والأرقام بتتغير صح لما العنصر يتحرك |
| ٦. البدائل والقرار | تصميمات بديلة جنب بعض، والوكيل القائد يرشّح، والتصميم يتحول لاقتراح في غرفة التحكم | العميل يختار بديل ويوافق عليه من غرفة التحكم |
| ٧. مكتبة وأشكال أغنى | ماكينات حقيقية الشكل، وقوالب جاهزة (خلية تجميع، منطقة تخزين) | العميل يبني خلية كاملة بأمر واحد |

### ٧. قرارات محتاجاك

- 🔑 الجسر هيشتغل على جهاز التطوير بس (الموقع العام ثابت ومفيهوش خادم). لو عاوز الوكلاء يحرّكوا المصنع عند عميل بعيد على الإنترنت، هنحتاج خادم صغير مستضاف، ودي تكلفة وقرار.
- 📏 أرقام حساب الأثر تقديرية من نموذج المحاكاة، مش دراسة هندسية معتمدة، وده لازم يكون مكتوب قدام العميل.
- 🏭 المصنع خيالي (EG-01)، ومش هنستخدم اسم أي شركة أو مدينة حقيقية.

</div>

---

## Part 2: build specification (for coding agents)

### 2.1 Principles

1. **One set of operations.** Hand, local parser, in-page Claude, file and bridge all call the same functions in
   `studio.js`. No path writes `objs` directly.
2. **Read before write, enforced.** Spline asks its agent to re-read the scene. We enforce it: every write carries the
   scene revision it was based on; a stale write is refused with the current scene, so nobody overwrites another's work.
3. **Every change has an author.** `you` (the hand), `local`, `claude` (in page), or the agent's name over the bridge
   (`claude-code`, `codex`, ...). The log is the audit trail and the undo history.
4. **The design layer never changes the simulation** until a design is approved as a proposal (phase 6), and even then the
   change is shown as a proposal, not applied to the plant model.
5. Static site stays static: the public pages need no server. The bridge is a local development tool.
6. Plant EG-01 is fictional. Bilingual everything. Update `guide.html`, `assets/js/guide-terms.js` and the page coach when
   a control or term changes (see `CLAUDE.md`).

### 2.2 Data model: `df-studio/2`

```json
{
  "format": "df-studio/2",
  "plant": "EG-01",
  "rev": 42,
  "objects": [
    { "id": "D7", "kind": "robot", "label": "Screw cell L3", "x": 155.5, "z": 79.5, "w": 3, "d": 3, "h": 2.6,
      "rot": 0, "color": "#0B7A43", "by": "claude-code", "at": "2026-10-22T10:14:03Z" }
  ],
  "log": [
    { "rev": 42, "by": "claude-code", "op": "add", "id": "D7", "why": "Second screw station to relieve the bottleneck" }
  ],
  "variants": { "A": { "objects": [] }, "B": { "objects": [] } },
  "active": "A"
}
```

- Units are metres. `x` runs west to east (0 to 264), `z` north to south (0 to 168), `rot` in degrees.
- `kind` is one of `zone machine rack conveyor robot wall marker` today; phase 7 adds templates (`cell`, `storage`).
- `df-studio/1` files (v1 export: `objects` without `rev`) import unchanged; ids are reassigned.
- `log` keeps the last 500 entries; undo is per author by default ("undo my last change"), with a global undo too.

### 2.3 Operations contract (phase 1)

Refactor `studio.js` so all writes go through one function:

```js
apply({ op, by, baseRev, ...args }) → { ok: true, rev, object?, clashes?, impact? }
                                   | { ok: false, error, scene? }   // stale baseRev → scene included
```

| op | args | notes |
|---|---|---|
| `read` | none | plant bounds, zones, lines, kinds, objects with clashes, `rev`, selection, who is present |
| `find_free_spot` | `zone, w, d, kind` | read-only |
| `add` | `kind, x, z, w?, d?, h?, rot?, label?, color?, why?` | |
| `update` | `id, patch, why?` | |
| `remove` | `id, why?` | |
| `undo` / `redo` | `scope: "mine" \| "all"` | |
| `look_at` | `zone \| id \| x,z,distance` | camera only, no `rev` change |
| `impact` | `variant?` | phase 5 |
| `variant` | `create \| switch \| compare` | phase 6 |

`baseRev` is optional for the hand and the local parser (they act on what is on screen) and required over the bridge.
The in-page Claude tools gain `baseRev` too; the system prompt already tells it to read first.

### 2.4 Phase 2: the layout file

- `studio/layout.json` in the repo, format `df-studio/2`. A coding agent edits it like any file.
- `plant.html?studio=file` (and the studio panel's "Follow the file" switch) polls it every 1.5 s with
  `fetch(..., { cache: 'no-store' })`, diffs by `rev`, and replays the change with author `file`, animating moved objects
  over 400 ms so the viewer sees the move.
- The panel's Export writes the same format, so a hand-made layout can be committed and shared.
- Works with any coding agent and any static server, and needs no bridge. This is the fallback.

### 2.5 Phase 3: the agent bridge (`tools/studio-bridge/`)

```
Claude Code / Codex / other agent ──MCP (stdio)──▶ studio-bridge (Node 22) ──WebSocket──▶ plant.html (studio.js)
                                                         │
                                                         └── serves the site on http://localhost:5174
```

- `tools/studio-bridge/server.mjs`: one process that serves the static site, holds a WebSocket at `/studio`, and speaks
  MCP over stdio. Dev dependencies only (`@modelcontextprotocol/sdk`, `ws`) in `tools/studio-bridge/package.json`; the
  site keeps no build step.
- MCP tools mirror §2.3 one to one: `studio_read`, `studio_find_free_spot`, `studio_add`, `studio_update`,
  `studio_remove`, `studio_undo`, `studio_look_at`, later `studio_impact`, `studio_variant`. Each forwards
  `{ op, by: <client name>, baseRev, ... }` to the page and returns the page's answer. The tool descriptions repeat the
  rule: call `studio_read` first; on `stale`, read again and retry.
- The page connects when opened as `plant.html?bridge=5174`; the panel shows "Connected to agents" and who is connected.
  With no page open, the bridge answers from the last saved `studio/layout.json` and refuses writes with a clear message.
- The bridge also writes every accepted change to `studio/layout.json`, so the file and the live page never disagree.
- Project config: `.mcp.json` registers the bridge for Claude Code; `docs/` gets a short "how to connect Codex or any MCP
  client" section.
- Security: the bridge listens on 127.0.0.1 only, checks the `Origin` of the WebSocket, and never exposes a write path
  to the public site.

### 2.6 Phase 4: presence

- Each author gets a colour and a small floating tag in the 3D view at the object it last touched ("claude-code is moving
  D7"), faded after 4 s. Objects keep a thin outline in their author's colour while selected by them.
- A soft lock: an object being dragged by the hand is refused to agents for the drag's duration (`locked_by: "you"`).
- The panel lists who is present and their last action.

### 2.7 Phase 5: impact, the part Spline cannot do

Computed in the page from the plant model (`engine.js`), on demand and after each change (debounced 600 ms):

| Measure | How |
|---|---|
| Clearance | v1 clashes, plus a 1 m safety ring around robot cells, 3 m minimum forklift aisle width, emergency-exit lines kept free |
| Travel | shortest path on the walking grid (scene.js already has A*) from the supermarkets to each line, before and after; tugger and forklift metres per hour |
| Output | a conveyor or robot cell placed on a line adds the station capacity it declares; the flow model in `agents.js` forecasts packed TVs over two hours, before and after |
| Energy | each kind declares kW; power peak against the contract |
| Cost | rough capital per kind (declared in `KINDS`), payback from the output change |

Shown as an impact card in the panel (before → after, green or amber), given to every agent in `read`, and exported with
the layout. Labelled "simulated estimate" in both languages.

### 2.8 Phase 6: variants and decisions

- Up to four variants side by side; `compare` returns the impact table for all of them.
- "Ask the Orchestrator" sends the variants to the command-room Orchestrator, which ranks them with its plant rules
  (safety first, orders first, then total cost) and explains the pick.
- "Propose" turns the chosen variant into a decision card in the command room (owner: Engineering), with the impact as its
  evidence, so it goes through the same approval and audit as every other decision, and can be pinned into the deck.

### 2.9 Phase 7: richer objects

- Templates that expand into several objects: assembly cell, buffer, storage block, quality gate.
- Better shapes per kind (instanced, low-poly, shared materials) and an optional glTF import for a custom machine, kept
  under the page weight budget.

### 2.10 Testing (every phase)

- Headless browser script (pattern: the scratchpad `st.mjs` used for v1): run each operation from each author, check
  `rev`, the log, stale refusal, undo per author, and no console errors, in English and Arabic.
- The bridge: a node test that starts it, opens the page headless, calls each MCP tool, and checks the page state.
- Design gate from `CLAUDE.md` (`qa.mjs` and the impeccable detector) for every visual change.

### 2.11 Files

| File | Phase |
|---|---|
| `assets/js/plant/studio.js` | 1, 2, 4, 5, 6 |
| `assets/js/plant/studio-impact.js` | 5 |
| `studio/layout.json` | 2 |
| `tools/studio-bridge/{server.mjs,package.json,README.md}` | 3 |
| `.mcp.json` | 3 |
| `guide.html`, `assets/js/guide-terms.js`, `assets/js/help/plant.js`, `README.md` | every phase |

### 2.12 Sources

- Spline for ChatGPT plugin: docs.spline.design/generate/plugins/chatgpt
- Spline MCP server: docs.spline.design/generate/spline-mcp-server
- Spline V2: blog.spline.design/spline-v2 · thenewstack.io/spline-v2-mcp-agents
- MCP apps in ChatGPT: developers.openai.com/apps-sdk/mcp-apps-in-chatgpt
