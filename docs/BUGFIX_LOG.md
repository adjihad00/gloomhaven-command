# Gloomhaven Command — Bug Fix Log

Append-only. Each entry: date, symptom, root cause, fix. Never delete entries.

---

## 2026-03-26 — Batch 1: Condition Engine & Combat Fixes

### B1: Conditions never expire
**Symptom:** Strengthen, Stun, etc. persist indefinitely once applied.
**Root cause:** `processConditionEndOfTurn()` only transitioned `turn` → `normal` and counted wound damage. It never transitioned `normal` → `expire` for expire-type conditions. Also, `EXPIRE_CONDITIONS` array was incomplete (missing bane, brittle, infect, regenerate, ward, dodge, empower, enfeeble, safeguard).
**Fix:** Expanded `EXPIRE_CONDITIONS` to include all end-of-next-turn conditions. Rewrote `processConditionEndOfTurn()` to filter expired conditions and transition `normal` → `expire` for conditions in the expire list. Lifecycle: new → (end of round) → normal → (end of next turn) → expire → removed.

### B2: Regenerate + Wound interaction broken
**Symptom:** Both regenerate and wound fire independently — wound deals 1 damage, regenerate heals 1, net zero. But wound is never cleared.
**Root cause:** `applyTurnStartConditions()` processed wound first, then regenerate. Per rules, any heal (including regenerate) should clear wound and poison INSTEAD of healing HP.
**Fix:** Reordered: regenerate processes first. If wound or poison is present, the heal is consumed (removes wound/poison, no HP gained). Wound damage only fires if wound is still present after regenerate.

### B3: Bane (FH) doesn't fire
**Symptom:** Bane condition has no mechanical effect — no damage dealt.
**Root cause:** No bane damage processing existed anywhere in the codebase.
**Fix:** `processConditionEndOfTurn()` now returns `baneDamage` (10 when bane transitions `normal` → `expire`). The `toggleTurn` handler applies bane damage to the entity, with auto-kill for monsters at 0 HP.

### B4: Poison has no mechanical effect
**Symptom:** Poison is just a visual icon — no +1 damage modifier.
**Root cause:** `handleChangeHealth()` applied deltas directly without checking for poison. Wound damage at turn start also ignored poison.
**Fix:** `handleChangeHealth()` now adds -1 to negative deltas when entity has active poison. `applyTurnStartConditions()` adds +1 to wound damage when poison is present. `handleChangeHealth()` also clears wound/poison on positive deltas (heal clears conditions instead of healing).

### B5: Dead standees at 0 HP remain visible
**Symptom:** Monster standees reduced to 0 HP still appear on screen.
**Root cause:** Primarily a UI issue (deferred to Batch 2). Engine already marks entities dead at 0 HP in `handleChangeHealth` and `activateFigure`.
**Fix:** Engine-side: dead monster groups are now filtered from `getInitiativeOrder()`, preventing them from appearing in turn order or being auto-advanced to.

### B6: Dead monster groups still appear in turn order
**Symptom:** When all standees in a group are dead, the group still draws ability cards and is sorted into initiative order.
**Root cause:** `getInitiativeOrder()` included all figures from `state.figures[]` without checking if monster groups had living entities.
**Fix:** Added all-dead filter to `getInitiativeOrder()`. `drawMonsterAbilities()` already had this filter (line 411). Also fixed `applyTurnStartToActiveFigure()` to apply turn-start conditions when `startRound()` activates the first figure (previously only set `active=true` without processing conditions).

### Additional fix: Turn-start conditions on round start
**Symptom:** Wound/regenerate didn't fire on the first figure activated at the start of a round.
**Root cause:** `startRound()` in turnOrder.ts only set `figure.active = true` — it didn't call `applyTurnStartConditions()` which lives in applyCommand.ts.
**Fix:** `handleAdvancePhase()` now calls `applyTurnStartToActiveFigure()` after `startRound()` returns, ensuring the first activated figure gets wound/regenerate processing.

---

## 2026-04-13 — Batch 12: Game Logic & Combat Fixes

### B12.1: Long rest doesn't heal 2 HP
**Symptom:** Characters declaring long rest (initiative 99) activate but never receive the "Heal 2, self" that the rules mandate.
**Root cause:** `activateFigure()` in applyCommand.ts calls `applyTurnStartConditions()` for characters but never checks the `longRest` flag. The long rest heal was simply never implemented.
**Fix:** Added long rest processing inside the `if (type === 'character')` block, before `applyTurnStartConditions()`. When `c.longRest` is true: checks for heal-blocking conditions (wound, poison, bane, brittle); if present, removes them (heal consumed); otherwise heals 2 HP. Clears `c.longRest = false` after processing so it doesn't repeat next round. Per rules §3, long rest heal fires before wound/regenerate turn-start processing.

### B12.2: Bless/curse cards not removed after drawing
**Symptom:** Drawing a bless or curse from the attack modifier deck leaves it in the deck. It reappears after shuffle and persists indefinitely.
**Root cause:** `handleDrawModifierCard()` always advanced `deck.current` and pushed to `deck.discarded` — same logic for all cards. Bless/curse cards were never spliced out.
**Fix:** After drawing, check if the card is `'bless'` or `'curse'`. If so, `splice()` it from `deck.cards` (returned to supply per rules §5) and leave `deck.current` unchanged (next card shifts into position). Normal cards advance `deck.current` as before. Added `lastDrawn?: string` field to `AttackModifierDeckModel` to track the drawn card ID for UI display — necessary because after splicing a bless/curse, `deck.cards[deck.current - 1]` would point to the wrong card. Updated `ModifierDeck.tsx` to read `deck.lastDrawn` instead of indexing into the cards array.

### B12.3: Monsters remain on board after scenario complete
**Symptom:** Clicking "Scenario Complete (Victory)" transfers XP and gold but all monster groups remain visible. Character state (HP, conditions, initiative) is not reset.
**Root cause:** `handleCompleteScenario()` only handled XP/gold transfer and party scenario tracking. No cleanup of scenario-specific state.
**Fix:** Added cleanup before `state.finish` assignment: clear `state.monsters` and `state.objectiveContainers`, filter `state.figures` to characters only, reset all character combat state (HP to max, initiative to 0, clear conditions/summons, deactivate), reset round to 0 and phase to `'draw'`, set all elements to `'inert'`.

### B12.4: Gold not tracked for GH scenarios
**Symptom:** GH scenarios always show 0 gold earned on scenario completion, even when characters looted coins during play.
**Root cause:** `handleCompleteScenario()` derived gold exclusively from `char.lootCards` + `state.lootDeck.cards` (the FH loot card system). GH scenarios have no loot deck — `state.lootDeck.cards` is empty, so `char.lootCards` is always empty. The simple `char.loot` coin counter (incremented by the gold icon tap) was never consulted.
**Fix:** Added conditional: if `char.lootCards` has entries AND `state.lootDeck` has cards, use FH loot card system. Otherwise fall back to `char.loot` as a simple coin count. Both paths feed into the same `totalCoins * goldConversion` calculation.

---

## 2026-04-13 — Batch 13: UX + Connection Fixes

### B13.1: Safari standalone loses WebSocket on background
**Symptom:** iPad PWA (standalone mode) silently loses WebSocket during sleep. `visibilitychange` doesn't always fire on iOS Safari standalone, leaving the app stuck with a dead connection.
**Root cause:** The `visibilitychange` handler was the only mechanism for detecting dead connections after backgrounding. Safari standalone mode doesn't reliably fire this event.
**Fix:** Added a 30-second heartbeat monitor to the `Connection` class. Checks `ws.readyState` and sends a keep-alive pong to prevent server-side stale timeout. If the socket is dead (readyState !== OPEN), forces immediate reconnection. Starts on `connected`/`reconnected`, stops on `disconnect`/`onclose`. Does NOT use `checkConnectionHealth()` (which waits for server response) — the server uses protocol-level pings invisible to JS `onmessage`.

### B13.2: FH loot resources not shown on character sheet
**Symptom:** After `completeScenario`, FH resources (lumber, metal, hide, herbs) are written to `character.progress.loot` but never displayed anywhere.
**Root cause:** `StatsTab` in `CharacterSheetOverlay.tsx` only showed Total Gold — no section for FH resources.
**Fix:** Added resource pills section to `StatsTab` after the gold row. Reads `character.progress.loot`, filters for non-zero entries, and renders as styled pills with resource name and count.

### B13.3: Monster condition picker missing positive conditions
**Symptom:** `StandeeConditionAdder` only showed `NEGATIVE_CONDITIONS`. Positive conditions (strengthen, invisible, regenerate, ward) were unavailable for monsters.
**Root cause:** Hardcoded `NEGATIVE_CONDITIONS` filter instead of edition-aware condition list.
**Fix:** Replaced with `getConditionsForEdition(target.edition)`, excluding AM deck-only conditions (bless, curse, empower, enfeeble). Widened popup from 200px to 280px. Increased mini button size from 22px to 28px for easier tapping.

### B13.4: Bench strip covers InitiativeNumpad overlay
**Symptom:** On iOS Safari, the numpad overlay could be painted behind the bench strip due to `-webkit-overflow-scrolling: touch` creating a new stacking context.
**Root cause:** `InitiativeNumpad` rendered inside `CharacterBar`, which is inside `.scenario-content` (the scroll container with `-webkit-overflow-scrolling: touch`). Fixed elements with z-index inside this container cannot escape the stacking context on iOS.
**Fix:** Lifted `InitiativeNumpad` from `CharacterBar` to `ScenarioView` level. Added `onOpenNumpad` callback prop threaded through `FigureList` → `CharacterBar`. Numpad now renders outside `.scenario-content`, eliminating the stacking context issue.

### B13.5: Scenario completion has no reward preview
**Symptom:** Clicking Victory/Defeat immediately processed rewards with no visual feedback showing what each character received.
**Root cause:** `MenuOverlay` called `commands.completeScenario()` directly with no intermediate confirmation step.
**Fix:** Added `ScenarioSummaryOverlay` showing per-character XP (scenario + bonus), coins × gold conversion, and FH resources before the command fires. "Claim Rewards" / "Accept Defeat" confirms; "Cancel" returns to game. `MenuOverlay` victory/defeat buttons now call `onScenarioEnd` callback instead of the command directly.

---

## 2026-04-14 — Batch 14: SW Cache Busting + Phone Permissions

### B14.1: Stale cached JavaScript on phones after deploy
**Symptom:** Phone service worker uses manually-bumped `CACHE_VERSION`. Forgetting to bump it causes Android to serve stale cached JS. Commands silently fail because the browser runs old code.
**Root cause:** Manual `CACHE_VERSION` string (`gc-phone-v4`) in `app/phone/sw.js` must be updated on every code change — easy to forget.
**Fix:** Build script (`app/build.mjs`) now generates content-hashed JS filenames via esbuild (`main-[hash].js`). HTML and SW files are auto-generated into `dist/` at build time with correct hashed references. SW cache name is derived from a SHA-256 of all precached file contents. No manual version bumping needed — any code or CSS change produces new hashes automatically. Dev/watch mode keeps plain `main.js` for simplicity.

### B14.2: Phone clients can control any character
**Symptom:** Any phone can send commands for any character. No server-side enforcement of the `characterName` registered via the `register` message.
**Root cause:** `handleCommand()` in `wsHub.ts` passed all commands through to `onCommand` without checking the connection's role or registered character.
**Fix:** Added permission enforcement in `handleCommand()`. Phone clients (`session.role === 'phone'`) are restricted to a whitelist of 12 character-scoped commands (`setInitiative`, `changeHealth`, `toggleCondition`, etc.). Each command's target character name is extracted and verified against `session.characterName`. Commands targeting other characters, monsters, or global actions are rejected with an error message. Controller and display roles are unrestricted.

---

## 2026-04-14 — Batch 16: Diff Propagation Fix

### B16.1: setupPhase/setupData changes not broadcast to clients
**Symptom:** After controller sets `setupPhase` (via `prepareScenarioSetup`), phone clients don't receive the update. Setup phase transitions (`proceedToRules`, `proceedToBattleGoals`) require full page reload on all clients to take effect.
**Root cause:** `diffStates.ts` has an explicit list of top-level GameState keys to diff. `setupPhase`, `setupData`, and `mode` were never added to this list, so changes to these fields produce zero `StateChange` entries, and clients never receive the diffs.
**Fix:** Added `'mode'` and `'setupPhase'` to the `primitiveKeys` array in `diffStates.ts`. Added `'setupData'` to the section 8 object-keys array. All three fields are now diffed and broadcast like any other GameState field.

### B16.2: Edition reverts to GH after completing FH scenario
**Symptom:** Playing a Frosthaven scenario, completing it, going through town phase, and returning to lobby shows Gloomhaven as the edition. Scenario selection shows GH scenarios.
**Root cause:** `state.edition` was only set by `createEmptyGameState()` (defaults to `'gh'`). No command ever updated it. The lobby's `selectedEdition` was client-local state that was lost when the component unmounted.
**Fix:** `startScenario` and `prepareScenarioSetup` handlers in `applyCommand.ts` now set `after.edition = command.payload.edition`, persisting the edition to the server-side game state.

### B16.3: Stale tsbuildinfo causing server compilation failures
**Symptom:** Server TypeScript compilation fails with cryptic errors after shared package type changes (new `setupPhase`, `setupData`, `AppMode` fields).
**Root cause:** Stale `tsconfig.tsbuildinfo` files in `packages/shared/` and `server/` retained old type signatures that conflicted with the new type definitions added in Batch 16.
**Fix:** Deleted stale `.tsbuildinfo` files and rebuilt. These incremental compilation caches are regenerated automatically by `tsc`.

### B16.4: Controller registered as phone profile when both open in same browser
**Symptom:** Controller commands (e.g., `completeTownPhase`, `advancePhase`) are rejected by the server with "Phone cannot perform X" error. Happens when controller and phone tabs are open in the same browser.
**Root cause:** Both tabs share `localStorage`, so both send the same `gc_sessionToken` on connect. The server reuses the same session for both WebSocket connections. When the phone tab sends a `register` message with `role='phone'`, it overwrites `session.role` — now the controller's commands are checked against the phone whitelist and rejected.
**Fix:** Moved role and characterName tracking from the per-session object to the per-WebSocket `ClientInfo` in `wsHub.ts`. Each WebSocket connection now has its own role, independent of the session. The `handleRegister` method sets `info.role` on the `ClientInfo` (keyed by WebSocket instance), and `handleCommand` checks `info.role` instead of `session.role`. Multiple tabs sharing a session token can now have different roles simultaneously.

---

## 2026-04-14 — Batch 15: Phone View Adjustments (UX improvements, no bug fixes)

*No bugs fixed in this batch.* Notable UX change: removed manual Exhaust button
from `PhoneActionBar`, replaced by `PhoneExhaustPopup` that auto-triggers when
HP reaches 0. This prevents accidental exhaustion and provides a dramatic
confirmation flow (skull icon, deep red accents). Not a bug fix — the old button
worked correctly, but the auto-detect pattern is more ergonomic and less error-prone.

---

## 2026-04-14 — HTTPS + LAN Connectivity Investigation

## 2026-04-15 — Batch 17: Cert Validation Fix

### B17.1: Server serves broken HTTPS with empty cert files
**Symptom:** `https://game.gh-command.com:3000` shows "Not Secure" in Chrome with HTTPS crossed out. Incognito works after fixing cert files, but main profile caches the bad cert state.
**Root cause:** Certbot on Windows stores real certs in `C:\Certbot\archive\` and creates symlinks in `C:\Certbot\live\`. Windows failed to create symlinks (requires admin privileges), leaving 0-byte placeholder files. The server's `findCerts()` used `existsSync()` which returns true for 0-byte files, so it loaded an empty cert. Chrome cached the broken cert's security state, requiring manual HSTS/cache clearing even after the cert was fixed.
**Fix:** Added `certFileValid()` helper that checks both `existsSync()` AND `statSync().size > 0`. All cert file checks in `findCerts()` now use this helper. If Certbot cert files exist but are empty, the server logs a warning and falls back to mkcert certs instead of serving a broken cert. Also copied valid certs from `archive/` to `live/` manually, and set up a Windows scheduled task for weekly Certbot renewal with a PowerShell script (`scripts/renew-cert.ps1`) that handles the archive→live copy on Windows.

---

---

## 2026-04-16 — Batch 18a: Server Logic Bugs + Controller Standee Management

### B18a.1: Round count starts at 0 instead of 1
**Symptom:** New scenarios display "Round 0" on all devices. Gloomhaven rules say the first round is "Round 1."
**Root cause:** `handleSetScenario()` in `applyCommand.ts` initialized `state.round = 0`. The `startScenario` command delegates to the same handler. GHS compat import also defaulted to `round: 0`.
**Fix:** Changed initialization to `state.round = 1` in `handleSetScenario()` and `ghsCompat.ts`. `completeScenario` still resets to 0 (no active scenario during teardown). `endRound()` increments correctly from 1→2→3.

### B18a.2: Dead standee skulls persist across rounds
**Symptom:** Monster standees killed during a round show skull badges indefinitely. They should clear at end of round (after loot token tracking) but persist into subsequent rounds.
**Root cause:** `endRound()` in `turnOrder.ts` resets active/off flags and processes condition expiry but never removes dead entities from `monster.entities[]`.
**Fix:** Added dead entity cleanup in `handleAdvancePhase()` before the `endRound()` call: filters `monster.entities` to remove dead entries, removes empty monster groups from `state.monsters`, and cleans `state.figures` to match. Placed before `endRound()` because `endRound()` deep-clones the state.

### B18a.3: Room reveal doesn't draw ability cards for new monsters
**Symptom:** Opening a door mid-round spawns monsters but they sit idle until the next round. Per rules §7, revealed monsters act during the round they appear.
**Root cause:** `handleRevealRoom()` called `spawnRoomMonsters()` but never drew ability cards or set initiative for the new groups.
**Fix:** After `spawnRoomMonsters()`, if in play phase (`state.state === 'next'`), tracks which monster groups are new, draws ability cards for them (reusing the same deck-grouping logic as `drawMonsterAbilities`), sets initiative, and re-sorts `state.figures` by initiative. Shared ability decks that were already drawn this round copy the existing card instead of re-drawing. Refactored `drawMonsterAbilities` into `groupMonstersByDeck` + `drawAbilityForDeckGroup` helpers.

### B18a.4: Monster ability special actions (infuse/consume/summon) not processed
**Symptom:** Monster ability cards with element infusion, element consumption, or summon actions have no mechanical effect. The engine draws the card and displays it but doesn't execute the actions.
**Root cause:** No code existed to process monster ability card actions beyond displaying them in the UI.
**Fix:** Added `processMonsterAbilityActions()` that reads the drawn ability card's actions (including nested subActions) and processes: (1) `elementHalf` (consume) — sets consumed element to inert on monster activation, (2) `element` (infuse) — sets element to strong on monster deactivation, (3) `summon` — creates new monster entity with correct stats on activation. Threaded `dataContext` through `handleToggleTurn` → `activateFigure` → `activateNextInOrder`. Extended `MonsterAbilityAction` type with `valueObject` for summon data. Per rules §6: consume fires at activation, infuse at deactivation. Summons marked `off: true` per rules §8 (don't act the round summoned).

### B18a.5: Controller cannot add/remove standees mid-game
**Symptom:** No UI to add or remove monster standees during a scenario. The `addEntity`/`removeEntity` commands exist in the protocol but aren't exposed in the controller.
**Root cause:** `MonsterGroup.tsx` only renders existing standees with HP/condition controls. No add/remove buttons.
**Fix:** Added "+ Normal" and "+ Elite" buttons below the standee list in `MonsterGroup.tsx`. Added "×" remove button on each standee row. Client-side `getNextStandeeNumber()` finds the lowest available number. Capped at 10 standees per group. Buttons hidden in `readonly` mode (display client). Styled with existing BEM patterns and dark fantasy aesthetic.

---

## 2026-04-16 — Batch 18b: Display UI Polish

### B18b.1: Monster stat icons duplicated for normal/elite
**Symptom:** When a monster has different innate stats for normal vs. elite (e.g., Ice Wraith: normal Shield 2, elite Retaliate 2), the display renders two separate icons — one per type. Wastes horizontal space and looks redundant.
**Root cause:** `InnateAbilitiesRow` in `DisplayFigureCard.tsx` rendered two full `StatActionItem` components (each with its own icon) in a `figure-card__innate-split` wrapper when values differed.
**Fix:** Replaced the split rendering with a single icon followed by dual-colored values: white for normal, gold (`--elite-gold`) for elite, with `/` separator. Range sub-actions on retaliate also render with dual colors when they differ. Single-value cases (normal only, elite only, identical) unchanged.

### B18b.2: Character initiatives visible during draw phase
**Symptom:** When players enter initiatives during draw phase, values are immediately visible on the display. Per rules §2, initiatives are revealed simultaneously when all players commit.
**Root cause:** `DisplayFigureCard` always rendered `initiative` directly in the initiative circle, regardless of game phase.
**Fix:** Added `phase` prop to `DisplayFigureCard`. During draw phase: characters with entered initiative show `??` (with muted styling), unentered show empty, long-resting show `99`. Monsters show empty during draw (no ability card drawn yet). All values reveal when play phase begins (`state.state === 'next'`). Phase prop passed from `ScenarioView`.

### B18b.3: Compact card tray shifts position when standees appear
**Symptom:** Completed figure cards shift from left to right when the first monster standee dies and populates the standee tray. Causes visual jitter mid-round.
**Root cause:** `.display-completed-tray__layout` used `justify-content: space-between`. With no standees div, cards were the only child and sat on the left. Adding standees pushed cards right.
**Fix:** Removed `justify-content: space-between` from the layout. Added `margin-left: auto` to `.display-completed-tray__cards` so cards always align right regardless of standee tray presence.

---

---

## 2026-04-16 — Phase 5 Bugfix

### B5.1: Label icon SVGs oversized on controller
**Symptom:** Inline action icons in scenario special rules text appear much larger on the controller than on the phone.
**Root cause:** `.label-icon` used `1.1em` sizing which scales with parent font-size. The controller's `lobby__rules-text` at `0.9rem` produced ~16px icons, but the raw SVGs have large intrinsic dimensions and `em`-based sizing was inconsistent across layout contexts.
**Fix:** Changed `.label-icon` from `width: 1.1em` to `width: 16px; height: 16px` for consistent sizing across all clients.

### B5.2: Display monster ability names missing after Phase 5.2
**Symptom:** Monster ability cards on the display show no name after switching to `/api/ref/ability-cards`.
**Root cause:** Most ability cards in the reference DB have `name: null` (label-resolved names only exist for some editions). The Phase 5.2 refactor dropped the `Card ${cardId}` fallback.
**Fix:** Added fallback `card.name || 'Card ${card.card_id}'` in `useDisplayMonsterData.ts`.

### B5.3: Display sticky header not locking on small viewports
**Symptom:** The scenario header's sticky row (round, level, elements) scrolls out of view on viewports smaller than 1920px.
**Root cause:** `.display__content` had `height: 100vh` (fixed) instead of filling available flex space. Combined with top padding, the sticky header's `top: 0` didn't align with the visible scroll boundary.
**Fix:** Changed `.display__content` from `height: 100vh` to `flex: 1; min-height: 0;`. Removed top padding so sticky `top: 0` aligns with the scroll container's visible edge.

### B5.4: Monster ability deck overrides from scenario rules not applied
**Symptom:** FH scenario 0 hounds use the normal hound ability deck instead of the scenario-specific `hound-scenario-0` deck (fixed ability: Move 2, Attack 2 at initiative 26 every round).
**Root cause:** Scenario `rules[].statEffects[].statEffect.deck` was present in the GHS JSON data but never parsed or applied during scenario setup. All deck lookups used the static `MonsterData.deck` field.
**Fix:** Added `overrideDeck?: string` to `Monster` type. `applyScenarioRuleDeckOverrides()` runs after `spawnRoomMonsters()` in `handleSetScenario()`, parsing scenario rules and setting deck overrides on matching monster groups. Updated `groupMonstersByDeck()`, `drawAbilityForDeckGroup()`, `processMonsterAbilityActions()`, and `handleEndOfRoundShuffle()` to check `monster.overrideDeck` before the default deck. Added `getMonsterDeck()` to `DataContext` interface.

---

## 2026-04-17 — Phase 5.x Cleanup: Extraction Coverage

### B5.x.1: Scenarios 107, 115, 128 missing goal_text
**Symptom:** After Phase 5.x extraction, these three scenarios had null goals despite the scenario books containing explicit win conditions.
**Root cause:** `parseScenarioFromText()` used a literal `at the end of` in its goal regex. pdfjs text extraction inserts a line break inside the phrase (`at the end\nof the Nth round`), so the literal substring never matched. Additionally, scenario 107 uses "The scenario *may be* complete … *only* at …" — variants the regex did not accept.
**Fix:** Replaced the literal phrase with `at\s+the\s+end\s+of` and added `may be` / `only` alternatives: `(The scenario (?:is|may be) complete\s+(?:when|at\s+the\s+end\s+of|once|after|only)\s+[\s\S]*?\.)`.

### B5.x.2: Scenarios 73, 78, 121 missing goal_text
**Symptom:** These scenarios showed a blank goal in the DB.
**Root cause:** Their physical-book goals are intentionally hidden as the literal text "Unknown at this time." — the main goal regex correctly did not match, but no fallback preserved the hidden-goal string.
**Fix:** Added a fallback after the primary regex: if `/Unknown at this time\./i` appears in the raw page text, store the goal verbatim as `"Unknown at this time."`.

### B5.x.3: Copyright-only page handling was fragile
**Symptom:** The extractor had a hard-coded `if (pageNumber <= 2 && filename === SCENARIO_BOOKS[0]) continue;` to sidestep copyright-only pages, which only worked for one book.
**Root cause:** Heuristic tied to book identity, not page content.
**Fix:** Added `isCopyrightOnlyPage(text)` helper (`text.trim().length < 200 && /CEPHALOFAIR/i.test(text)`) wired into both scenario- and section-book loops. Defensive; no scenarios were actually being missed by the prior check, but the new check is content-aware and generalizes to every book.

---

### INF1: game.gh-command.com unreachable from LAN devices
**Symptom:** After setting up Let's Encrypt certs + Cloudflare DNS, `https://game.gh-command.com:3000` fails to load from Chrome PC and phones. localhost works. LAN IP works from dev PC but cert mismatch on other devices.
**Root cause:** Not a code regression. The ASUS GT-AX11000 Pro router has DNS rebinding protection enabled, which silently drops DNS responses that resolve public domains to private IPs (192.168.50.96). Cloudflare DNS correctly returns the LAN IP, but the router intercepts and blocks it. Additionally, the dev PC's Windows hosts file had no entry for the domain.
**Fix:** Added `192.168.50.96 game.gh-command.com` to Windows hosts file (`C:\Windows\System32\drivers\etc\hosts`) for dev PC. For LAN-wide resolution: added entry to router's `/etc/hosts` and signaled dnsmasq with `kill -HUP` (not `service restart_dnsmasq`, which regenerates `/etc/hosts`). Created `/jffs/scripts/services-start` on the router to persist the entry across reboots. Note: `/jffs/configs/dnsmasq.conf.add` does NOT work on this ASUS firmware — dnsmasq's config never includes it. Created `docs/HTTPS_LAN_SETUP.md` documenting the full setup. No server code changes were needed — the server was correctly binding to `0.0.0.0:3000` with a valid Let's Encrypt cert.
