# Batch 13 — UI/UX + Connection Fixes

> Paste this entire file into Claude Code. Read `RESPONSE_CONTRACT.md` and
> `app/CONVENTIONS.md` before implementing. Execute all 5 fixes, then run
> the verification checklist.

---

## Fix 13.1 — Safari standalone loses connection on background

### Problem
The `visibilitychange` health check from Batch 11.2 relies on the browser firing
`visibilitychange` when returning from background. In Safari standalone (PWA) mode
on iOS, the WebSocket may die silently during sleep and `visibilitychange` does not
always fire reliably when the app returns to foreground.

### Fix
Add a periodic heartbeat check as a fallback alongside the existing `visibilitychange`
handler in `clients/shared/lib/connection.ts`.

**1. Add a periodic connection check** — when status is `connected`, ping the server
every 30 seconds. If no response within 5 seconds, force reconnect.

Add to the `Connection` class:

```typescript
private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

private startHeartbeatMonitor(): void {
  this.stopHeartbeatMonitor();
  this.heartbeatInterval = setInterval(() => {
    if (this.status !== 'connected' || this.manualDisconnect) return;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // WS already dead — reconnect
      this.reconnectAttempts = 0;
      this.connect();
      return;
    }
    // Active check: send pong and wait for server response
    if (!this.awaitingHealthCheck) {
      this.checkConnectionHealth();
    }
  }, 30000);
}

private stopHeartbeatMonitor(): void {
  if (this.heartbeatInterval) {
    clearInterval(this.heartbeatInterval);
    this.heartbeatInterval = null;
  }
}
```

**2. Start the monitor** when connection established. In the `ws.onmessage` handler,
inside the `case 'connected'` block (after `this.setStatus('connected')`):

```typescript
this.startHeartbeatMonitor();
```

Also in `case 'reconnected'` after `this.setStatus('connected')`:
```typescript
this.startHeartbeatMonitor();
```

**3. Stop the monitor** on disconnect. In `disconnect()`:
```typescript
this.stopHeartbeatMonitor();
```

**4. Also stop on close.** In `ws.onclose` handler, add:
```typescript
this.stopHeartbeatMonitor();
```

This ensures that even if `visibilitychange` doesn't fire in standalone mode,
the 30-second heartbeat detects a dead WebSocket and forces reconnection.

### Files
- `clients/shared/lib/connection.ts`

---

## Fix 13.2 — FH loot resources not shown on character sheet

### Problem
`StatsTab` in `app/controller/overlays/CharacterSheetOverlay.tsx` (line 75-137)
shows Total Gold but has no section for FH resources stored in
`character.progress.loot` (a `Partial<Record<LootType, number>>`).

After `completeScenario`, resources are written to `progress.loot` but never
displayed.

### Fix
Add a resources section to `StatsTab` after the gold row.

**1. Add resource display** in `CharacterSheetOverlay.tsx` after the "Total Gold"
stat row (line 127):

```tsx
{/* FH Resources */}
{(() => {
  const resources = character.progress?.loot;
  if (!resources) return null;
  const entries = Object.entries(resources).filter(([, v]) => v && v > 0);
  if (entries.length === 0) return null;

  const resourceLabels: Record<string, string> = {
    lumber: 'Lumber', metal: 'Metal', hide: 'Hide',
    arrowvine: 'Arrowvine', axenut: 'Axenut', corpsecap: 'Corpsecap',
    flamefruit: 'Flamefruit', rockroot: 'Rockroot', snowthistle: 'Snowthistle',
  };

  return (
    <div class="sheet__resources">
      <span class="sheet__stat-label">Resources</span>
      <div class="sheet__resource-grid">
        {entries.map(([type, count]) => (
          <div key={type} class="sheet__resource-pill">
            <span class="sheet__resource-name">{resourceLabels[type] || type}</span>
            <span class="sheet__resource-count">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
})()}
```

**2. Add CSS** to `app/controller/styles/controller.css`:

```css
/* FH Resources on character sheet */
.sheet__resources {
  padding: var(--space-2) 0;
  border-top: 1px solid var(--bg-secondary);
  margin-top: var(--space-2);
}

.sheet__resource-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.sheet__resource-pill {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-3);
  background: var(--bg-secondary);
  border: 1px solid var(--accent-copper);
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
}

.sheet__resource-name {
  color: var(--text-secondary);
}

.sheet__resource-count {
  font-family: 'Cinzel', serif;
  font-weight: 700;
  color: var(--text-primary);
}
```

### Files
- `app/controller/overlays/CharacterSheetOverlay.tsx`
- `app/controller/styles/controller.css`

---

## Fix 13.3 — Condition picker too small and missing positive conditions

### Problem
`StandeeConditionAdder` in `app/components/MonsterGroup.tsx` (line 162) filters to
`NEGATIVE_CONDITIONS` only. Positive conditions (strengthen, invisible, regenerate,
ward, bless) are missing from the picker. The popup `max-width: 200px` is too narrow
for the full condition set.

### Fix

**1. Update the condition filter** in `StandeeConditionAdder` (line 162).
Import and use the edition-aware condition list instead of just negatives:

```typescript
import { getConditionsForEdition } from '@gloomhaven-command/shared';
```

Add an `edition` prop to `StandeeConditionAdder`:
```typescript
function StandeeConditionAdder({ target, existingConditions, edition }: {
  target: { type: 'monster'; name: string; edition: string; entityNumber: number };
  existingConditions: EntityCondition[];
  edition: string;
}) {
```

Replace the filter (line 162-164):
```typescript
const AM_DECK_ONLY = new Set(['bless', 'curse', 'empower', 'enfeeble']);
const conditionsToShow = getConditionsForEdition(edition).filter(
  name => !AM_DECK_ONLY.has(name) && !existingConditions.some(c => c.name === name)
);
```

This shows all gameplay conditions (positive and negative) for the current edition,
excluding AMD-only conditions (bless, curse, empower, enfeeble) which don't apply
as entity conditions.

**2. Pass `edition` prop** from `StandeeRow` to `StandeeConditionAdder`:
```tsx
<StandeeConditionAdder target={target} existingConditions={activeConditions} edition={edition} />
```

**3. Widen the popup.** Update `.cond-adder-popup` in
`app/shared/styles/components.css`:

Change `max-width: 200px` to `max-width: 280px`.

**4. Increase icon size.** Update `.cond-btn.mini` and `.cond-icon.mini` to be
slightly larger for easier tapping:

```css
.cond-btn.mini {
    width: 28px;
    height: 28px;
    padding: 3px;
}

.cond-icon.mini {
    width: 20px;
    height: 20px;
}
```

Find these existing rules and update the sizes. The current values are likely
22px/16px — bump to 28px/20px.

### Files
- `app/components/MonsterGroup.tsx`
- `app/shared/styles/components.css`

---

## Fix 13.4 — Bench strip covers initiative numpad overlay

### Problem
The bench strip renders inside `.scenario-content` (the scrollable area) at the
bottom of `FigureList`. The `InitiativeNumpad` renders from within `CharacterBar`
(also inside `.scenario-content`). The numpad has `z-index: 60` on `.numpad-backdrop`
with `position: fixed`. This SHOULD overlay everything.

The issue: `-webkit-overflow-scrolling: touch` on `.scenario-content`
(controller.css line 141) creates a new stacking context on iOS Safari. Fixed
elements with z-index inside this container may not escape the stacking context,
causing the bench strip (which is a later DOM element) to paint over the numpad.

### Fix
Move the `InitiativeNumpad` rendering from inside `CharacterBar` to the
`ScenarioView` level, outside the scroll container.

**1. Lift numpad state to ScenarioView.** In `app/controller/ScenarioView.tsx`,
add state for which character's numpad is open:

```typescript
const [numpadTarget, setNumpadTarget] = useState<{ name: string; edition: string } | null>(null);
```

**2. Pass a callback** to `FigureList` and `CharacterBar` instead of rendering
the numpad inline. In `CharacterBar`, replace the `showNumpad` state and inline
`InitiativeNumpad` rendering with a prop callback:

Add to `CharacterBarProps`:
```typescript
onOpenNumpad?: () => void;
```

Replace the initiative tap handler (wherever `setShowNumpad(true)` is called) with:
```typescript
onClick={() => onOpenNumpad?.()}
```

Remove the `showNumpad` state, the `InitiativeNumpad` import, and the inline
`{showNumpad && <InitiativeNumpad ... />}` rendering from `CharacterBar`.

**3. Thread the callback** through `FigureList`:

Add to `FigureListProps`:
```typescript
onOpenNumpad?: (characterName: string, edition: string) => void;
```

Pass to CharacterBar:
```typescript
onOpenNumpad={() => onOpenNumpad?.(character.name, character.edition)}
```

**4. Render the numpad at ScenarioView level**, outside `.scenario-content`,
alongside the other overlays:

```tsx
{numpadTarget && (() => {
  const char = characters.find(c => c.name === numpadTarget.name && c.edition === numpadTarget.edition);
  if (!char) return null;
  return (
    <InitiativeNumpad
      characterName={char.title || formatName(char.name)}
      currentValue={char.initiative}
      onSet={(value) => {
        commands.setInitiative(numpadTarget.name, numpadTarget.edition, value);
        setNumpadTarget(null);
      }}
      onLongRest={() => {
        commands.toggleLongRest(numpadTarget.name, numpadTarget.edition);
        setNumpadTarget(null);
      }}
      onClose={() => setNumpadTarget(null)}
    />
  );
})()}
```

This ensures the numpad renders at the top level of the DOM, outside the
`-webkit-overflow-scrolling: touch` container, eliminating the stacking context
issue entirely.

### Files
- `app/components/CharacterBar.tsx`
- `app/components/FigureList.tsx`
- `app/controller/ScenarioView.tsx`

---

## Fix 13.5 — Scenario summary overlay on completion

### Problem
Clicking "Scenario Complete (Victory)" or "Scenario Failed (Defeat)" immediately
processes rewards with no visual feedback showing what each character received.

### Fix
Add a `ScenarioSummaryOverlay` that displays BEFORE `completeScenario` is sent.
The overlay shows what each character WILL receive, then a "Confirm" button sends
the actual command.

**1. Create** `app/controller/overlays/ScenarioSummaryOverlay.tsx`:

```tsx
import { h } from 'preact';
import { useMemo } from 'preact/hooks';
import type { GameState, Character } from '@gloomhaven-command/shared';
import { deriveLevelValues, getPlayerCount } from '@gloomhaven-command/shared';
import { OverlayBackdrop } from './OverlayBackdrop';
import { formatName } from '../../shared/formatName';

interface ScenarioSummaryOverlayProps {
  state: GameState;
  outcome: 'victory' | 'defeat';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ScenarioSummaryOverlay({ state, outcome, onConfirm, onCancel }: ScenarioSummaryOverlayProps) {
  const isVictory = outcome === 'victory';
  const level = state.level ?? 0;
  const levelValues = deriveLevelValues(level);
  const bonusXP = isVictory ? levelValues.bonusXP : 0;
  const playerCount = getPlayerCount(state.characters);

  const rewards = useMemo(() => {
    return state.characters.map(char => {
      const scenarioXP = char.experience || 0;
      const totalNewXP = scenarioXP + bonusXP;

      // Gold calculation
      let totalCoins = 0;
      if (char.lootCards?.length > 0 && state.lootDeck?.cards?.length > 0) {
        for (const idx of char.lootCards) {
          const card = state.lootDeck.cards[idx];
          if (!card) continue;
          if (card.type === 'money') {
            const val = playerCount <= 2 ? card.value2P
              : playerCount === 3 ? card.value3P : card.value4P;
            totalCoins += val;
          }
        }
      } else {
        totalCoins = char.loot || 0;
      }
      const goldGained = totalCoins * levelValues.goldConversion;

      // Resources (FH)
      const resources: Record<string, number> = {};
      if (char.lootCards?.length > 0 && state.lootDeck?.cards?.length > 0) {
        for (const idx of char.lootCards) {
          const card = state.lootDeck.cards[idx];
          if (card && card.type !== 'money') {
            resources[card.type] = (resources[card.type] || 0) + 1;
          }
        }
      }

      return {
        name: char.title || formatName(char.name),
        scenarioXP,
        bonusXP,
        totalNewXP,
        totalCoins,
        goldConversion: levelValues.goldConversion,
        goldGained,
        resources,
        currentTotalXP: char.progress?.experience ?? 0,
        newTotalXP: (char.progress?.experience ?? 0) + totalNewXP,
        currentGold: char.progress?.gold ?? 0,
        newGold: (char.progress?.gold ?? 0) + goldGained,
      };
    });
  }, [state, bonusXP, playerCount, levelValues]);

  return (
    <OverlayBackdrop onClose={onCancel}>
      <div class="overlay-panel scenario-summary">
        <h2 class="scenario-summary__title">
          Scenario {isVictory ? 'Complete!' : 'Failed'}
        </h2>
        {state.scenario && (
          <p class="scenario-summary__scenario">
            #{state.scenario.index} — Level {level}
          </p>
        )}

        <div class="scenario-summary__table">
          {rewards.map((r, i) => (
            <div key={i} class="scenario-summary__row">
              <span class="scenario-summary__char-name">{r.name}</span>
              <div class="scenario-summary__details">
                <span class="scenario-summary__detail">
                  XP: {r.scenarioXP}{bonusXP > 0 ? ` + ${bonusXP} bonus` : ''} = {r.totalNewXP}
                </span>
                <span class="scenario-summary__detail scenario-summary__detail--sub">
                  Total: {r.currentTotalXP} → {r.newTotalXP}
                </span>
                <span class="scenario-summary__detail">
                  Coins: {r.totalCoins} × {r.goldConversion} = {r.goldGained} gold
                </span>
                <span class="scenario-summary__detail scenario-summary__detail--sub">
                  Total gold: {r.currentGold} → {r.newGold}
                </span>
                {Object.keys(r.resources).length > 0 && (
                  <span class="scenario-summary__detail">
                    Resources: {Object.entries(r.resources).map(([t, n]) => `${t} ×${n}`).join(', ')}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div class="scenario-summary__actions">
          <button class="btn" onClick={onCancel}>Cancel</button>
          <button class={`btn btn-primary ${isVictory ? 'btn-victory' : 'btn-defeat'}`}
            onClick={onConfirm}>
            {isVictory ? 'Claim Rewards' : 'Accept Defeat'}
          </button>
        </div>
      </div>
    </OverlayBackdrop>
  );
}
```

**2. Add CSS** to `app/controller/styles/controller.css`:

```css
/* Scenario summary overlay */
.scenario-summary {
  max-width: 480px;
}

.scenario-summary__title {
  font-family: 'Cinzel', serif;
  font-size: 1.4rem;
  font-weight: 900;
  color: var(--accent-gold);
  text-align: center;
  margin-bottom: var(--space-2);
}

.scenario-summary__scenario {
  text-align: center;
  color: var(--text-secondary);
  font-size: 0.9rem;
  margin-bottom: var(--space-4);
}

.scenario-summary__table {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.scenario-summary__row {
  background: var(--bg-secondary);
  border: 1px solid var(--accent-copper);
  border-radius: var(--radius-sm);
  padding: var(--space-3);
}

.scenario-summary__char-name {
  font-family: 'Cinzel', serif;
  font-size: 1rem;
  font-weight: 700;
  color: var(--accent-gold);
  display: block;
  margin-bottom: var(--space-2);
}

.scenario-summary__details {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.scenario-summary__detail {
  font-size: 0.85rem;
  color: var(--text-primary);
}

.scenario-summary__detail--sub {
  font-size: 0.75rem;
  color: var(--text-muted);
  padding-left: var(--space-3);
}

.scenario-summary__actions {
  display: flex;
  gap: var(--space-3);
  justify-content: center;
}

.btn-victory {
  border-color: var(--health-green);
  color: var(--health-green);
  background: linear-gradient(135deg, var(--bg-primary), rgba(74, 124, 89, 0.15));
}

.btn-defeat {
  border-color: var(--negative-red);
  color: var(--negative-red);
  background: linear-gradient(135deg, var(--bg-primary), rgba(197, 48, 48, 0.1));
}
```

**3. Wire into the menu flow.** In `app/controller/overlays/MenuOverlay.tsx`,
change the Victory/Defeat buttons to set an overlay state instead of directly
calling `completeScenario`. This requires coordinating with `ScenarioView.tsx`:

In `ScenarioView.tsx`, add to the overlay type:
```typescript
| { type: 'scenarioSummary'; outcome: 'victory' | 'defeat' }
```

In the MenuOverlay, change the buttons to call a parent callback instead of
commands.completeScenario directly. Add a prop to MenuOverlay:
```typescript
onScenarioEnd?: (outcome: 'victory' | 'defeat') => void;
```

Button handlers become:
```typescript
onClick={() => { onScenarioEnd?.('victory'); onClose(); }}
onClick={() => { onScenarioEnd?.('defeat'); onClose(); }}
```

In ScenarioView, pass the callback to MenuOverlay:
```tsx
<MenuOverlay
  ...
  onScenarioEnd={(outcome) => setActiveOverlay({ type: 'scenarioSummary', outcome })}
/>
```

Render the summary overlay:
```tsx
{activeOverlay.type === 'scenarioSummary' && (
  <ScenarioSummaryOverlay
    state={state}
    outcome={activeOverlay.outcome}
    onConfirm={() => {
      commands.completeScenario(activeOverlay.outcome);
      setActiveOverlay({ type: 'none' });
    }}
    onCancel={() => setActiveOverlay({ type: 'none' })}
  />
)}
```

### Files
- `app/controller/overlays/ScenarioSummaryOverlay.tsx` (new)
- `app/controller/overlays/MenuOverlay.tsx`
- `app/controller/ScenarioView.tsx`
- `app/controller/styles/controller.css`

---

## Verification Checklist

```
[ ] npm run build completes without errors

Connection (13.1):
[ ] PWA standalone: 30-second heartbeat detectable in console logs
[ ] iPad sleep 2+ minutes → wake → auto-reconnects without manual refresh
[ ] Normal browser tab: existing visibilitychange reconnect still works
[ ] Heartbeat stops on manual disconnect

Resources (13.2):
[ ] FH scenario end: character sheet shows resource pills (Lumber: 2, etc.)
[ ] GH scenario end: no resource section (resources empty)
[ ] Resource counts match loot cards assigned during scenario

Condition Picker (13.3):
[ ] Monster standee "+": picker shows BOTH positive and negative conditions
[ ] GH: 10 conditions minus bless/curse = 8 in picker
[ ] FH: 16 conditions minus bless/curse/empower/enfeeble = 12 in picker
[ ] Picker wider (280px), icons larger (28px)
[ ] Strengthen, Invisible visible in picker
[ ] Selecting a positive condition works correctly

Bench Z-index (13.4):
[ ] With absent character on bench: tap another character's initiative
[ ] Numpad appears ABOVE bench strip (not hidden behind it)
[ ] Numpad backdrop covers entire screen including bench
[ ] Numpad functions correctly (set, cancel, rest)
[ ] Numpad no longer renders inside CharacterBar

Summary (13.5):
[ ] Menu → Victory: summary overlay appears BEFORE rewards applied
[ ] Summary shows per-character: scenario XP, bonus XP, coins, gold, resources
[ ] Summary shows "Total: X → Y" for both XP and gold
[ ] "Claim Rewards" button: applies rewards and closes
[ ] "Cancel" button: returns to game, no rewards applied
[ ] Menu → Defeat: summary shows 0 bonus XP, correct defeat message
[ ] "Accept Defeat" button works
```

## Commit Message

```
fix(batch-13): UX + connection — heartbeat, resources, conditions, z-index, summary

- Add 30-second heartbeat monitor for Safari standalone reconnection
- Show FH resources (lumber, metal, hide, etc.) on character sheet
- Condition picker: include positive conditions, widen popup, larger icons
- Lift InitiativeNumpad to ScenarioView level to fix z-index vs bench strip
- Add ScenarioSummaryOverlay showing rewards before completeScenario fires
```
