# Batch 11 — PWA + Connection + Setup Flow + Loot Deck

> Paste this entire file into Claude Code. Read `RESPONSE_CONTRACT.md` before
> implementing. Execute all 4 fixes, then run the verification checklist.

---

## Fix 11.1 — PWA standalone mode: manifest + service worker

### Problem
The controller has `apple-mobile-web-app-capable` meta tag but no `manifest.json`
and no service worker. When added to iPad home screen, the app launches in standalone
mode but can't resolve the server URL (no `location.host` in standalone) and has no
offline shell caching.

### Fix
Create a minimal PWA setup — manifest + service worker that caches the app shell.

**1. Create `app/controller/manifest.json`:**
```json
{
  "name": "Gloomhaven Command — Controller",
  "short_name": "GH Command",
  "start_url": "/controller",
  "display": "standalone",
  "orientation": "landscape",
  "background_color": "#1a1410",
  "theme_color": "#1a1410",
  "icons": [
    { "src": "/assets/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/assets/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

**2. Create `app/controller/sw.js`** — a minimal service worker:
```javascript
const CACHE_NAME = 'gc-controller-v1';
const APP_SHELL = [
  '/controller',
  '/app/shared/styles/theme.css',
  '/app/shared/styles/typography.css',
  '/app/shared/styles/components.css',
  '/app/shared/styles/connection.css',
  '/app/controller/styles/controller.css',
  '/app/controller/dist/main.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache WebSocket, API calls, or asset data
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/assets/')) {
    return;
  }

  // Cache-first for app shell, network-first for everything else
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        // Cache successful GET responses
        if (event.request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
```

**3. Update `app/controller/index.html`** — add manifest link and SW registration:

After the existing `<meta>` tags, add:
```html
<link rel="manifest" href="/app/controller/manifest.json">
```

Before the closing `</body>` tag, add:
```html
<script>
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/app/controller/sw.js', { scope: '/controller' })
      .catch(err => console.warn('SW registration failed:', err));
  }
</script>
```

**4. Update `server/src/staticServer.ts`** — ensure the service worker is served
with proper scope. Add before the default route:
```typescript
// Service worker — must be served from /app/controller/ with correct scope
app.get('/app/controller/sw.js', (req, res) => {
  res.setHeader('Service-Worker-Allowed', '/controller');
  res.sendFile(join(rootDir, 'app/controller/sw.js'));
});
```

**5. Create placeholder icons** — the manifest needs icon files. Create
`assets/icon-192.png` and `assets/icon-512.png` as simple placeholder images.
Use a bash command to generate minimal PNGs (solid dark squares), or instruct
the user to add proper icons later. At minimum, create a comment in the manifest
noting that icons need to be provided.

### Files
- `app/controller/manifest.json` (new)
- `app/controller/sw.js` (new)
- `app/controller/index.html`
- `server/src/staticServer.ts`

---

## Fix 11.2 — WebSocket reconnect on iOS foreground

### Problem
`clients/shared/lib/connection.ts` (line 46-51) has a `visibilitychange` handler
that reconnects when `status !== 'connected'`. But iOS aggressively kills WebSocket
connections during background/sleep. The browser may still report the WS as "open"
even though the server has dropped it. Result: the app looks connected but commands
silently fail.

### Fix
Add an active health check on foreground return. Three changes to `connection.ts`:

**1. Add a heartbeat check on visibility change** (replace lines 46-51):
```typescript
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  if (this.manualDisconnect) return;

  if (this.status !== 'connected') {
    // Already know we're disconnected — reconnect immediately
    this.reconnectAttempts = 0;
    this.connect();
    return;
  }

  // Status says connected, but WS may be silently dead
  // Send a health-check ping and wait for server response
  this.checkConnectionHealth();
});
```

**2. Add the health check method** to the `Connection` class:
```typescript
private healthCheckTimeout: ReturnType<typeof setTimeout> | null = null;
private awaitingHealthCheck: boolean = false;

private checkConnectionHealth(): void {
  if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
    // WS is already dead — reconnect
    this.reconnectAttempts = 0;
    this.connect();
    return;
  }

  // Send a ping and expect a pong (or any server message) within 5 seconds
  this.awaitingHealthCheck = true;
  try {
    this.ws.send(JSON.stringify({ type: 'pong' }));
  } catch {
    // Send failed — connection is dead
    this.reconnectAttempts = 0;
    this.connect();
    return;
  }

  this.healthCheckTimeout = setTimeout(() => {
    if (this.awaitingHealthCheck) {
      // No response within 5s — force reconnect
      console.warn('Health check timeout — forcing reconnect');
      this.awaitingHealthCheck = false;
      this.reconnectAttempts = 0;
      this.connect();
    }
  }, 5000);
}
```

**3. Clear the health check flag** when any message is received. In the existing
`ws.onmessage` handler (line 86), add at the top of the callback:
```typescript
// Any message from server means connection is alive
if (this.awaitingHealthCheck) {
  this.awaitingHealthCheck = false;
  if (this.healthCheckTimeout) {
    clearTimeout(this.healthCheckTimeout);
    this.healthCheckTimeout = null;
  }
}
```

**4. Clean up timeouts** in the `disconnect()` method — add:
```typescript
if (this.healthCheckTimeout) {
  clearTimeout(this.healthCheckTimeout);
  this.healthCheckTimeout = null;
}
this.awaitingHealthCheck = false;
```

### Files
- `clients/shared/lib/connection.ts`

---

## Fix 11.3 — Guided setup wizard: Edition → Party → Scenario

### Problem
`ScenarioSetupOverlay` shows edition selection, party, and scenario list all in one
scrollable panel. For a new game, the user should be guided through a sequence:
Step 1 (edition), Step 2 (add characters), Step 3 (select scenario).

When characters already exist, the overlay should open directly to the scenario step
since edition and party are already configured.

### Fix
Convert `SetupStep` to a multi-step wizard.

**1. Update the `SetupStep` type** (line 16):
```typescript
type SetupStep = 'edition' | 'party' | 'scenario' | 'scenarioPreview';
```

**2. Update initial step logic** (line 25):
```typescript
const [step, setStep] = useState<SetupStep>(() => {
  // If characters exist, skip to scenario selection
  if (state.characters.length > 0) return 'scenario';
  // If edition is set, skip to party
  if (state.edition) return 'party';
  return 'edition';
});
```

**3. Replace the main setup step rendering** (everything inside the `// ── Main Setup Step ──`
section, ~line 205 onward) with a step-based structure:

```tsx
// ── Edition Step ──
if (step === 'edition') {
  return (
    <OverlayBackdrop onClose={onClose} position="right">
      <div class="setup-overlay">
        <h2 class="setup-overlay__title">Select Edition</h2>
        <div class="setup-overlay__section">
          <div class="edition-grid">
            {(editions ?? []).map(ed => (
              <button
                key={ed}
                class={`edition-card ${selectedEdition === ed ? 'edition-card--active' : ''}`}
                onClick={() => {
                  setSelectedEdition(ed);
                  // TODO: if needed, send edition command to server
                }}
              >
                <span class="edition-card__name">{ed.toUpperCase()}</span>
              </button>
            ))}
          </div>
        </div>
        <div class="setup-wizard__nav">
          <button class="btn" onClick={onClose}>Cancel</button>
          <button class="btn btn-primary" onClick={() => setStep('party')}
            disabled={!selectedEdition}>
            Next: Add Characters
          </button>
        </div>
      </div>
    </OverlayBackdrop>
  );
}

// ── Party Step ──
if (step === 'party') {
  return (
    <OverlayBackdrop onClose={onClose} position="right">
      <div class="setup-overlay">
        <h2 class="setup-overlay__title">Build Party</h2>

        {/* Current party members */}
        <div class="setup-overlay__section">
          <label class="setup-overlay__label">
            Party ({state.characters.length} character{state.characters.length !== 1 ? 's' : ''})
          </label>
          {state.characters.map(c => (
            <div key={`${c.edition}-${c.name}`} class="setup-overlay__char-row">
              <span class="setup-overlay__char-name">{formatName(c.name)}</span>
              <span class="setup-overlay__char-level">Lv {c.level}</span>
              <span class="setup-overlay__char-hp">{c.health}/{c.maxHealth} HP</span>
              <button class="btn setup-overlay__remove-btn"
                onClick={() => commands.removeCharacter(c.name, c.edition)}>
                &times;
              </button>
            </div>
          ))}
        </div>

        {/* Add character section (level selector + class grid) */}
        <div class="setup-overlay__section">
          <label class="setup-overlay__label">Add Character</label>
          <div class="setup-overlay__level-row">
            <span class="setup-overlay__level-label">Level:</span>
            {[1,2,3,4,5,6,7,8,9].map(lvl => (
              <button key={lvl}
                class={`btn setup-overlay__level-pip ${lvl === newCharLevel ? 'btn-primary' : ''}`}
                onClick={() => setNewCharLevel(lvl)}>
                {lvl}
              </button>
            ))}
          </div>
          <div class="char-class-grid">
            {availableClasses.map((c: any) => {
              const hpAtLevel = c.stats?.find((s: any) => s.level === newCharLevel)?.health ?? '?';
              return (
                <button key={c.name} class="char-class-card"
                  style={c.color ? { borderColor: c.color } : undefined}
                  onClick={() => handleAddCharacter(c.name)}>
                  <img src={characterThumbnail(selectedEdition, c.name)}
                    alt={formatName(c.name)} class="char-class-card__thumb" loading="lazy" />
                  <span class="char-class-card__name">{formatName(c.name)}</span>
                  <span class="char-class-card__hp">HP: {hpAtLevel}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div class="setup-wizard__nav">
          <button class="btn" onClick={() => setStep('edition')}>Back: Edition</button>
          <button class="btn btn-primary" onClick={() => setStep('scenario')}
            disabled={state.characters.length === 0}>
            Next: Select Scenario
          </button>
        </div>
      </div>
    </OverlayBackdrop>
  );
}

// ── Scenario Step ──
if (step === 'scenario') {
  return (
    <OverlayBackdrop onClose={onClose} position="right">
      <div class="setup-overlay">
        <h2 class="setup-overlay__title">Select Scenario</h2>

        {/* Scenario Level */}
        <div class="setup-overlay__section">
          {/* ... existing level info, level buttons, difficulty selector ... */}
          {/* Copy from the current main step — the level-info, level-buttons, and difficulty-selector blocks */}
        </div>

        {/* Scenario search + list */}
        <div class="setup-overlay__section">
          {/* ... existing scenario search, showAll toggle, filtered list, scenario cards ... */}
          {/* Copy from the current main step — the scenario search, filter, and card grid */}
        </div>

        <div class="setup-wizard__nav">
          <button class="btn" onClick={() => setStep('party')}>Back: Party</button>
        </div>
      </div>
    </OverlayBackdrop>
  );
}
```

**Important:** The scenario step should contain ALL of the existing scenario-related
UI from the current `main` step: the level info, level buttons, difficulty selector,
scenario search, show-all toggle, filtered scenario list, and the scenario cards that
navigate to `scenarioPreview`. Move these blocks as-is from the current rendering.

**4. Add CSS** to `app/controller/styles/controller.css`:
```css
/* Setup wizard navigation */
.setup-wizard__nav {
  display: flex;
  justify-content: space-between;
  padding: var(--space-4) 0;
  border-top: 1px solid var(--accent-copper);
  margin-top: var(--space-4);
}

/* Edition cards */
.edition-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: var(--space-3);
}

.edition-card {
  background: var(--bg-secondary);
  border: 2px solid var(--text-muted);
  border-radius: var(--radius-md);
  padding: var(--space-4) var(--space-3);
  cursor: pointer;
  touch-action: manipulation;
  text-align: center;
  transition: all var(--transition-fast);
}

.edition-card--active {
  border-color: var(--accent-gold);
  background: linear-gradient(135deg, var(--bg-secondary), rgba(212, 175, 55, 0.1));
}

.edition-card__name {
  font-family: 'Cinzel', serif;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-primary);
}
```

### Files
- `app/controller/overlays/ScenarioSetupOverlay.tsx`
- `app/controller/styles/controller.css`

---

## Fix 11.4 — FH loot deck not appearing

### Problem
`handleSetScenario()` in `packages/shared/src/engine/applyCommand.ts` does not
build a loot deck from `scenario.lootDeckConfig`. FH scenarios have `lootDeckConfig`
in their JSON data (e.g., `{ "money": 6, "lumber": 2, "metal": 2, "hide": 2 }`).
The loot deck stays empty (`cards: []`) so the footer badge never shows.

Per GAME_RULES_REFERENCE.md §9: The loot deck is built per scenario from money cards
(1-3 coins each), material resources, herb resources, and random item cards. The
specified number of each type is randomly drawn, then all shuffled together.

### Fix

**1. Add `buildLootDeck()`** to `packages/shared/src/engine/applyCommand.ts`
(or a new utility file):

```typescript
function buildLootDeck(config: Record<string, number>): LootDeck {
  const cards: LootCard[] = [];
  let cardId = 1;

  for (const [type, count] of Object.entries(config)) {
    if (count <= 0) continue;
    const lootType = type as LootType;

    for (let i = 0; i < count; i++) {
      // Money cards: value varies by player count
      // 4P values: random 1-3 coins; 3P/2P scale down
      const isMoney = lootType === 'money';
      const coinValue = isMoney ? (i % 3) + 1 : 0;  // cycle 1,2,3,1,2,3...

      cards.push({
        type: lootType,
        cardId: cardId++,
        value4P: isMoney ? coinValue : 1,
        value3P: isMoney ? coinValue : 1,
        value2P: isMoney ? Math.max(1, coinValue - 1) : 1,
        enhancements: 0,
      });
    }
  }

  // Fisher-Yates shuffle
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }

  return {
    current: 0,
    cards,
    active: true,
  };
}
```

**2. Call `buildLootDeck()`** in `handleSetScenario()` after the monster spawn
block (~line 1247). Add inside the existing `if (dataContext)` block:

```typescript
// Build loot deck from scenario config (FH only)
if (scenario.lootDeckConfig && Object.keys(scenario.lootDeckConfig).length > 0) {
  state.lootDeck = buildLootDeck(scenario.lootDeckConfig);
} else {
  // GH scenarios don't have loot decks — reset to empty
  state.lootDeck = { current: 0, cards: [], active: false };
}
```

**3. Add the `LootType` import** at the top of `applyCommand.ts` if not already
present:
```typescript
import type { ..., LootCard, LootDeck, LootType } from '../types/gameState.js';
```

**4. Verify the footer badge** in `app/components/ScenarioFooter.tsx` (line 92-96):
```tsx
{lootDeck && lootDeck.cards && lootDeck.cards.length > 0 && (
  <button class="loot-deck-badge" ...>
```
This condition is correct — it will now show when `buildLootDeck` populates cards.
No UI changes needed.

### Files
- `packages/shared/src/engine/applyCommand.ts`

---

## Verification Checklist

```
[ ] npm run build completes without errors

PWA (11.1):
[ ] manifest.json served at /app/controller/manifest.json
[ ] sw.js served at /app/controller/sw.js
[ ] index.html has <link rel="manifest"> tag
[ ] index.html has serviceWorker.register() script
[ ] Chrome DevTools → Application → Manifest shows correct data
[ ] Chrome DevTools → Application → Service Workers shows active SW

Connection (11.2):
[ ] Put iPad to sleep for 30 seconds, wake → app reconnects automatically
[ ] Minimize browser for 1 minute, return → app reconnects
[ ] No "Connection lost" error after brief sleep
[ ] Console shows "Health check timeout — forcing reconnect" if WS died

Setup wizard (11.3):
[ ] New game (no characters): opens to edition step
[ ] Edition step: edition cards visible, "Next: Add Characters" button
[ ] Party step: class grid, level selector, party list, "Next: Select Scenario"
[ ] Party step: Back button returns to edition
[ ] Scenario step: level info, scenario list, search, difficulty
[ ] Scenario step: Back button returns to party
[ ] Existing game (has characters): opens directly to scenario step
[ ] Scenario preview → Start Scenario still works

Loot deck (11.4):
[ ] Start FH scenario: loot deck badge appears in footer
[ ] Loot deck badge shows correct card count (sum of lootDeckConfig values)
[ ] Tap badge → loot deck overlay opens
[ ] Draw card → shows resource type (lumber, metal, hide, etc.)
[ ] GH scenario: loot deck badge NOT shown (correct — GH has no loot deck)
```

## Commit Message

```
feat(batch-11): PWA + reconnect + setup wizard + FH loot deck

- Add manifest.json and service worker for PWA standalone mode
- Add active health check on iOS foreground return (visibilitychange)
- Refactor ScenarioSetupOverlay into guided Edition→Party→Scenario wizard
- Build FH loot deck from scenario.lootDeckConfig on scenario start
```
