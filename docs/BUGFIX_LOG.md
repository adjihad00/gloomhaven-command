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

---

## 2026-04-17 — Phase T1: Scenario End Rewards

### T1-B1: Scenario summary hid exhausted and absent characters
**Symptom:** Controller's scenario-end summary listed only non-absent, non-exhausted characters. Per rules §11 / §15.18, exhausted characters still gain XP, gold, and loot when the scenario completes — their rewards were invisible to the GM.
**Root cause:** `ScenarioSummaryOverlay.tsx` filtered with `state.characters.filter(c => !c.absent && !c.exhausted)` when deriving rewards rows.
**Fix:** Refactored the overlay to read from `state.finishData.characters` (built by `buildScenarioFinishData` over the full `state.characters` list — rules §11 compliant). Absent/exhausted characters now appear in the summary with their actual earned values.

### T1-B2: Rewards overlays read live state, drifted after completeScenario
**Symptom:** Phone rewards overlay showed pre-completion values while pending, then fell back to generic "Rewards claimed" text after completeScenario. Numbers could disagree between phone/controller/display because each derived from live state in its own way.
**Root cause:** Each overlay derived rewards from `state.characters` independently; no single source of truth.
**Fix:** Introduced `state.finishData` snapshot populated on `prepareScenarioEnd`, mutated during the pending window by `setBattleGoalComplete` / `claimTreasure` / `dismissRewards`, and applied atomically by `completeScenario`. `handleCompleteScenario` reads the snapshot when present (fallback path preserves old derivation for pre-T1 saves). The snapshot stays alive through the scenario→town transition and is cleared on `cancelScenarioEnd` / `completeTownPhase` / `startScenario`.


### T1-B3: `state.finishData` never reached clients (Phase T1 regression before first release)
**Symptom:** Controller Scenario Summary stuck on "Preparing rewards…"; phone and display rewards overlays never rendered; non-controller devices stayed on the scenario view.
**Root cause:** `diffStates.ts` broadcasts a whitelist of top-level `GameState` keys. When `finishData` was added to `GameState`, it was not added to the whitelist — so `prepareScenarioEnd` set the field server-side but the broadcast diff only carried `finish`. Clients received `finish = 'pending:victory'` with `finishData` still `undefined`, and every overlay fell through to the no-snapshot fallback branch. Same failure mode as Batch 16b's `setupPhase`/`setupData` bug.
**Fix:** Added `'finishData'` to the diff key list at [diffStates.ts:67-73](packages/shared/src/engine/diffStates.ts:67). Verified via engine smoke test that `applyCommand(prepareScenarioEnd)` now emits `finishData` in its `changes[]`.


## 2026-04-17 — Phase 6: Service Worker Unbrick + Self-Healing

### P6-B1: PWAs permanently stuck on stale app shell after cert-origin change
**Symptom:** After swapping the LAN HTTPS cert, multiple installed devices (iPads, iPhones, Androids) kept loading the pre-swap bundle indefinitely. Commands silently failed because the browser ran code that pointed at the old origin. "Delete Website Data → reboot" sometimes worked, sometimes didn't — Safari holds SW state per-PWA and the SW kept resurrecting itself on every load. There was no way for a visiting friend's device to self-heal.
**Root cause:** `app/phone/sw.js` and `app/controller/sw.js` used a **cache-first** fetch handler for every non-`/api/` non-`/assets/` GET. Once the app shell was cached, the SW intercepted every navigation and served the cached HTML without ever hitting the network. There was also no kill switch: no way for the SW to notice the server had moved on and it should tear itself down.
**Fix (two parts):**
1. **Unbrick route** — added `app/unregister.html` served at `/unregister` with `Cache-Control: no-store`. The page unregisters every SW, deletes every cache, and clears local/session storage. A stuck device navigates to `https://<server>/unregister` once and self-heals. Route is registered **before** the `/app` static middleware in [staticServer.ts](server/src/staticServer.ts:57-59) so no SW can intercept it.
2. **Self-healing SWs** — rewrote all three SWs (phone, controller, new `app/display/sw.js`) from cache-first to **network-first for navigations AND static assets**. Cache is now only a fallback for offline use. `CACHE_NAME` is version-keyed (`gc-<role>-<SW_VERSION>`) and `SW_VERSION` is injected by the server at request time via a prepended `self.GC_SW_VERSION_INJECTED=...` line in [staticServer.ts:76-92](server/src/staticServer.ts:76). `activate` now fetches `/sw-version.json` and self-destructs (unregister + delete all caches + `postMessage({type:'sw-self-destructed'})`) when the server version has moved on.
3. **Client watchdog** — `app/shared/swRegistration.ts` fetches `/sw-version.json` **before** registering the SW and compares against an esbuild-baked `process.env.GC_BUILD_VERSION`. Mismatch → `caches.delete` all + `getRegistrations().unregister` all + `location.reload()`. Also subscribes to `sw-self-destructed` postMessage (reload on receipt) and polls `reg.update()` every 5 minutes. `updateViaCache: 'none'` ensures the browser always fetches the SW file fresh.
4. **Version plumbing** — `app/build.mjs` writes `app/<role>/dist/build-version.txt` and defines `process.env.GC_BUILD_VERSION` for esbuild. The server reads the txt file on startup (fallback: a fresh `srv-<ts>-<rand>` per boot). SW and client always agree on the version, the server is the source of truth, and a plain `npm run build` bumps it automatically.
5. **Bypass list** — all three SWs unconditionally skip `/api/`, `/assets/`, `/sw-version.json`, `/unregister`, and any path ending in `/sw.js`. The escape hatches can never be intercepted by a broken SW.
6. **SW registration moved** from inline `<script>` in each `index.html` to `registerServiceWorker()` in the corresponding `main.tsx` so the pre-register version check always runs, even on the first load after a rebuild.

Verified on startup: `GET /sw-version.json` → `{"version":"<build-version>"}`; `GET /app/{phone,controller,display}/sw.js` → `Service-Worker-Allowed: /<role>`, `Cache-Control: no-store`, body prefixed with `self.GC_SW_VERSION_INJECTED="<build-version>"`; all three main bundles contain the same version string via esbuild define. Worst case after this ships: one page load may still serve stale, but the next load always recovers.


## 2026-04-17 — Phase T0a Smoke Test

### T0a-B1: XP bar near-threshold pulse missed 40/45
**Symptom:** Character at 40 career XP vs level-2 threshold of 45 (→ 5 XP to level) did not trigger the class-accent pulse on the XP bar.
**Root cause:** `OverviewXPBar.tsx` used `progress >= 0.9` to decide near-threshold state. 40/45 = 0.888 — just under the 0.9 gate. The design brief says "within 10%", which read most naturally as 10% of the span but catches fewer small-span cases than an absolute remaining count.
**Fix:** Switched trigger to `(nextThreshold - careerXP) <= 10` — absolute XP remaining, not a percentage. Catches 40/45 cleanly and matches the brief's "within 10" phrasing more literally.

### T0a-B2: Wax seal muddled the XP numerator/denominator
**Symptom:** When a character reached or exceeded the threshold, the "LEVEL UP" seal painted over the right side of the parchment strip but the underlying `45 / 45` numeric label still showed through.
**Root cause:** The seal had a solid `--gilt-gold` background and 50% border-radius, but its footprint was smaller than the text label behind it. Text extended past the seal's rounded edge into visible negative space.
**Fix:** When `readyToLevel` is true, the XP numerator/threshold text is suppressed entirely — only the left-side `XP` label + right-side seal remain. The seal speaks for itself; numbers aren't needed at that moment.

### T0a-B3: Header menu backdrop was translucent + tap-outside didn't close
**Symptom:** Two bugs: (a) the `⋯` menu's backdrop was only 35% opaque, so the header title/subtitle and tab strip read clearly through it, muddling the menu's visual hierarchy. (b) Tapping anywhere outside the menu panel did not close the menu.
**Root cause (a):** `.player-sheet__menu` backdrop used `rgba(26, 20, 16, 0.35)` — too sheer for a modal occluder.
**Root cause (b):** The backdrop was a sibling `<button>` to the panel, both wrapped in a `display: flex` parent. Clicks in the empty regions of the flex container didn't land on the backdrop button's hit zone reliably.
**Fix (a):** Backdrop bumped to `rgba(26, 20, 16, 0.72)` + `backdrop-filter: blur(2px)` (both prefixed).
**Fix (b):** Restructured to the click-catcher pattern (same as `app/controller/overlays/OverlayBackdrop.tsx`): `handleBackdropClick` on the container `div`, `e.target === e.currentTarget` gates the close; panel uses `stopPropagation` on its own clicks.

### T0a-B4: Header menu's backdrop didn't dim tabs/content behind it
**Symptom:** After T0a-B3 landed, the menu's backdrop covered the header correctly but left the tab strip, XP bar, stat medallions, and Active Scenario section at full brightness — the menu appeared "on the same layer" as the sheet content instead of above it.
**Root cause:** Stacking-context trap. `PlayerSheetMenu` was rendered inside `PlayerSheetHeader`, which is a direct child of `.player-sheet`. The rule `.player-sheet > * { position: relative; z-index: 1 }` forced the header into a z-index-1 stacking context; any z-index the menu declared was trapped inside that context. Tabs and content, as later-DOM-order siblings of the header at the same z-index 1, painted over the menu.
**Fix:** Lifted `menuOpen` state from `PlayerSheetHeader` to `PlayerSheet`. The header now takes `menuOpen`/`onToggleMenu` as props. `PlayerSheet` renders `<PlayerSheetMenu>` as a direct child of `.player-sheet`, sibling to header/tabs/content. Added `:not(.player-sheet__menu)` to the `> *` z-index rule so the menu's own `z-index: 70` wins the cascade. The menu now correctly paints above all sheet content.

### T0a-B5: Controller quick-view had no exit and Active Scenario was inert
**Symptom:** Two bugs: (a) opening `PlayerSheetQuickView` on the controller left no way to close it — the sheet's `←` button was hidden because of `readOnly`, and the `OverlayBackdrop`'s X was occluded by the sheet's own fixed-position layer. (b) The Active Scenario section on the quick-view was read-only despite the spec calling for the GM to still adjust HP / conditions / long rest from there.
**Root cause (a):** `PlayerSheetHeader` treated the `←` close button as an editable affordance (gated on `!readOnly`). It's navigation, not a value mutation.
**Root cause (b):** `PlayerSheetQuickView` didn't thread any of the `onChangeHealth` / `onToggleCondition` / etc. props through to `PlayerSheet`, so the Active Scenario controls had no handlers and rendered `disabled`.
**Fix (a):** Show `←` close button unconditionally; only the `⋯` menu is hidden in read-only. Dropped the `OverlayBackdrop` wrapper since `PlayerSheet` is already a fixed-position full-screen modal.
**Fix (b):** `PlayerSheetQuickView` now calls `useCommands()` + `useGameState()` and wires HP / XP / condition / long rest / absent / exhaust / element handlers directly, using the same command pattern as the phone `ScenarioView`. Controller retains full GM control over the scenario-live character state.

---

### T1.1-B1: Display rewards tableau clung for the entire town phase
**Symptom:** After scenario completion, the full-bleed rewards tableau on the display stayed on screen through the whole town phase, blocking the (future) outpost map / town surfaces until the GM hit Town Phase Complete.
**Root cause:** Display overlay visibility was gated only on `state.finishData` existing, and per T1 design `finishData` persists from `prepareScenarioEnd` through `completeTownPhase` so phones can reconnect and still read the claimed snapshot. The display inherited that long lifetime by accident.
**Fix:** [app/display/App.tsx](app/display/App.tsx) now hides the overlay once `state.finish` is final (`'success'`/`'failure'`) AND every non-absent character's `finishData.characters[i].dismissed` flag is set. `finishData` itself is still preserved (phones remain authoritative source of reconnect truth); only the display's presentation is scoped to the rewards moment.

---

## 2026-04-17 — Phase T0b self-review fixes

### T0b-B1: New floating `⋯` nav overlapped the scenario header element board
**Symptom:** The initial T0b land mounted `ControllerNav`'s fixed-position `⋯` button in every controller mode. In scenario mode, its top-right position collided with the element board that already anchors the right side of `ScenarioHeader`, partially occluding element icons.
**Root cause:** Scenario mode already has a `☰` in the header that opens `MenuOverlay`. Adding a second floating nav was redundant visual weight that happened to land on top of the element board.
**Fix:** [app/controller/App.tsx](app/controller/App.tsx) only renders `ControllerNav` when `mode !== 'scenario'`. The Party Sheet opener is lifted to App.tsx state and threaded into [ScenarioView.tsx](app/controller/ScenarioView.tsx) via an `onOpenPartySheet` prop, then passed into the existing `MenuOverlay` mount — so the hamburger has the Party Sheet entry across every mode with zero duplicate affordance.

### T0b-B2: No escape hatch on display during the decorative Party Sheet
**Symptom:** When the display rendered `DisplayPartySheetView` in idle lobby / town, there was no way to reach the `DisplayConfigMenu` (game code + Disconnect). Other display views expose it via clickable text (round number / edition title / "Town Phase" title), but the decorative sheet fills the canvas with no text chrome of its own.
**Root cause:** The view was built as read-only with zero tap targets, following the sheet's "no interactions on display" contract — but that contract left the display with no way out short of navigating to `/unregister`.
**Fix:** [app/display/views/DisplayPartySheetView.tsx](app/display/views/DisplayPartySheetView.tsx) renders an invisible 96×96 `<button>` pinned to the top-left corner that forwards to `onOpenMenu` (same menu the other display views use). Matches the positional-hot-zone idiom used in kiosk-style screens.

### T0b-B3: No way to exit a scenario without committing Victory or Defeat
**Symptom:** Pre-T0b, the only scenario exits were `Scenario Complete (Victory)` and `Scenario Failed (Defeat)`, both of which transfer rewards and record the scenario in `party.scenarios`. Legitimate real-world need — "we started the wrong scenario" / "we need to reset" / "we're done playing" — had no first-class path.
**Root cause:** Historical gap in the scenario lifecycle model.
**Fix:** Added `abortScenario` command (GM-only, validator rejects unless `mode === 'scenario'`). Handler clears scenario combat state identically to `handleCompleteScenario`'s cleanup block — monsters / non-character figures / HP / conditions / summons / in-scenario counters / elements / round+phase — but skips the rewards transfer and does NOT append to `state.party.scenarios`. Transitions `state.mode = 'lobby'` directly (skipping town, which is a reward-resolution surface and has nothing to resolve for an aborted scenario). Exposed as "Cancel Scenario" in the new [ScenarioControlsOverlay.tsx](app/controller/overlays/ScenarioControlsOverlay.tsx) with two-step inline confirmation.

### T0b-B4: `'scenarioSetup'` overlay type was orphaned dead code (latent)
**Symptom:** `ScenarioView.tsx` passed `onOpenSetup={() => setActiveOverlay({ type: 'scenarioSetup' })}` to `MenuOverlay`, but `'scenarioSetup'` was not in the `OverlayState` discriminated union. `tsc --noEmit` flagged the mismatch; runtime silently never rendered anything for that menu item. Left behind from the Batch 16b lobby-view refactor that moved scenario setup out of ScenarioView overlays.
**Root cause:** Incomplete cleanup in the earlier refactor — the caller was never pruned when the overlay type was removed from the union.
**Fix:** Side effect of the T0b scenario-controls restructure. `onOpenSetup` dropped entirely from the `MenuOverlay` mount in `ScenarioView` (scenario-specific flows now cluster in `ScenarioControlsOverlay`, triggered by clicking the scenario name). The orphan call was removed and `tsc --noEmit` is clean for this file again.

### 2026-04-18 — Dev sandbox HTTP mode (Claude Code preview verification)
**Symptom:** Every recent batch's (T0b / T0c / T0d) browser smoke verification
was skipped because sandboxed preview Chromium — the browser Claude Code
drives in its preview tools — can't verify the local-CA certs the dev HTTPS
server presents. Previews hung at `chrome-error://chromewebdata/` and no UI
ever loaded, blocking the `<verification_workflow>` step.
**Root cause:** `server/src/index.ts` defaults to HTTPS whenever `findCerts()`
returns a match. On Kyle's dev machine that's always — Certbot manages certs
in `C:\Certbot\live`. The sandboxed browser has no host CA store and rejects
the cert. No opt-out existed.
**Fix:** Opt-in `GC_DEV_HTTP=1` env var skips `findCerts()` and creates a
plain HTTP server. Hard-bound to `127.0.0.1` with a startup fatal if paired
with any non-loopback `GC_BIND_HOST` — unencrypted HTTP can never accidentally
land on a LAN interface via this path. New `scripts/dev-sandbox.mjs` wrapper
and `npm run dev:sandbox` script set the env vars cross-platform without a
`cross-env` dependency. Default `npm run dev` and all playtest / production
flows are unchanged.
**Follow-up:** Future batches that include UI changes run browser smoke under
`npm run dev:sandbox`. See `docs/DEV_PREVIEW.md` and the "Browser Preview
Verification" section of `CLAUDE.md`.
