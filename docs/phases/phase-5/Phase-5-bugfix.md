# Phase 5 Bugfix

## Controller:
- **Special rules SVG are massive** — FIXED. Changed `.label-icon` from `1.1em` (which scales with parent font-size) to fixed `16px`. Icons now render at a consistent readable size across all clients.

## Phone:
- **Battle goals: use actual card images** — FIXED. Phone LobbyView now renders Worldhaven battle goal card images (`/assets/worldhaven/images/battle-goals/{edition}/{edition}-{slug}.png`) instead of text boxes. Added `battleGoalCard()` helper to `app/shared/assets.ts`. Added static server fallback route to serve `.staging/worldhaven/images/` at `/assets/worldhaven/images/` when the `assets/worldhaven/` directory isn't populated. Updated CSS from text card layout to full-bleed image cards.

## Display:
- **Monster ability names: No longer being displayed** — FIXED. After Phase 5.2 switched to `/api/ref/ability-cards`, most cards have `name: null` in the database (label-resolved names only exist for some editions). Added fallback: `card.name || 'Card ${card.card_id}'` in `useDisplayMonsterData.ts`.
- **Scroll lock: Top header not locking** — FIXED. Changed `.display__content` from `height: 100vh` to `flex: 1; min-height: 0;` so it properly fills the flex column layout. Removed top padding that interfered with `position: sticky; top: 0;` on `.display-header__sticky`.

## Game Engine:
- **Battle goals: server-side deck persistence** — INFRASTRUCTURE ADDED. Added `BattleGoalDeck` type to GameState with `cards: string[]` (shuffled card IDs) and `current: number` (deal pointer). Added `dealBattleGoals` and `returnBattleGoals` commands to the protocol. `dealBattleGoals` initializes the deck on first use (shuffled once per campaign) and advances the pointer. `returnBattleGoals` moves unused cards to the bottom of the deck (per rules). Added `getBattleGoals()` to DataManager and DataContext. Phone dealing still uses client-side shuffle as a fallback — wiring the phone to use server-side dealing requires per-player state tracking (deferred to follow-up).
- **Special rules: monster ability deck overrides** — FIXED. Added `overrideDeck?: string` field to `Monster` type. `applyScenarioRuleDeckOverrides()` parses scenario `rules[].statEffects[].statEffect.deck` after monster spawning and sets the override on matching monster groups. `groupMonstersByDeck()`, `drawAbilityForDeckGroup()`, `processMonsterAbilityActions()`, and `handleEndOfRoundShuffle()` all check `monster.overrideDeck` before falling back to the default deck. Added `getMonsterDeck(edition, deckName)` to DataContext interface and server implementation. FH scenario 0 hounds now use the `hound-scenario-0` deck (Card 846: Move 2, Attack 2 at initiative 26) instead of the normal hound deck.
