# Full Playtest — Post-Batch 11

Run through Scenario 1 (Black Barrow) as a 3-player GH game, then switch to
an FH scenario for loot deck + FH conditions. Focus on batches 7-11 fixes
while re-verifying batches 1-6.

Categories: [LAYOUT] [INTERACTION] [WORKFLOW] [MISSING] [VISUAL] [BUG]

---

## 1. PWA + Connection (3 min)

- [. ] Load /controller on iPad in Safari
- [. ] Add to Home Screen → launches in standalone mode
- [. ] Standalone: page loads (service worker caches app shell)
- [. ] Connect to game code → WebSocket connects
- [ -] Connection persists on refresh (session token restored)
- [. ] Put iPad to sleep for 30 seconds → wake → auto-reconnects
- [ .] Minimize Safari for 1 minute → return → auto-reconnects
- [ .] No stale "connected" state after sleep (health check fires)

## 2. Setup Wizard — New Game (5 min)

- [ .] Open ☰ → Scenario Setup on a fresh game (no characters)
- [ .] Step 1 — Edition: edition cards visible (GH, FH, etc.)
- [. ] Select GH → gold border highlights
- [. ] "Next: Add Characters" button enabled
- [. ] Step 2 — Party: class grid shows GH classes with thumbnails (B10.1)
- [. ] Thumbnail circles visible for each class (not broken images)
- [. ] Add Brute L3 (HP should be 14)
- [. ] Add Spellweaver L3 (HP should be 8)
- [. ] Add Cragheart L4 (HP should be 16)
- [. ] Cragheart character sheet shows XP: 150/210 (B7.5)
- [. ] Party list shows all 3 with level + HP
- [. ] "Back: Edition" returns to edition step
- [. ] "Next: Select Scenario" enabled (3 characters added)
- [. ] Step 3 — Scenario: level auto-calculates (~2)
- [. ] Difficulty labels show (Very Easy through Nightmare)
- [. ] Scenario list shows only Scenario 1 unlocked (B7.4)
- [. ] Search "black" → finds Black Barrow
- [. ] Select → preview shows monsters + Room 1 spawns
- [. ] Confirm → overlay closes, monsters auto-spawn

## 3. Scenario Start State (2 min)

- [. ] All character XP dials show 0 (B9.1a)
- [. ] All character loot counters show 0 (B9.1a)
- [. ] Monster modifier deck shows 20/20 (B7.2)
- [. ] Condition row shows exactly 10 GH conditions (B7.3)
- [. ] NO bane, brittle, impair, ward, regenerate, infect
- [. ] Monsters auto-spawned with correct HP

## 4. Layout Verification (3 min)

- [. ] Figure cards in multi-column grid (~3 columns landscape)
- [. ] Character cards: HP bar header with name L / HP R
- [. ] Blood drop icon on +/- buttons (B10.2 — not heart)
- [. ] HP +/- works WITHOUT opening overlay
- [. ] Condition toggle icons visible on character cards
- [. ] Monster cards: portrait + name + ability actions
- [. ] Monster standee rows compact with number + HP +/- + conditions
- [. ] No card extends full width of screen
- [. ] Bottom card NOT obscured by footer

## 5. Header + Elements (2 min)

- [. ] Elements in top-right of header
- [. ] All 6 element icons load
- [. ] Tap element → cycles state
- [. ] Strong = full color + glow
- [. ] Waning = half-filled bottom (clip-path)
- [. ] Inert = small + greyed
- [. ] Active elements physically larger than inert

## 6. Footer (2 min)

- [. ] Phase button on left
- [. ] Door icons: closed door SVG silhouettes for unrevealed rooms (B10.4)
- [. ] Trap pill: trap jaw icon (B10.5 — not ⚠ emoji)
- [. ] Gold pill: coin icon (B10.5 — not 💰 emoji)
- [. ] XP pill: angular star icon (B10.5 — not ★ emoji)
- [. ] Hazard pill: hazard icon (B10.5 — not ☣ emoji)
- [. ] Modifier deck badge on right — shows remaining count
- [. ] Scenario header shows "#1 - BLACK BARROW, LEVEL 2"
- [. ] GH scenario: loot deck badge NOT shown (correct)

## 7. Initiative Numpad (3 min)

- [. ] Tap character initiative area → numpad overlay appears
- [. ] Dark fantasy styling (gold border, Cinzel font)
- [. ] Tap 1, 5 → display shows "15"
- [. ] Backspace (⌫) removes last digit
- [. ] SET button enables when input has value → sets initiative
- [. ] Set all 3 character initiatives
- [. ] Long Rest button shows zzz icon + "Rest" label (B10.6 — not ⏸)
- [. ] Long Rest sets initiative to 99
- [. ] Initiative display shows zzz icon when on Long Rest (B10.6 — not "REST" text)
- [. ] Cancel closes without changing
- [. ] Backdrop tap closes numpad
- [. ] Keys large enough for comfortable iPad tapping

## 8. Start Round + Ability Cards (3 min)

- [. ] "Start Round" button enabled when all initiatives set
- [. ] Tap → monster ability cards auto-drawn
- [. ] Each monster group shows initiative from ability card
- [. ] Ability actions show resolved values (Move X, Attack N/E)
- [. ] Figures re-sorted by initiative (lowest first)
- [. ] First figure auto-activated (gold glow)
- [. ] Dead monster groups NOT in turn order

## 9. Turn Advancement (3 min)

- [. ] Tap active figure's portrait → turn ends, card dims
- [. ] Next figure auto-activates with glow
- [. ] Monster group header clickable to end monster turn
- [. ] Active glow clearly visible
- [ .] Done state clearly dimmed
- [. ] "Next Round" shows in footer
- [. ] No double-tap zoom on portrait taps
- [. ] No blue flash on any tap (iOS)

## 10. XP + Gold Tracking During Scenario (3 min)

- [. ] CharacterBar XP counter: angular star icon (B10.3)
- [. ] CharacterBar gold counter: coin with inner ring (B10.3)
- [. ] Tap XP star → increments character.experience (scenario dial)
- [. ] Tap XP star 5 times → shows 5
- [. ] Character sheet during scenario: total XP still 150 (unchanged)
- [. ] XP fill bar in character sheet shows correct range (B9.2)
  - [. ] Cragheart L4: "XP — Level 4 → 5", 150/210
  - [. ] Fill bar at 0% (no scenario XP transferred yet)
  - [. ] "60 XP to next level" text below bar

## 11. Condition Engine (5 min)

### Strengthen expiry:
- [. ] Apply Strengthen to Brute
- [. ] Condition icon highlights on card
- [. ] End Brute's turn → Strengthen still active
- [. ] Next round, end Brute's turn → Strengthen EXPIRES

### Wound + Regenerate:
- [ ] Apply Wound to a monster standee
- [ ] Apply Regenerate to same standee
- [ ] On standee's turn start: Wound REMOVED by Regenerate
- [ ] HP should NOT change

### Wound alone:
- [. ] Apply Wound to a different standee
- [. ] On standee's turn start: takes 1 damage from wound
- [. ] HP decreases by 1

### Poison (B7.1):
- [. ] Apply Poison to a character
- [. ] Tap minus once → deals exactly 1 damage (NOT 2)
- [. ] +1 badge visible next to minus button as reminder
- [- ] Wound at turn start on poisoned entity → deals 2 (1 wound + 1 poison)

## 12. Monster Conditions (2 min)

- [. ] Standee row shows active conditions as icons
- [. ] "+" button opens condition picker
- [. ] Condition picker popup fully visible (B8.1 — not clipped)
- [. ] Popup appears above button, not cut off by scroll container
- [. ] Select condition → icon appears on standee row
- [. ] Tap active condition icon → removes it
- [. ] Backdrop tap closes picker

## 13. Health + Kill (2 min)

- [. ] Character HP +/- via blood drop buttons on card
- [. ] Monster standee HP +/- works
- [. ] Reduce standee to 0 → standee dies (dimmed/removed)
- [. ] Dead standees shown as small ☠ badges
- [. ] Rapid taps work without zoom

## 14. Room Reveal (3 min)

- [. ] Footer shows closed door SVG icons for rooms 2, 3 (B10.4)
- [. ] Tap door → confirmation overlay appears (B8.2)
- [. ] Confirmation shows "Open door to Room X (ref)?"
- [. ] Cancel → door unchanged, no monsters spawn
- [. ] "Open Door" → room reveals, new monsters auto-spawn
- [. ] Door icon changes to open door SVG (B10.4)
- [. ] Backdrop tap dismisses confirmation

## 15. Modifier Deck (3 min)

- [. ] Footer badge: tap opens floating overlay ABOVE footer (B8.4)
- [. ] Footer does NOT shift or resize when overlay opens
- [. ] Overlay shows remaining/total count (e.g., 20/20)
- [. ] Draw → card type displayed with color (e.g., +1 green, -1 red)
- [. ] Count decrements after draw
- [. ] Shuffle works
- [. ] Bless/Curse +/- buttons functional
- [. ] Close button (×) or backdrop tap closes overlay

## 16. Absent Character (3 min)

- [. ] Open character detail → Mark Absent
- [. ] Character card HIDDEN from figure grid (B8.3)
- [. ] Bench strip appears below grid with greyscale portrait (B8.3)
- [. ] "Bench" label visible
- [. ] Tap bench portrait → character detail overlay opens
- [. ] Absent character excluded from initiative order
- [. ] Unmark absent → card returns to grid, bench strip disappears

## 17. End of Round (2 min)

- [. ] All figures done → "Next Round" enabled
- [. ] Tap "Next Round"
- [. ] Elements decay (strong → waning, waning → inert)
- [. ] Round counter increments
- [. ] Initiatives cleared
- [. ] Phase returns to "Card Selection"
- [. ] Expired conditions removed

## 18. Round 2 Full Cycle (2 min)

- [. ] Set new initiatives via numpad
- [. ] Start round → NEW ability cards
- [. ] Turn order different from round 1
- [. ] Complete all turns → end round 2

## 19. Character Detail + Sheet (3 min)

- [. ] Tap character name → detail overlay opens
- [. ] HP, XP, Gold controls work in overlay
- [. ] Full condition grid available
- [. ] Mark Absent at bottom of overlay
- [. ] Backdrop tap closes overlay
- [. ] Character sheet button visible → tap opens sheet
- [. ] Stats tab: level, XP fill bar, HP, hand size (B9.2)
- [. ] Perks tab: shows perk list from class data
- [. ] Tabs switch cleanly

## 20. Character Name (1 min)

- [. ] In detail overlay, tap name → edit mode
- [. ] Type custom name → saves on blur/Enter
- [. ] Character card shows custom name
- [. ] Name persists through rounds

## 21. Scenario End — Victory (3 min)

- [. ] Give Brute 5 XP via tap, 3 loot via tap during scenario
- [. ] Open ☰ → "Scenario Complete (Victory)"
- [. ] In-scenario XP (5) transfers to progress.experience
- [. ] Bonus XP added (4 + 2*level = 8 at level 2)
- [. ] Brute total XP increased by 13 (5 scenario + 8 bonus)
- [- ] Loot converted to gold: 3 coins × 3 gold/coin (level 2) = 9 gold
- [. ] Scenario recorded in party.scenarios
- [. ] Character.experience reset to 0
- [. ] Character.loot reset to 0

## 22. Party Persistence After Victory (2 min)

- [. ] Open Scenario Setup
- [. ] Setup opens to scenario step (characters exist)
- [. ] Characters persist (don't need to re-add)
- [- ] Total XP/gold preserved from completed scenario
- [. ] Scenario 1 completed → unlocked scenarios now include those Scenario 1 unlocks

## 23. FH Test — Loot Deck + Conditions (5 min)

- [. ] Start new game or switch edition to FH
- [. ] Setup wizard starts at edition step → select FH
- [. ] Add FH characters, select FH scenario
- [. ] Condition row shows 16 FH conditions (B7.3)
- [. ] Includes bane, brittle, impair, ward, regenerate, infect
- [. ] Loot deck badge appears in footer (B11.4)
- [. ] Badge shows correct card count
- [. ] Tap badge → loot deck overlay opens
- [. ] Draw card → resource card with type shown (lumber, metal, hide, etc.)
- [. ] Loot card icons use GHS FH assets (not emoji)
- [. ] Gold cards show coin value (×1, ×2, ×3)
- [. ] Assign to character works
- [. ] GH scenario: loot deck NOT shown (correct)

## 24. General iPad UX (throughout)

- [. ] No double-tap zoom anywhere
- [. ] No blue tap flash on iOS
- [. ] Overlays close on backdrop tap
- [. ] Scrolling smooth
- [. ] All text readable at arm's length
- [. ] Landscape orientation stable
- [. ] Brief portrait test — does it work?
- [. ] All SVG icons render cleanly (no emoji visible anywhere)

---

## Issue Log

Format: `[CATEGORY] Description — where/when`
-REST doesn't restore 2 health as it should when the resting character becomes active
-wound only deals 1 damage per turn even with poison not 2 when poison preset(this is how it should work.)
-disconnect and reconnect the connection seems to be lost with the safari standalone, requires refresh in safari to reconnect.
-in frosthaven gold tracked appropriately other loot items are not tracked on the character sheet
12:
-condition overlay could be larger, doesn't show positive effects
15:
-bless and cures cards should be removed from AMD after being drawn, not reshuffled in with the rest.
16:
-Bench overlay covers up the initiative entry overlay when the bench is present
21:
-active monsters remain on the board after scenario complete
-should be a scenario summary overlay after clicking complete that shows what everyone will get based on their exp, bonus exp, loot tokens and multiplier, etc
22:
-exp carries over appropriately on character card, gold isn't being tracked


*(Fill in during testing)*

