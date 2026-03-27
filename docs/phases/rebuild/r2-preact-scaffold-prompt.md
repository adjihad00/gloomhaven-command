# R2 — Preact App Scaffold with Role Routing

> Paste into Claude Code. Scaffolds the Preact application with three separate
> entry points (controller, phone, display), shared hooks wrapping the existing
> connection/state infrastructure, mode routing (scenario/town), and working
> connection screens. After R2, all three apps boot, connect, and show placeholder
> views per mode.

---

Read CLAUDE.md, then docs/PROJECT_CONTEXT.md, then docs/APP_MODE_ARCHITECTURE.md
(the full document — it defines the app structure, mode flow, and per-role views).

Then read these existing files:
- `clients/shared/lib/connection.ts` — Connection class, ConnectionOptions, ConnectionStatus
- `clients/shared/lib/stateStore.ts` — StateStore class, derived getters
- `clients/shared/lib/commandSender.ts` — CommandSender class, all method signatures
- `clients/shared/styles/theme.css` — CSS variables
- `clients/shared/styles/typography.css` — font classes
- `clients/shared/styles/components.css` — shared component styles
- `server/src/staticServer.ts` — how client apps are served
- `packages/shared/src/types/gameState.ts` — GameState type
- `packages/shared/src/types/protocol.ts` — message types

## Context

We are replacing the vanilla 5-tab controller (`clients/controller/`) with a
Preact-based single-screen app. The new code lives in `app/` at the repo root.
The old `clients/controller/` code remains for reference but is no longer served.

The three entry points share a component library and hooks layer. Each produces
its own JS bundle via esbuild. The server serves each at its URL path.

## STEP 1 — Install Preact + dependencies

From the repo root:

```powershell
npm install preact --save
npm install esbuild --save-dev
```

Preact uses `h` and `Fragment` from `preact` and hooks from `preact/hooks`.
No JSX transform config needed if we use `/** @jsxImportSource preact */` pragma
or configure esbuild's JSX factory.

## STEP 2 — Create the app directory structure

```
app/
├── components/            # Shared Preact components (R3 fills these in)
│   └── Placeholder.tsx    # temporary placeholder component
├── hooks/                 # Shared Preact hooks wrapping existing infra
│   ├── useConnection.ts
│   ├── useGameState.ts
│   ├── useCommands.ts
│   └── useDataApi.ts
├── shared/
│   ├── styles/            # move/copy existing CSS here
│   │   ├── theme.css
│   │   ├── typography.css
│   │   └── components.css
│   ├── assets.ts          # asset URL helper functions
│   ├── context.ts         # Preact contexts for connection, state, commands
│   └── formatName.ts      # shared utility (from old controller utils.ts)
├── controller/
│   ├── main.tsx           # entry point
│   ├── index.html
│   ├── App.tsx            # root component with mode routing
│   ├── ConnectionScreen.tsx
│   ├── ScenarioView.tsx   # placeholder (R4 implements)
│   ├── TownView.tsx       # placeholder (Phase T implements)
│   └── styles/
│       └── controller.css
├── phone/
│   ├── main.tsx           # entry point
│   ├── index.html
│   ├── App.tsx            # root component with mode routing
│   ├── ConnectionScreen.tsx
│   ├── ScenarioView.tsx   # placeholder (R4 implements)
│   ├── TownView.tsx       # placeholder (Phase T implements)
│   └── styles/
│       └── phone.css
├── display/
│   ├── main.tsx           # entry point
│   ├── index.html
│   ├── App.tsx            # root component with mode routing
│   ├── ConnectionScreen.tsx
│   ├── ScenarioView.tsx   # placeholder (R4 implements)
│   ├── TownView.tsx       # placeholder (Phase T implements)
│   └── styles/
│       └── display.css
└── build.mjs             # single build script for all three entry points
```

## STEP 3 — Implement the build script

Create `app/build.mjs`:

Three parallel esbuild builds from one script. Each entry point produces its
own bundle in its own `dist/` folder.

```javascript
import * as esbuild from 'esbuild';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes('--watch');

const sharedConfig = {
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: ['es2022'],
  sourcemap: true,
  minify: !watch,
  jsx: 'automatic',
  jsxImportSource: 'preact',
  loader: { '.ts': 'ts', '.tsx': 'tsx' },
  alias: {
    'react': 'preact/compat',
    'react-dom': 'preact/compat',
    '@gloomhaven-command/shared': resolve(__dirname, '../packages/shared/src/index.ts'),
  },
  logLevel: 'info',
};

const entryPoints = [
  { name: 'controller', entry: 'controller/main.tsx', out: 'controller/dist/main.js' },
  { name: 'phone',      entry: 'phone/main.tsx',      out: 'phone/dist/main.js' },
  { name: 'display',    entry: 'display/main.tsx',     out: 'display/dist/main.js' },
];

async function build() {
  for (const ep of entryPoints) {
    const config = {
      ...sharedConfig,
      entryPoints: [resolve(__dirname, ep.entry)],
      outfile: resolve(__dirname, ep.out),
    };

    if (watch) {
      const ctx = await esbuild.context(config);
      await ctx.watch();
      console.log(`Watching ${ep.name}...`);
    } else {
      await esbuild.build(config);
      console.log(`Built ${ep.name}`);
    }
  }
}

build().catch(err => { console.error(err); process.exit(1); });
```

Add scripts to root `package.json`:
```json
{
  "scripts": {
    "build:app": "node app/build.mjs",
    "watch:app": "node app/build.mjs --watch",
    "dev": "concurrently \"npx tsx server/src/index.ts\" \"node app/build.mjs --watch\""
  }
}
```

If `concurrently` isn't available, the dev script can just be the server (run
`watch:app` in a separate terminal). Don't add concurrently as a dependency
unless it's already installed.

## STEP 4 — Create the shared Preact context

Create `app/shared/context.ts`:

This provides React-style context for the connection, state, and commands so
any component in the tree can access them via hooks.

```tsx
import { createContext } from 'preact';
import type { Connection, ConnectionStatus } from '../../clients/shared/lib/connection';
import type { StateStore } from '../../clients/shared/lib/stateStore';
import type { CommandSender } from '../../clients/shared/lib/commandSender';
import type { GameState } from '@gloomhaven-command/shared';

export interface AppContextValue {
  connection: Connection | null;
  store: StateStore | null;
  commands: CommandSender | null;
  state: GameState | null;
  connectionStatus: ConnectionStatus;
  gameCode: string;
  error: string | null;
}

export const AppContext = createContext<AppContextValue>({
  connection: null,
  store: null,
  commands: null,
  state: null,
  connectionStatus: 'disconnected',
  gameCode: '',
  error: null,
});
```

## STEP 5 — Implement shared hooks

These hooks wrap the existing `Connection`, `StateStore`, and `CommandSender`
classes from `clients/shared/lib/` as Preact hooks. The classes remain unchanged —
hooks are a reactive wrapper.

### `app/hooks/useConnection.ts`

```tsx
import { useState, useCallback, useRef, useEffect } from 'preact/hooks';
import { Connection } from '../../clients/shared/lib/connection';
import { StateStore } from '../../clients/shared/lib/stateStore';
import { CommandSender } from '../../clients/shared/lib/commandSender';
import type { ConnectionStatus } from '../../clients/shared/lib/connection';
import type { GameState } from '@gloomhaven-command/shared';

export interface UseConnectionReturn {
  connection: Connection | null;
  store: StateStore | null;
  commands: CommandSender | null;
  state: GameState | null;
  status: ConnectionStatus;
  error: string | null;
  connect: (gameCode: string) => void;
  disconnect: () => void;
}

export function useConnection(): UseConnectionReturn {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [state, setState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const connectionRef = useRef<Connection | null>(null);
  const storeRef = useRef<StateStore | null>(null);
  const commandsRef = useRef<CommandSender | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      connectionRef.current?.disconnect();
    };
  }, []);

  const connect = useCallback((gameCode: string) => {
    // Disconnect existing
    connectionRef.current?.disconnect();

    const store = new StateStore();
    storeRef.current = store;

    const connection = new Connection({
      gameCode,
      onStateUpdate: (newState: GameState) => {
        store.setState(newState);
        setState(newState);
      },
      onConnectionChange: (newStatus: ConnectionStatus) => {
        setStatus(newStatus);
      },
      onError: (message: string) => {
        setError(message);
      },
    });

    connectionRef.current = connection;
    commandsRef.current = new CommandSender(connection);

    setError(null);
    connection.connect();
  }, []);

  const disconnect = useCallback(() => {
    connectionRef.current?.disconnect();
    connectionRef.current = null;
    commandsRef.current = null;
    setState(null);
    setStatus('disconnected');
  }, []);

  return {
    connection: connectionRef.current,
    store: storeRef.current,
    commands: commandsRef.current,
    state,
    status,
    error,
    connect,
    disconnect,
  };
}
```

### `app/hooks/useGameState.ts`

A convenience hook that reads from context and provides derived values:

```tsx
import { useContext, useMemo } from 'preact/hooks';
import { AppContext } from '../shared/context';
import type { GameState, Character, Monster } from '@gloomhaven-command/shared';

export function useGameState() {
  const { state } = useContext(AppContext);

  return useMemo(() => ({
    state,
    characters: state?.characters ?? [],
    monsters: state?.monsters ?? [],
    elementBoard: state?.elementBoard ?? [],
    round: state?.round ?? 0,
    phase: state?.state ?? 'draw',
    level: state?.level ?? 1,
    figures: state?.figures ?? [],
    scenario: state?.scenario ?? null,
    edition: state?.edition ?? 'gh',
    revision: state?.revision ?? 0,
    lootDeck: state?.lootDeck ?? null,
    party: state?.party ?? null,

    getCharacter: (name: string): Character | null =>
      state?.characters.find(c => c.name === name) ?? null,

    getMonster: (name: string): Monster | null =>
      state?.monsters.find(m => m.name === name) ?? null,

    // Player count (non-absent, non-exhausted)
    playerCount: (state?.characters ?? [])
      .filter(c => !c.absent && !c.exhausted).length,
  }), [state]);
}
```

### `app/hooks/useCommands.ts`

```tsx
import { useContext } from 'preact/hooks';
import { AppContext } from '../shared/context';

export function useCommands() {
  const { commands } = useContext(AppContext);
  if (!commands) throw new Error('useCommands used outside of connected AppContext');
  return commands;
}
```

### `app/hooks/useDataApi.ts`

Fetch helper for the data API endpoints added in R1:

```tsx
import { useState, useEffect } from 'preact/hooks';

export function useDataApi<T>(path: string, enabled: boolean = true): {
  data: T | null;
  loading: boolean;
  error: string | null;
} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !path) return;

    setLoading(true);
    setError(null);

    fetch(`/api/data/${path}`)
      .then(res => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
      })
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [path, enabled]);

  return { data, loading, error };
}

// Typed convenience hooks
export function useEditions() {
  return useDataApi<string[]>('editions');
}

export function useCharacterList(edition: string) {
  return useDataApi<any[]>(`${edition}/characters`, !!edition);
}

export function useMonsterList(edition: string) {
  return useDataApi<any[]>(`${edition}/monsters`, !!edition);
}

export function useScenarioList(edition: string) {
  return useDataApi<any[]>(`${edition}/scenarios`, !!edition);
}
```

## STEP 6 — Copy shared styles

Copy the existing CSS files from `clients/shared/styles/` to `app/shared/styles/`:
- `theme.css`
- `typography.css`
- `components.css`

These are the authoritative copies going forward.

## STEP 7 — Create shared utilities

### `app/shared/formatName.ts`

```tsx
export function formatName(name: string): string {
  return name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
```

### `app/shared/assets.ts`

```tsx
// Asset URL helpers — all assets served at /assets/ by the server
export function characterThumbnail(edition: string, name: string): string {
  return `/assets/images/character/thumbnail/${edition}-${name}.png`;
}

export function monsterThumbnail(edition: string, name: string): string {
  return `/assets/images/monster/thumbnail/${edition}-${name}.png`;
}

export function conditionIcon(name: string): string {
  return `/assets/images/condition/${name}.svg`;
}

export function elementIcon(name: string): string {
  return `/assets/images/element/${name}.svg`;
}
```

## STEP 8 — Create placeholder component

`app/components/Placeholder.tsx`:

```tsx
interface Props {
  label: string;
  description?: string;
}

export function Placeholder({ label, description }: Props) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '300px', color: 'var(--text-muted)',
      fontSize: '1.1rem', gap: '8px',
    }}>
      <span>{label}</span>
      {description && <span style={{ fontSize: '0.85rem' }}>{description}</span>}
    </div>
  );
}
```

## STEP 9 — Implement Controller entry point

### `app/controller/index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <meta name="theme-color" content="#1a1410">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <title>Gloomhaven Command — Controller</title>
    <link rel="stylesheet" href="/app/shared/styles/theme.css">
    <link rel="stylesheet" href="/app/shared/styles/typography.css">
    <link rel="stylesheet" href="/app/shared/styles/components.css">
    <link rel="stylesheet" href="/app/controller/styles/controller.css">
</head>
<body>
    <div id="root"></div>
    <script type="module" src="/app/controller/dist/main.js"></script>
</body>
</html>
```

### `app/controller/main.tsx`

```tsx
import { render } from 'preact';
import { App } from './App';

render(<App />, document.getElementById('root')!);
```

### `app/controller/App.tsx`

The root component. Manages connection and provides context to the tree.

```tsx
import { useState } from 'preact/hooks';
import { AppContext } from '../shared/context';
import { useConnection } from '../hooks/useConnection';
import { ConnectionScreen } from './ConnectionScreen';
import { ScenarioView } from './ScenarioView';
import { TownView } from './TownView';
import { Placeholder } from '../components/Placeholder';

export function App() {
  const { connection, store, commands, state, status, error, connect, disconnect } = useConnection();
  const [gameCode, setGameCode] = useState(localStorage.getItem('gc_gameCode') || '');

  const handleConnect = (code: string) => {
    setGameCode(code);
    localStorage.setItem('gc_gameCode', code);
    connect(code);
  };

  // Not connected — show connection screen
  if (!state || status === 'disconnected') {
    return (
      <ConnectionScreen
        gameCode={gameCode}
        status={status}
        error={error}
        onConnect={handleConnect}
        onDisconnect={disconnect}
        hasExistingGame={state !== null && (state.characters.length > 0 || state.round > 0)}
      />
    );
  }

  // Connected — provide context and route by mode
  return (
    <AppContext.Provider value={{
      connection, store, commands, state, connectionStatus: status,
      gameCode, error,
    }}>
      <AppShell state={state} onDisconnect={disconnect} gameCode={gameCode} />
    </AppContext.Provider>
  );
}

function AppShell({ state, onDisconnect, gameCode }: {
  state: any; onDisconnect: () => void; gameCode: string;
}) {
  // Mode routing — GameState may not have 'mode' yet; default to scenario
  const mode = (state as any).mode ?? 'scenario';

  return (
    <div class="app-shell">
      {mode === 'town'
        ? <TownView />
        : <ScenarioView />
      }
    </div>
  );
}
```

### `app/controller/ConnectionScreen.tsx`

Port the connection flow from the old controller. Use Preact components instead
of DOM manipulation. Include:
- Game code input
- Connect button with status indicator
- Post-connect options: New Game, Import GHS Save, Resume (if existing game)
- Import panel with textarea + file upload
- Disconnect button

Read the old `clients/controller/src/main.ts` for the exact logic flow, then
rewrite as Preact components with `useState` for UI state.

The connection screen should look identical to the old one — same dark parchment
theme, same layout. The CSS is in `app/controller/styles/controller.css` — copy
relevant styles from `clients/controller/styles/controller.css`.

### `app/controller/ScenarioView.tsx`

Placeholder for R4:

```tsx
import { Placeholder } from '../components/Placeholder';

export function ScenarioView() {
  return <Placeholder label="Scenario View" description="R4 implements the GHS-style single-screen controller" />;
}
```

### `app/controller/TownView.tsx`

Placeholder for Phase T:

```tsx
import { Placeholder } from '../components/Placeholder';

export function TownView() {
  return <Placeholder label="Town Mode" description="Phase T implements the outpost phase workflow" />;
}
```

### Controller CSS

Create `app/controller/styles/controller.css`. Port the connection screen and
app shell styles from `clients/controller/styles/controller.css`. Only the
connection/setup screen styles and the base `.app-shell` layout. Don't port the
old tab navigation or Active Play styles — those are being replaced.

The `.app-shell` should be a full-viewport container:
```css
.app-shell {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  position: relative;
  z-index: 1;
}
```

## STEP 10 — Implement Phone entry point

### `app/phone/index.html`

Same structure as controller but with phone title and phone CSS:
```html
<title>Gloomhaven Command — Player</title>
<link rel="stylesheet" href="/app/phone/styles/phone.css">
<script type="module" src="/app/phone/dist/main.js"></script>
```

### `app/phone/main.tsx`

Same pattern as controller: `render(<App />, root)`.

### `app/phone/App.tsx`

Same structure as controller App but the connection screen asks for character
selection after connecting. Add a character picker step:

```tsx
// After connecting, phone needs to select a character
const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);

// If connected but no character selected, show character picker
if (state && !selectedCharacter) {
  return <CharacterPicker characters={state.characters} onSelect={setSelectedCharacter} />;
}
```

The `CharacterPicker` shows available characters as cards. Tapping one selects
it and transitions to the game view. Store selection in localStorage.

### `app/phone/ConnectionScreen.tsx`

Simpler than controller — no import option. Just game code + connect. After
connect, character picker appears.

### `app/phone/ScenarioView.tsx` and `TownView.tsx`

Placeholders.

### Phone CSS

Create `app/phone/styles/phone.css`. Minimal for now — connection screen styles
adapted for portrait layout with max-width 480px.

## STEP 11 — Implement Display entry point

### `app/display/index.html`

Same structure, display title, display CSS.

### `app/display/main.tsx`

Same render pattern.

### `app/display/App.tsx`

Display is read-only. Connection screen is simpler — just game code input, no
setup options. Auto-connect if game code is saved.

After connecting, immediately show the scenario or town view. No setup flow needed.

```tsx
if (!state) return <ConnectionScreen ... />;
const mode = (state as any).mode ?? 'scenario';
return (
  <AppContext.Provider value={...}>
    {mode === 'town' ? <TownView /> : <ScenarioView />}
  </AppContext.Provider>
);
```

### `app/display/ConnectionScreen.tsx`

Minimal: game code input + connect button. No import, no character selection.
Consider auto-reconnect on page load if game code is saved.

### `app/display/ScenarioView.tsx` and `TownView.tsx`

Placeholders.

### Display CSS

Create `app/display/styles/display.css`. Minimal — full-viewport, portrait
orientation hint.

## STEP 12 — Update the server to serve the new app

Edit `server/src/staticServer.ts`:

Add routes for the new Preact app alongside (or replacing) the old controller routes:

```typescript
// New Preact app routes
app.use('/app', express.static(resolve(rootDir, 'app'), { /* cache headers */ }));

// Route /controller → app/controller/index.html
app.get('/controller', (req, res) => {
  res.sendFile(resolve(rootDir, 'app/controller/index.html'));
});
app.get('/phone', (req, res) => {
  res.sendFile(resolve(rootDir, 'app/phone/index.html'));
});
app.get('/display', (req, res) => {
  res.sendFile(resolve(rootDir, 'app/display/index.html'));
});

// Root redirects to controller
app.get('/', (req, res) => res.redirect('/controller'));
```

The `/app` static mount serves all app files (JS bundles, CSS, etc.) from
their relative paths. Each HTML file uses absolute paths starting with `/app/`.

If the old `clients/` routes conflict, remove or comment them out. The old code
stays in the repo for reference but isn't served.

## STEP 13 — Add tsconfig for the app

Create `app/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "jsxImportSource": "preact",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": ".",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "declaration": false,
    "paths": {
      "@gloomhaven-command/shared": ["../packages/shared/src/index.ts"]
    }
  },
  "include": [
    "**/*.ts",
    "**/*.tsx"
  ],
  "exclude": ["**/dist"]
}
```

## STEP 14 — Verify

### Build

```powershell
cd C:\Projects\gloomhaven-command
npm run build --workspace=packages/shared
node app/build.mjs
```

All three bundles should build without errors. Check sizes:
```powershell
Get-Item app/controller/dist/main.js | Select-Object Length
Get-Item app/phone/dist/main.js | Select-Object Length
Get-Item app/display/dist/main.js | Select-Object Length
```

### Boot and test

```powershell
npx tsx server/src/index.ts
```

Open in browser:
- `http://localhost:3000/controller` — controller connection screen
- `http://localhost:3000/phone` — phone connection screen
- `http://localhost:3000/display` — display connection screen

Verify per role:

**Controller:**
1. Connection screen renders with dark parchment theme
2. Game code input works
3. Connect button establishes WebSocket connection
4. After connecting: New Game / Import / Resume options appear
5. Clicking New Game shows ScenarioView placeholder
6. Import flow works (paste JSON, submit to /api/import)
7. Disconnect returns to connection screen

**Phone:**
1. Connection screen renders (portrait-optimized)
2. Connect works
3. After connecting: character picker appears (shows characters from game state)
4. Selecting a character shows ScenarioView placeholder
5. If no characters exist, shows appropriate empty state

**Display:**
1. Connection screen renders (minimal)
2. Connect works
3. Immediately shows ScenarioView placeholder after connecting
4. No setup flow needed

**Cross-device:**
5. Open controller and display to same game code
6. Both show connected state
7. No errors in console

### Type check

```powershell
npx tsc --noEmit --project app/tsconfig.json
```

Fix any type errors.

## STEP 15 — Update documentation

### ROADMAP.md

Update Phase R section:
```markdown
## Phase R: Controller Rebuild
- [x] R1: Data layer — edition file loading, stat lookups, scenario auto-spawn
- [x] R2: Preact app scaffold — three entry points, hooks, mode routing, connection screens
- [ ] R3: Core shared components
- [ ] R4: Controller single-screen view
- [ ] R5: Scenario automation
- [ ] R6: Round flow automation
```

### DESIGN_DECISIONS.md

Append:
```markdown
### 2026-03-26 — Separate Preact entry points per device role
**Decision:** Three entry points (controller/phone/display) sharing a component
library, not one monolithic app with role conditionals.
**Rationale:** Each device role has fundamentally different interaction patterns
(landscape/portrait, GM/player/read-only). Separate entry points give each device
only the code it needs via tree-shaking. Shared components are the reuse mechanism.
A phone downloads ~15KB, not 80KB+ of controller overlays it never renders.
```

## STEP 16 — Commit

```powershell
git add -A
git commit -m "feat: Preact app scaffold with three entry points and mode routing

- app/controller: iPad GM entry with connection screen + import flow
- app/phone: player entry with character picker
- app/display: read-only entry with minimal connection flow
- Shared hooks: useConnection, useGameState, useCommands, useDataApi
- AppContext for Preact context-based state propagation
- Mode routing: scenario/town views per role (placeholders)
- esbuild build script producing three parallel bundles
- Server updated to serve new Preact app at /controller, /phone, /display
- Shared styles, asset helpers, formatName utility"
git push
```

Report: commit hash, bundle sizes for all three entry points, and whether all
three apps connect successfully in the browser.
