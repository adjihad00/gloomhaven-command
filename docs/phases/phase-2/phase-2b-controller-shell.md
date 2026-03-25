# Phase 2B — Controller Shell, Connection Screen, Tab Navigation

> Paste into Claude Code. Builds the controller app scaffold: HTML entry point,
> connection/setup screen with Import + Manual options, tab navigation frame,
> esbuild build pipeline, and a working page served at /controller.

---

Read CLAUDE.md, then docs/PROJECT_CONTEXT.md, then docs/COMMAND_PROTOCOL.md.

Then read these files in full:
- `clients/shared/lib/connection.ts` (Connection class, ConnectionOptions, ConnectionStatus)
- `clients/shared/lib/stateStore.ts` (StateStore class, derived getters)
- `clients/shared/lib/commandSender.ts` (CommandSender class, method signatures)
- `clients/shared/lib/index.ts` (barrel exports)
- `clients/shared/styles/theme.css` (CSS variables)
- `clients/shared/styles/typography.css` (font classes)
- `clients/shared/styles/components.css` (shared component styles)
- `clients/controller/package.json` (current esbuild config)
- `server/src/staticServer.ts` (how the controller is served)

Also reference the old controller app for design cues:
- Read the project knowledge file `ghs-controller.html` — specifically the setup screen HTML/CSS (lines 1-210) and the section/tab structure. We're rebuilding this from scratch but keeping the dark parchment aesthetic.

## Architecture

The controller is a single-page app built as one `index.html` + one bundled `main.js`. No framework — vanilla TypeScript with DOM manipulation. esbuild bundles everything including imports from `@gloomhaven-command/shared` and `clients/shared/lib/`.

The HTML file loads the shared CSS files and a controller-specific stylesheet. The JS entry point (`main.ts`) creates the Connection, StateStore, and CommandSender, then manages screen transitions (setup → game).

The game screen uses a tab bar across the top. Each tab is a `<div>` that shows/hides. Tab content is populated by modules from `clients/controller/src/tabs/` — but those are Phase 2C-2E. This prompt creates the tab frame with placeholder content.

## STEP 1 — Set up esbuild pipeline

Update `clients/controller/package.json`:

```json
{
  "name": "@gloomhaven-command/controller",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "node build.mjs",
    "watch": "node build.mjs --watch",
    "dev": "node build.mjs --watch"
  },
  "devDependencies": {
    "esbuild": "^0.24.0",
    "typescript": "^5.6.0"
  }
}
```

Create `clients/controller/build.mjs`:

```javascript
import * as esbuild from 'esbuild';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: [resolve(__dirname, 'src/main.ts')],
  bundle: true,
  outfile: resolve(__dirname, 'dist/main.js'),
  format: 'esm',
  platform: 'browser',
  target: ['es2022'],
  sourcemap: true,
  minify: !watch,
  // Resolve workspace packages
  alias: {
    '@gloomhaven-command/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
    '@gloomhaven-command/client-lib': resolve(__dirname, '../shared/lib/index.ts'),
  },
  loader: {
    '.ts': 'ts',
  },
  logLevel: 'info',
};

if (watch) {
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  console.log('Watching for changes...');
} else {
  await esbuild.build(buildOptions);
}
```

Update `clients/controller/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "declaration": false,
    "declarationMap": false,
    "sourceMap": true
  },
  "include": ["src/**/*.ts"],
  "references": [
    { "path": "../../packages/shared" }
  ]
}
```

## STEP 2 — Write `clients/controller/index.html`

Complete HTML file. Loads CSS, has the two screens (setup + game), includes the bundled JS.

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <meta name="theme-color" content="#1a1410">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="mobile-web-app-capable" content="yes">
    <title>Gloomhaven Command — Controller</title>
    <link rel="stylesheet" href="/shared/styles/theme.css">
    <link rel="stylesheet" href="/shared/styles/typography.css">
    <link rel="stylesheet" href="/shared/styles/components.css">
    <link rel="stylesheet" href="styles/controller.css">
</head>
<body>
    <!-- ============================================ -->
    <!-- SETUP SCREEN                                 -->
    <!-- ============================================ -->
    <div id="setupScreen" class="setup-screen">
        <div class="setup-content">
            <h1 class="heading-xl setup-title">Gloomhaven<br>Command</h1>
            <p class="setup-subtitle">Controller</p>

            <!-- Connection Form -->
            <div id="connectForm" class="setup-section">
                <div class="form-group">
                    <label class="form-label" for="gameCodeInput">Game Code</label>
                    <input type="text" id="gameCodeInput" class="form-input"
                           placeholder="Enter game code" autocomplete="off" spellcheck="false">
                </div>
                <button id="connectBtn" class="btn btn-primary">Connect</button>
                <div id="connectionStatus" class="connection-status hidden">
                    <span id="statusDot" class="status-dot"></span>
                    <span id="statusText">Disconnected</span>
                </div>
            </div>

            <!-- Post-Connect: Game Setup Options -->
            <div id="gameSetup" class="setup-section hidden">
                <div class="connection-status connected">
                    <span class="status-dot connected"></span>
                    <span id="connectedGameCode"></span>
                </div>

                <div class="setup-options">
                    <button id="newGameBtn" class="btn btn-secondary setup-option-btn">
                        <span class="option-icon">⚔</span>
                        <span class="option-label">New Game</span>
                        <span class="option-desc">Start a fresh scenario</span>
                    </button>

                    <button id="importBtn" class="btn btn-secondary setup-option-btn">
                        <span class="option-icon">📜</span>
                        <span class="option-label">Import GHS Save</span>
                        <span class="option-desc">Load from Gloomhaven Secretariat</span>
                    </button>

                    <button id="resumeBtn" class="btn btn-primary setup-option-btn hidden">
                        <span class="option-icon">▶</span>
                        <span class="option-label">Resume Game</span>
                        <span class="option-desc">Continue where you left off</span>
                    </button>
                </div>

                <!-- Import Panel (hidden until Import clicked) -->
                <div id="importPanel" class="import-panel hidden">
                    <h3 class="heading-sm">Import GHS Save</h3>
                    <p class="import-instructions">
                        Paste a GHS game state JSON below, or upload a GHS backup file.
                    </p>
                    <textarea id="importTextarea" class="form-input import-textarea"
                              placeholder="Paste GHS JSON here..." rows="6"></textarea>
                    <div class="import-actions">
                        <label class="btn btn-secondary import-file-btn">
                            Choose File
                            <input type="file" id="importFileInput" accept=".json" hidden>
                        </label>
                        <button id="importSubmitBtn" class="btn btn-primary">Import</button>
                    </div>
                    <div id="importStatus" class="import-status hidden"></div>
                </div>

                <button id="disconnectBtn" class="btn-text">Disconnect</button>
            </div>
        </div>
    </div>

    <!-- ============================================ -->
    <!-- GAME SCREEN                                  -->
    <!-- ============================================ -->
    <div id="gameScreen" class="game-screen hidden">
        <!-- Header Bar -->
        <header class="game-header">
            <div class="header-left">
                <span class="header-title heading-md">Gloomhaven Command</span>
            </div>
            <div class="header-center">
                <span id="headerRound" class="header-round">Round —</span>
                <span id="headerPhase" class="header-phase">—</span>
            </div>
            <div class="header-right">
                <span id="headerStatus" class="status-dot connected"></span>
                <button id="headerMenuBtn" class="header-menu-btn">☰</button>
            </div>
        </header>

        <!-- Tab Bar -->
        <nav class="tab-bar">
            <button class="tab-btn active" data-tab="play">Active Play</button>
            <button class="tab-btn" data-tab="monsters">Monsters</button>
            <button class="tab-btn" data-tab="scenario">Scenario</button>
            <button class="tab-btn" data-tab="loot">Loot & Decks</button>
            <button class="tab-btn" data-tab="campaign">Campaign</button>
        </nav>

        <!-- Tab Content Panels -->
        <main class="tab-content">
            <div id="tabPlay" class="tab-panel active" data-tab="play">
                <div class="tab-placeholder">
                    <p>Active Play — Phase 2C</p>
                </div>
            </div>
            <div id="tabMonsters" class="tab-panel" data-tab="monsters">
                <div class="tab-placeholder">
                    <p>Monster Management — Phase 2D</p>
                </div>
            </div>
            <div id="tabScenario" class="tab-panel" data-tab="scenario">
                <div class="tab-placeholder">
                    <p>Scenario — Phase 2E</p>
                </div>
            </div>
            <div id="tabLoot" class="tab-panel" data-tab="loot">
                <div class="tab-placeholder">
                    <p>Loot & Decks — Phase 2E</p>
                </div>
            </div>
            <div id="tabCampaign" class="tab-panel" data-tab="campaign">
                <div class="tab-placeholder">
                    <p>Campaign — Phase 2E</p>
                </div>
            </div>
        </main>

        <!-- Floating Action Buttons (Phase Advancement) -->
        <div id="fabContainer" class="fab-container hidden">
            <!-- FABs added dynamically by activePlay tab module -->
        </div>

        <!-- Menu Overlay -->
        <div id="menuOverlay" class="menu-overlay hidden">
            <div class="menu-panel">
                <h3 class="heading-md">Menu</h3>
                <button id="menuUndoBtn" class="menu-item">Undo Last Action</button>
                <button id="menuExportBtn" class="menu-item">Export Game State</button>
                <button id="menuDisconnectBtn" class="menu-item danger">Disconnect</button>
                <button id="menuCloseBtn" class="menu-item">Close</button>
            </div>
        </div>
    </div>

    <script type="module" src="dist/main.js"></script>
</body>
</html>
```

## STEP 3 — Write `clients/controller/styles/controller.css`

Controller-specific styles. The shared styles handle base theme, typography, and common components. This file handles layout specific to the controller.

Create the `styles/` directory inside `clients/controller/`.

Key sections to implement (write the full CSS file):

**Setup screen:** Centered vertically and horizontally. Max-width 480px. Setup options are full-width buttons with icon + label + description layout.

**Import panel:** Bordered card with textarea and file upload. Success/error status messages with appropriate colors.

**Game screen:** Full viewport height flex column. Header → tab bar → scrollable content → FAB overlay.

**Header:** Three-section flex layout (left: title, center: round/phase, right: status + menu). Background `var(--bg-secondary)` with copper border bottom.

**Tab bar:** Horizontal flex, scrollable on narrow screens. Active tab has gold bottom border and gold text. Inactive tabs are muted. Use `var(--bg-card)` background.

**Tab content:** Flex-grow scrollable area. Each panel shows/hides via `.active` class.

**FAB container:** Fixed bottom-right position, z-index above content.

**Menu overlay:** Full-screen dark backdrop with centered panel. Panel has copper border, card background, stacked menu items.

**Responsive:** At 768px+ (iPad), increase tab font size and content padding. At 1024px+ (large iPad), further increase.

**Utility:** `.hidden` class with `display: none !important`.

Match the dark parchment aesthetic: `var(--bg-primary)` body, `var(--bg-card)` for cards and panels, `var(--accent-gold)` for active elements, `var(--accent-copper)` for borders, `var(--text-muted)` for inactive elements.

## STEP 4 — Write `clients/controller/src/main.ts`

The entry point. Read the existing `Connection`, `StateStore`, `CommandSender` APIs from `clients/shared/lib/` to use them correctly.

### Module-level state

```typescript
let connection: Connection | null = null;
let store: StateStore | null = null;
let commands: CommandSender | null = null;
let gameCode: string = '';
let gameScreenActive: boolean = false;
```

Export an `app` object or getter functions so tab modules (Phase 2C+) can access these:
```typescript
export function getStore(): StateStore { return store!; }
export function getCommands(): CommandSender { return commands!; }
export function getConnection(): Connection { return connection!; }
export function getGameCode(): string { return gameCode; }
```

### Startup (DOMContentLoaded)

1. Grab all DOM elements by ID
2. Load saved game code from `localStorage` key `gc_gameCode` — pre-fill the input
3. Wire event listeners for all buttons
4. If saved game code exists, optionally auto-connect (or just pre-fill)

### Connect button handler

1. Read game code from input, validate non-empty
2. Save to `localStorage` key `gc_gameCode`
3. Show connection status, disable button
4. Create `Connection` with:
   - `gameCode`
   - `onStateUpdate`: calls `handleStateUpdate(state)`
   - `onConnectionChange`: calls `handleConnectionChange(status)`
   - `onError`: calls `showError(message)`
5. Create `StateStore`
6. Create `CommandSender(connection)`
7. Call `connection.connect()`

### `handleStateUpdate(state: GameState)`

1. `store.setState(state)`
2. If game screen active, update header (round, phase)
3. If on setup screen and state has characters or round > 0, show Resume button

### `handleConnectionChange(status: ConnectionStatus)`

1. Update status dot and text
2. If status is `'connected'` and still on setup screen, show game setup options (hide connect form, show options)
3. If status is `'disconnected'`, update header status dot

### Setup option handlers

**New Game:** Call `enterGameScreen()`

**Import:** Toggle import panel visibility

**Import Submit:**
1. Read textarea value or file content
2. Try `JSON.parse()`
3. POST to `/api/import` with `{ gameCode, ghsState: parsed }`
4. On success: show success message, wait 1s, call `enterGameScreen()`
5. On error: show error message in import status div

**Import File Input change:**
```typescript
importFileInput.addEventListener('change', () => {
  const file = importFileInput.files?.[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = () => { importTextarea.value = reader.result as string; };
    reader.readAsText(file);
  }
});
```

**Resume:** Call `enterGameScreen()`

**Disconnect:** `connection.disconnect()`, reset to connect form

### `enterGameScreen()`

1. Hide setup screen (`setupScreen.classList.add('hidden')`)
2. Show game screen (`gameScreen.classList.remove('hidden')`)
3. Set `gameScreenActive = true`
4. Initialize tab navigation
5. Update header with current state from store
6. Show FAB container

### Tab navigation

```typescript
function initTabNavigation() {
  const tabBtns = document.querySelectorAll<HTMLButtonElement>('.tab-btn');
  const tabPanels = document.querySelectorAll<HTMLDivElement>('.tab-panel');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab!;
      tabBtns.forEach(b => b.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      // Map tab name to panel ID
      const panelId = 'tab' + tabId.charAt(0).toUpperCase() + tabId.slice(1);
      document.getElementById(panelId)?.classList.add('active');
    });
  });
}
```

### Menu

```typescript
headerMenuBtn.addEventListener('click', () => menuOverlay.classList.remove('hidden'));
menuCloseBtn.addEventListener('click', () => menuOverlay.classList.add('hidden'));
menuUndoBtn.addEventListener('click', () => { commands?.undoAction(); menuOverlay.classList.add('hidden'); });
menuExportBtn.addEventListener('click', () => { window.open(`/api/export/${gameCode}`); menuOverlay.classList.add('hidden'); });
menuDisconnectBtn.addEventListener('click', () => {
  connection?.disconnect();
  menuOverlay.classList.add('hidden');
  exitGameScreen();
});
```

### `exitGameScreen()`

1. Hide game screen, show setup screen
2. Set `gameScreenActive = false`
3. Reset to connect form (hide game setup options)

### Header update

```typescript
function updateHeader(state: GameState) {
  const roundEl = document.getElementById('headerRound')!;
  const phaseEl = document.getElementById('headerPhase')!;
  roundEl.textContent = state.round > 0 ? `Round ${state.round}` : 'Round —';
  phaseEl.textContent = state.state === 'draw' ? 'Card Selection' : 'Playing';
}
```

## STEP 5 — Update staticServer.ts if needed

Read `server/src/staticServer.ts`. Verify it serves:
- `/controller` → `clients/controller/index.html`
- `/controller/dist/*` → `clients/controller/dist/`
- `/controller/styles/*` → `clients/controller/styles/`
- `/shared/styles/*` → `clients/shared/styles/`

If the current static routes don't cover `styles/controller.css` or the `dist/` folder, add them. The HTML references:
- `/shared/styles/theme.css` (shared)
- `/shared/styles/typography.css` (shared)
- `/shared/styles/components.css` (shared)
- `styles/controller.css` (relative to /controller)
- `dist/main.js` (relative to /controller)

The simplest approach: serve `clients/controller/` as a static directory at `/controller`. Then all relative paths resolve naturally.

## STEP 6 — Verify end-to-end

Build and test:
```powershell
cd C:\Projects\gloomhaven-command
npm run build --workspace=packages/shared
npm run build --workspace=clients/controller
npx tsx server/src/index.ts
```

Open `http://localhost:3000/controller` in a browser. Verify:
1. Setup screen renders with dark parchment theme
2. Title and subtitle display correctly
3. Game code input accepts text
4. Connect button establishes WebSocket connection (check browser console)
5. After connecting, setup options appear (New Game, Import GHS Save)
6. If game has existing state, Resume button appears
7. Import panel opens, accepts JSON paste, file upload works
8. Import submits to `/api/import` and shows success/error
9. New Game transitions to game screen
10. All 5 tabs are clickable and switch panels
11. Header shows round and phase info
12. Menu opens/closes, Undo/Export/Disconnect work
13. No console errors

## STEP 7 — Update ROADMAP.md

Mark complete:
- [x] Scaffold controller HTML + TypeScript entry
- [x] Implement connection UI (setup screen)

## STEP 8 — Add DESIGN_DECISIONS.md entries

Append:

```markdown
### 2026-03-25 — Controller setup flow: Import + Manual
**Decision:** After connecting, controller shows "New Game" and "Import GHS Save"
options. No auto-detection of local GHS installations.
**Rationale:** Import provides migration path from existing GHS campaigns. Manual
new game is the clean-start path. Auto-detection adds complexity (needs server-side
filesystem access) with minimal benefit since import covers the use case.

### 2026-03-25 — Vanilla TypeScript with esbuild, no framework
**Decision:** Controller uses vanilla TypeScript with DOM manipulation, bundled
by esbuild. No React, Vue, or other framework.
**Rationale:** The controller is a single-page app with five tabs. State management
is handled by our own StateStore + Connection classes. A framework adds bundle size
and learning curve without proportional benefit for this use case. esbuild produces
a single JS file from TypeScript + workspace imports in <100ms.
```

## STEP 9 — Commit

```powershell
git add -A
git commit -m "feat(controller): scaffold controller app with connection screen and tab navigation

- index.html with setup screen and game screen structure
- controller.css with dark parchment theme, tab bar, responsive iPad layout
- main.ts entry point with Connection/StateStore/CommandSender wiring
- Setup flow: connect → New Game / Import GHS Save → game screen
- Tab navigation: Active Play, Monsters, Scenario, Loot & Decks, Campaign
- esbuild pipeline bundling shared packages + client lib
- Menu overlay with undo, export, disconnect
- Placeholder content in all 5 tab panels for Phase 2C-2E"
git push
```

Report: commit hash, esbuild output (file size of dist/main.js), and whether the page loads, connects, and transitions to the game screen successfully.
