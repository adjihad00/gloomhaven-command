# Batch 6 — Remaining Features: Loot Deck, Character Sheet, Modifier Deck, PWA

> Paste into Claude Code. Implements FH loot deck draw/assign, character sheet
> viewer overlay for controller, improved monster modifier deck display, and
> PWA WebSocket fix. Completes the playtest issue backlog.

---

## PRE-STEP — Read design skills

Before ANY code changes, read all design skill sources:

```
Read /mnt/skills/public/frontend-design/SKILL.md
```

```powershell
Get-ChildItem "C:\Users\Kyle Diaz\.claude\plugins\marketplaces\ui-ux-pro-max-skill" -Recurse -Filter "*.md" | ForEach-Object { Write-Host "=== $($_.FullName) ==="; Get-Content $_.FullName }
```

```powershell
Get-ChildItem "C:\Users\Kyle Diaz\.agents\skills" -Recurse -Filter "*.md" | ForEach-Object { Write-Host "=== $($_.FullName) ==="; Get-Content $_.FullName }
```

Then read project context:
- CLAUDE.md (design conventions section)
- docs/GHS_AUDIT.md Section 12 (Loot System), Section 3 (Character Sheet),
  Section 8 (Modifier Decks)
- docs/GHS_STATE_MAP.md (LootDeck, AttackModifierDeck, Character.progress types)
- `app/CONVENTIONS.md`

Then read implementation files:
- `app/components/ModifierDeck.tsx` — current modifier deck component
- `app/controller/ScenarioView.tsx` — where footer components are composed
- `app/controller/overlays/CharacterDetailOverlay.tsx` — current character overlay
- `app/components/CharacterBar.tsx` — character card (where loot count shows)
- `app/components/ScenarioFooter.tsx` — where modifier deck renders
- `clients/shared/lib/commandSender.ts` — drawLootCard, assignLoot, drawModifierCard, shuffleModifierDeck, addModifierCard, removeModifierCard signatures
- `packages/shared/src/types/gameState.ts` — LootDeck, AttackModifierDeck, Character types
- `packages/shared/src/engine/applyCommand.ts` — loot and modifier deck handlers
- `packages/shared/src/data/types.ts` — ScenarioData.lootDeckConfig if it exists

## Playtest Issues Being Fixed

| # | Issue | Summary |
|---|-------|---------|
| B9 | FH loot deck not functional | Draw/assign UI needed for Frosthaven loot deck |
| W5 | Character sheet viewer | DM needs to view character info (level, XP, perks, items) |
| W9 | Better monster modifier deck | Current display is too primitive |
| I6 | PWA WebSocket broken | Connection fails when installed as webapp unless also open in browser |

## STEP 1 — FH Loot Deck UI

### Background

Frosthaven uses a loot deck with typed resource cards. GH doesn't use a loot
deck (loot is tile-based). The loot deck should only appear for FH scenarios or
when a `lootDeckConfig` is present.

From the audit: "Click loot deck icon to draw a card. Drawn card displayed with
artwork + resource label. With 'Apply Loot to Character' ON: loot auto-assigned
to active character."

### Investigation

Read the current state of loot deck commands and state:

```powershell
# Check what loot-related commands exist
Select-String -Path "clients\shared\lib\commandSender.ts" -Pattern "loot|Loot" -CaseSensitive:$false
Select-String -Path "packages\shared\src\engine\applyCommand.ts" -Pattern "loot|Loot" -CaseSensitive:$false
Select-String -Path "packages\shared\src\types\gameState.ts" -Pattern "loot|Loot" -CaseSensitive:$false
```

Determine:
1. Does `drawLootCard` command exist and work?
2. Does `assignLoot` command exist and work?
3. What does `state.lootDeck` look like? (cards, drawn, assigned fields)
4. Does ScenarioData have `lootDeckConfig` for building the deck?
5. Does `setScenario` auto-build the loot deck from scenario config?

If the commands exist but aren't wired to UI, just build the UI.
If the commands don't exist or are broken, fix them first.

### Create LootDeckPanel Component

`app/components/LootDeckPanel.tsx`:

```tsx
interface LootDeckPanelProps {
  lootDeck: LootDeckModel;
  characters: Character[];
  activeCharacterName?: string;  // currently active character for auto-assign
  onDraw: () => void;
  onAssign: (cardIndex: number, characterName: string) => void;
  readonly?: boolean;
  compact?: boolean;  // for footer badge
}
```

**Full display** (shown in an overlay or panel):

```
┌─────────────────────────────────┐
│ Loot Deck            15/20     │
│ ┌───────────────────────────┐  │
│ │ [Draw Card]               │  │
│ └───────────────────────────┘  │
│                                │
│ Drawn (unassigned):            │
│ ┌──────┐ ┌──────┐ ┌──────┐   │
│ │ 💰×2 │ │ 🪵×1 │ │ 🌿×1 │   │
│ │[Assign]│[Assign]│[Assign]│  │
│ └──────┘ └──────┘ └──────┘   │
│                                │
│ Assigned:                      │
│ Brute: 💰×2, 🪵×1             │
│ Spellweaver: 🌿×1             │
└─────────────────────────────────┘
```

**Compact display** (for footer bar):
- Just the deck icon + remaining count: `🃏 15/20`
- Click to expand full panel

### Loot card type display

Map `LootType` enum values to display:

```tsx
const lootTypeDisplay: Record<string, { icon: string; label: string; color: string }> = {
  'money':       { icon: '💰', label: 'Gold',       color: '#c8a92c' },
  'lumber':      { icon: '🪵', label: 'Lumber',     color: '#8b6914' },
  'metal':       { icon: '⛏',  label: 'Metal',      color: '#8c8c8c' },
  'hide':        { icon: '🦌', label: 'Hide',       color: '#b08040' },
  'arrowvine':   { icon: '🌿', label: 'Arrowvine',  color: '#4a8f3c' },
  'axenut':      { icon: '🌰', label: 'Axenut',     color: '#7a5930' },
  'corpsecap':   { icon: '🍄', label: 'Corpsecap',  color: '#6b4a6b' },
  'flamefruit':  { icon: '🔥', label: 'Flamefruit',  color: '#d4553a' },
  'rockroot':    { icon: '🪨', label: 'Rockroot',   color: '#6b6b6b' },
  'snowthistle': { icon: '❄',  label: 'Snowthistle', color: '#4a9bd9' },
  'random_item': { icon: '🎁', label: 'Random Item', color: '#9b59b6' },
  'special1':    { icon: '⭐', label: 'Special',     color: '#c8a92c' },
  'special2':    { icon: '⭐', label: 'Special',     color: '#c8a92c' },
};
```

### Loot card assign UI

For each unassigned drawn card, show a character picker:

```tsx
function LootCardAssign({ cardIndex, cardType, characters, onAssign }: {
  cardIndex: number;
  cardType: string;
  characters: Character[];
  onAssign: (characterName: string) => void;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const display = lootTypeDisplay[cardType] || { icon: '?', label: cardType, color: 'var(--text-muted)' };

  return (
    <div class="loot-card" style={{ borderColor: display.color }}>
      <span class="loot-card-icon">{display.icon}</span>
      <span class="loot-card-label">{display.label}</span>
      {!showPicker ? (
        <button class="loot-assign-btn" onClick={() => setShowPicker(true)}>
          Assign
        </button>
      ) : (
        <div class="loot-char-picker">
          {characters.filter(c => !c.exhausted && !c.absent).map(c => (
            <button key={c.name} class="loot-char-btn"
              onClick={() => { onAssign(c.name); setShowPicker(false); }}>
              {c.title || formatName(c.name)}
            </button>
          ))}
          <button class="loot-char-btn cancel" onClick={() => setShowPicker(false)}>
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
```

### Wire into ScenarioView

The loot deck should appear in the ScenarioFooter area when:
1. `state.edition === 'fh'` OR
2. `state.lootDeck` exists and has cards

In compact mode, show a badge in the footer. Clicking opens a LootDeckOverlay.

Create `app/controller/overlays/LootDeckOverlay.tsx`:

```tsx
interface LootDeckOverlayProps {
  lootDeck: LootDeckModel;
  characters: Character[];
  activeCharacterName?: string;
  onClose: () => void;
}
```

Uses `OverlayBackdrop` for consistent overlay behavior. Contains the full
`LootDeckPanel`.

Add a loot deck button to the ScenarioFooter (next to the modifier deck):

```tsx
{lootDeck && lootDeck.cards && lootDeck.cards.length > 0 && (
  <button class="loot-deck-badge" onClick={onOpenLootDeck}>
    🃏 {remaining}/{total}
  </button>
)}
```

Add `activeOverlay` state for `'lootDeck'` in ScenarioView.

### Auto-assign to active character

When "Apply Loot to Character" behavior is desired: after `drawLootCard()`,
if there's an active character (currently taking turn), auto-assign the drawn
card to that character. This could be:
- An option in the loot deck overlay
- Automatic behavior (matching GHS default)

For now, implement manual draw + assign. Auto-assign can be a setting later.

### CSS

```css
.loot-card {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--bg-secondary);
  border: 1.5px solid;
  border-radius: var(--radius-sm);
}

.loot-card-icon { font-size: 1.2rem; }
.loot-card-label { font-family: 'Crimson Pro', serif; font-size: 0.85rem; color: var(--text-primary); }

.loot-assign-btn {
  margin-left: auto;
  padding: var(--space-1) var(--space-3);
  border: 1px solid var(--accent-copper);
  border-radius: var(--radius-sm);
  background: var(--bg-primary);
  color: var(--accent-gold);
  font-family: 'Crimson Pro', serif;
  font-size: 0.8rem;
  cursor: pointer;
  touch-action: manipulation;
}

.loot-char-picker {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  margin-left: auto;
}

.loot-char-btn {
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--accent-copper);
  border-radius: var(--radius-sm);
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: 0.75rem;
  cursor: pointer;
  touch-action: manipulation;
}

.loot-char-btn:active { background: var(--accent-gold); color: var(--bg-primary); }
.loot-char-btn.cancel { border-color: var(--text-muted); color: var(--text-muted); }

.loot-deck-badge {
  padding: var(--space-1) var(--space-3);
  border: 1px solid var(--accent-copper);
  border-radius: var(--radius-sm);
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: 0.8rem;
  cursor: pointer;
  touch-action: manipulation;
}
```

## STEP 2 — Character Sheet Viewer Overlay

### Background

The DM needs to view character info on the controller: level, XP thresholds,
perks, items. This is a read-mostly overlay — most editing happens on the phone
client (Phase T), but the controller needs visibility.

### Create CharacterSheetOverlay

`app/controller/overlays/CharacterSheetOverlay.tsx`:

```tsx
interface CharacterSheetOverlayProps {
  character: Character;
  edition: string;
  onClose: () => void;
}
```

Layout — tabbed sections for readability (matching the APP_MODE_ARCHITECTURE
phone Town View design):

```
┌──────────────────────────────────────┐
│ [✕]   BRUTE — Level 3               │
│        "Thorin" (custom name)        │
│                                      │
│ [Stats] [Perks] [Items] [Quest]      │
│ ─────────────────────────────────────│
│                                      │
│ STATS TAB (default):                 │
│ Class: Inox Brute                    │
│ Level: 3 (XP: 47/95)                │
│ HP: 14 at level 3                    │
│ Hand Size: 10 cards                  │
│ Gold: 30                             │
│ XP Thresholds: 0/45/95/150/210/...  │
│                                      │
│ PERKS TAB:                           │
│ Available: 2 perk points             │
│ □ Remove two -1 cards               │
│ ☑ Replace -1 with +1                │
│ □ Add two +1 cards                   │
│ ... (from character data perks list) │
│                                      │
│ ITEMS TAB:                           │
│ (Display only — items from progress) │
│ Head: —                              │
│ Body: Hide Armor (Item 032)          │
│ Legs: —                              │
│ ...                                  │
│                                      │
│ QUEST TAB:                           │
│ Personal quest description           │
│ Retirement conditions                │
└──────────────────────────────────────┘
```

### Implementation

```tsx
export function CharacterSheetOverlay({ character, edition, onClose }: CharacterSheetOverlayProps) {
  const [activeTab, setActiveTab] = useState<'stats' | 'perks' | 'items' | 'quest'>('stats');

  // Fetch character class data for perks, hand size, HP table
  const { data: classData } = useDataApi<any>(`${edition}/character/${character.name}`);

  const tabs = ['stats', 'perks', 'items', 'quest'] as const;

  return (
    <OverlayBackdrop onClose={onClose} position="right">
      <div class="sheet-header">
        <button class="overlay-close" onClick={onClose}>✕</button>
        <div class="sheet-title">
          <span class="sheet-class">{formatName(character.name)}</span>
          {character.title && <span class="sheet-name">"{character.title}"</span>}
          <span class="sheet-level">Level {character.level}</span>
        </div>
      </div>

      <div class="sheet-tabs">
        {tabs.map(tab => (
          <button
            key={tab}
            class={`sheet-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div class="sheet-content">
        {activeTab === 'stats' && <StatsTab character={character} classData={classData} />}
        {activeTab === 'perks' && <PerksTab character={character} classData={classData} />}
        {activeTab === 'items' && <ItemsTab character={character} />}
        {activeTab === 'quest' && <QuestTab character={character} />}
      </div>
    </OverlayBackdrop>
  );
}
```

### StatsTab

```tsx
function StatsTab({ character, classData }: { character: Character; classData: any }) {
  const xpThresholds = [0, 45, 95, 150, 210, 275, 345, 420, 500];
  const currentXP = character.experience || 0;
  const nextThreshold = xpThresholds.find(t => t > currentXP) || 500;

  return (
    <div class="sheet-stats">
      <div class="stat-row">
        <span class="stat-label">Class</span>
        <span class="stat-value">{formatName(character.name)}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Level</span>
        <span class="stat-value">{character.level}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">XP</span>
        <span class="stat-value">{currentXP} / {nextThreshold}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">HP at level</span>
        <span class="stat-value">{character.maxHealth}</span>
      </div>
      {classData?.handSize && (
        <div class="stat-row">
          <span class="stat-label">Hand Size</span>
          <span class="stat-value">{classData.handSize} cards</span>
        </div>
      )}
      <div class="stat-row">
        <span class="stat-label">Gold</span>
        <span class="stat-value">{character.loot || 0}</span>
      </div>
      <div class="xp-thresholds">
        <span class="stat-label">XP Thresholds</span>
        <div class="threshold-row">
          {xpThresholds.map((t, i) => (
            <span key={i} class={`threshold ${currentXP >= t ? 'reached' : ''}`}>
              Lv{i + 1}: {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
```

### PerksTab

```tsx
function PerksTab({ character, classData }: { character: Character; classData: any }) {
  const perks = classData?.perks || [];
  // Character.progress may have perk data — read actual type

  return (
    <div class="sheet-perks">
      {perks.length === 0 ? (
        <div class="empty-state">Perk data not available</div>
      ) : (
        perks.map((perk: any, i: number) => (
          <div key={i} class="perk-row">
            <span class="perk-checkbox">
              {/* Show checked/unchecked based on character progress */}
              {'□'}
            </span>
            <span class="perk-desc">{formatPerkDescription(perk)}</span>
          </div>
        ))
      )}
    </div>
  );
}

function formatPerkDescription(perk: any): string {
  // Convert perk data to readable description
  const type = perk.type || 'unknown';
  const count = perk.count || 1;
  const cards = perk.cards || [];

  if (type === 'remove' && cards.length > 0) {
    const cardDesc = cards.map((c: any) =>
      `${c.count}x ${c.attackModifier?.type || 'card'}`
    ).join(', ');
    return `Remove ${cardDesc}`;
  }
  if (type === 'replace' && cards.length >= 2) {
    return `Replace ${cards[0].count}x ${cards[0].attackModifier?.type} with ${cards[1].count}x ${cards[1].attackModifier?.type}`;
  }
  if (type === 'add' && cards.length > 0) {
    const cardDesc = cards.map((c: any) =>
      `${c.count}x ${c.attackModifier?.type || 'card'}`
    ).join(', ');
    return `Add ${cardDesc}`;
  }
  return `${type}: ${JSON.stringify(cards).substring(0, 80)}`;
}
```

### ItemsTab and QuestTab

For now, these show whatever data is available on `character.progress`:

```tsx
function ItemsTab({ character }: { character: Character }) {
  const items = (character as any).progress?.items || [];
  if (items.length === 0) {
    return <div class="empty-state">No items equipped. Item management available in Town mode.</div>;
  }
  return (
    <div class="sheet-items">
      {items.map((item: any, i: number) => (
        <div key={i} class="item-row">
          <span>{item.name || item.id || `Item ${i + 1}`}</span>
        </div>
      ))}
    </div>
  );
}

function QuestTab({ character }: { character: Character }) {
  const quest = (character as any).progress?.personalQuest;
  if (!quest) {
    return <div class="empty-state">No personal quest data. Import from GHS save or assign in Town mode.</div>;
  }
  return (
    <div class="sheet-quest">
      <p>{quest.name || quest.id || 'Personal Quest'}</p>
    </div>
  );
}
```

### Wire into CharacterBar

Add a button/trigger on the character card to open the sheet overlay.
The character class icon on the right side of the bar (matching GHS behavior):

In `CharacterBar.tsx`, add a sheet trigger. Read the current component to find
the right place. Could be:
- A small icon button on the right of the card
- Tapping the portrait (if portrait currently does turn toggle, use a different trigger)

Add to `ScenarioView.tsx` overlay state:
```tsx
| { type: 'characterSheet'; characterName: string }
```

### CSS for character sheet

```css
.sheet-header {
  padding: var(--space-4);
  border-bottom: 1px solid var(--accent-copper);
}

.sheet-title {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.sheet-class {
  font-family: 'Cinzel', serif;
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--accent-gold);
}

.sheet-name {
  font-family: 'Crimson Pro', serif;
  font-size: 0.9rem;
  color: var(--text-secondary);
  font-style: italic;
}

.sheet-level {
  font-size: 0.85rem;
  color: var(--text-muted);
}

.sheet-tabs {
  display: flex;
  border-bottom: 1px solid var(--bg-secondary);
}

.sheet-tab {
  flex: 1;
  padding: var(--space-3);
  border: none;
  background: none;
  color: var(--text-muted);
  font-family: 'Crimson Pro', serif;
  font-size: 0.85rem;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  touch-action: manipulation;
  transition: all var(--transition-fast);
}

.sheet-tab.active {
  color: var(--accent-gold);
  border-bottom-color: var(--accent-gold);
}

.sheet-content {
  padding: var(--space-4);
  overflow-y: auto;
  max-height: 60vh;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--bg-secondary);
}

.stat-label { color: var(--text-muted); font-size: 0.85rem; }
.stat-value { color: var(--text-primary); font-weight: 600; font-size: 0.85rem; }

.threshold-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.threshold {
  font-size: 0.75rem;
  color: var(--text-muted);
  padding: var(--space-1) var(--space-2);
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
}

.threshold.reached { color: var(--accent-gold); border: 1px solid var(--accent-gold-dim); }

.perk-row {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--bg-secondary);
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.perk-checkbox { color: var(--text-muted); flex-shrink: 0; }
```

## STEP 3 — Improved Monster Modifier Deck

### The Problem

The current modifier deck display is too primitive — just a remaining count.
Need a better display with draw visualization.

### Redesign ModifierDeck component

Update `app/components/ModifierDeck.tsx`:

**Full display** (when expanded from footer):

```
┌───────────────────────────────┐
│ Monster Modifier Deck  18/20  │
│                               │
│ Last drawn: [+1]              │  ← show the drawn card value
│                               │
│ [Draw] [Shuffle]              │
│                               │
│ Bless: 0 [+][-]              │
│ Curse: 2 [+][-]              │
│                               │
│ Advantage □  Disadvantage □   │
└───────────────────────────────┘
```

**Compact display** (footer badge): `⚔ 18/20` — click to open full panel.

Key improvements:
1. Show the last drawn card type/value
2. Visual card back with count overlay
3. Bless/curse count display with +/- buttons
4. Advantage/disadvantage toggle (optional)

### Implementation

Read the current `ModifierDeck` component. It already has `compact` prop.
Enhance the full display:

```tsx
// In ModifierDeck, full mode:
const remaining = deck.cards ? deck.cards.length - (deck.current || 0) : 0;
const total = deck.cards?.length || 0;

// Determine last drawn card
const lastDrawnIndex = (deck.current || 0) - 1;
const lastDrawnCard = lastDrawnIndex >= 0 && deck.cards
  ? deck.cards[lastDrawnIndex] : null;

// Count bless/curse in remaining deck
const blessCount = deck.cards?.filter(c => c === 'bless' || c.includes('bless')).length || 0;
const curseCount = deck.cards?.filter(c => c === 'curse' || c.includes('curse')).length || 0;
```

The modifier card display depends on how cards are stored in `deck.cards`.
Read the actual type — they may be string IDs like "plus1", "minus1", "null",
"double", "bless", "curse".

Map card IDs to display:

```tsx
const modifierDisplay: Record<string, { label: string; color: string }> = {
  'plus0': { label: '+0', color: 'var(--text-secondary)' },
  'plus1': { label: '+1', color: 'var(--health-green)' },
  'plus2': { label: '+2', color: 'var(--health-green)' },
  'minus1': { label: '-1', color: 'var(--negative-red)' },
  'minus2': { label: '-2', color: 'var(--negative-red)' },
  'null': { label: '∅ MISS', color: 'var(--negative-red)' },
  'double': { label: '2× CRIT', color: 'var(--accent-gold)' },
  'bless': { label: '2× BLESS', color: 'var(--accent-gold)' },
  'curse': { label: '∅ CURSE', color: 'var(--negative-red)' },
};
```

## STEP 4 — PWA WebSocket Fix

### The Problem

When installed as a PWA (Add to Home Screen on iPad), the WebSocket connection
doesn't work unless the page is also open in the browser. This suggests the
service worker is intercepting or blocking WebSocket connections.

### Investigation

Check if there's a service worker registered:

```powershell
Select-String -Path "app\controller\index.html" -Pattern "serviceWorker"
Select-String -Path "app\controller\main.tsx" -Pattern "serviceWorker"
Get-ChildItem "app" -Recurse -Filter "sw.js"
Get-ChildItem "app" -Recurse -Filter "service-worker*"
```

Also check if there's a `manifest.json` or `manifest.webmanifest`:

```powershell
Get-ChildItem "app" -Recurse -Filter "manifest*"
Get-ChildItem "." -Filter "manifest*"
```

### Possible Fixes

**If no service worker exists:** The issue might be that the PWA meta tags
(`apple-mobile-web-app-capable`) are causing iOS to treat it as a standalone
app with different networking behavior. The fix may be:

1. Ensure the WebSocket URL uses `ws://` (not `wss://`) for local connections
2. Ensure the Connection class detects the correct host:

```typescript
// In Connection class, when building WS URL:
const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = `${protocol}//${location.host}`;
```

3. If the PWA is on a different origin than expected, the WS connection may fail

**If a service worker exists:** Ensure it doesn't intercept WebSocket connections.
Service workers can't intercept WS connections directly, but they can affect the
initial HTTP upgrade request.

**Alternative fix — explicit WS URL:**

Add a connection option that lets the user specify the server URL explicitly:

```tsx
// In ConnectionScreen, add an "Advanced" section:
<details class="advanced-connection">
  <summary>Advanced</summary>
  <div class="form-group">
    <label>Server URL (leave blank for auto-detect)</label>
    <input type="text" value={customUrl}
      placeholder="ws://192.168.50.96:3000"
      onInput={(e) => setCustomUrl((e.target as HTMLInputElement).value)} />
  </div>
</details>
```

Pass the custom URL to the Connection class if specified.

### Read the Connection class

```powershell
Get-Content "clients\shared\lib\connection.ts" | Out-String
```

Understand how it builds the WebSocket URL. The fix depends on what's happening.

For PWA mode, the most common issue on iOS is that `location.host` doesn't
resolve correctly in standalone mode. The fix is usually to hardcode or
localStorage-persist the server URL from the initial connection.

**Minimum fix for Batch 6:**
1. Save the full server URL (including protocol and port) in localStorage
   when first connected
2. On reconnect (including PWA launch), use the saved URL instead of
   `location.host`
3. Add a manual server URL override in Advanced settings

## STEP 5 — Verify

### Build

```powershell
node app/build.mjs
```

### Boot and test

**Loot deck (FH scenario):**
1. Connect, select FH edition
2. Add characters, select an FH scenario with loot deck
3. Loot deck badge appears in footer (🃏 with count)
4. Click badge → loot deck overlay opens
5. Draw card → card appears in unassigned list with resource type + icon
6. Click Assign → character picker appears
7. Select character → card assigned, moves to assigned section
8. Character bar shows loot card count badge
9. GH scenarios: no loot deck shown (correct — GH doesn't use one)

**Character sheet:**
10. Open character detail overlay
11. Find character sheet trigger (icon button)
12. Sheet overlay opens with tabs: Stats, Perks, Items, Quest
13. Stats tab shows level, XP with threshold, HP, hand size, gold
14. Perks tab shows perk list from class data (if available)
15. Tabs switch cleanly
16. Close sheet returns to main screen

**Monster modifier deck:**
17. Footer shows modifier deck badge
18. Click to expand → shows remaining/total, draw/shuffle buttons
19. Draw → last drawn card type displayed
20. Bless/curse count shown with +/- buttons
21. Shuffle button works

**PWA fix:**
22. Add controller to iPad home screen
23. Open from home screen (standalone mode)
24. Connection works without also having browser open
25. If manual URL override was added, verify it works

## STEP 6 — Update ROADMAP.md and BUGFIX_LOG.md

Mark all Batch 6 items complete. Update the playtest issue table — all 36
original issues should now have a status (fixed, deferred, or n/a).

Add a summary line:
```markdown
## Post-Playtest Fix Batches — COMPLETE
All 6 batches (36 issues) addressed. Phase R rebuild complete with full
scenario play functionality.
```

## STEP 7 — Commit

```powershell
git add -A
git commit -m "feat: loot deck, character sheet, modifier deck, PWA fix (Batch 6)

- FH Loot Deck: draw/assign UI with resource type icons and colors,
  compact footer badge, character picker for assignment, overlay panel
- Character Sheet Overlay: tabbed display (stats/perks/items/quest),
  XP thresholds, perk descriptions from class data, read-only on controller
- Monster Modifier Deck: last drawn card display, bless/curse counts
  with +/- buttons, expanded panel from footer badge
- PWA WebSocket fix: persistent server URL in localStorage, manual
  server URL override in Advanced connection settings
- Fixes B9, W5, W9, I6 from playtest
- All 6 playtest fix batches complete"
git push
```

Report: commit hash, final bundle sizes for all three entry points, and which
of the 25 verification checks pass. Note any items that need live FH scenario
testing vs what could be verified in preview.
