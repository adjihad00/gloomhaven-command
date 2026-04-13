# Post-Batch Playtest — Verify All 6 Fix Batches

Run through Scenario 1 (Black Barrow) as a 3-player GH game, then briefly
test an FH scenario for loot deck. Focus on previously broken items.
Categories: [LAYOUT] [INTERACTION] [WORKFLOW] [MISSING] [VISUAL] [BUG]

---

## 1. Connection + Edition Selection (2 min)

- [- ] Page loads on iPad
- [. ] Connect to fresh game code
- [ -] Edition selector appears (GH, FH, etc. with colored cards)
- [ -] Select Gloomhaven → proceeds to scenario view
- [ -] Edition persists on refresh (doesn't re-prompt)

## 2. Scenario Setup (5 min)

- [ .] Open ☰ → Scenario Setup
- [- ] Character class grid shows GH classes with thumbnails
- [. ] Add Brute L3 (HP should be 14)
- [. ] Add Spellweaver L3 (HP should be 8)
- [. ] Add Cragheart L4 (HP should be 16)
- [. ] Level auto-calculates (~2)
- [. ] Difficulty labels show (Very Easy through Nightmare)
- [- ] Scenario list defaults to unlocked only
- [ .] Search "black" → finds Black Barrow
- [ .] Select → preview shows monsters + Room 1 spawns
- [ .] Confirm → overlay AUTO-CLOSES (V4 fix)
- [ .] Monsters auto-spawn on main screen with correct HP

## 3. Layout Verification (3 min)

- [. ] Figure cards in multi-column grid (~3 columns landscape)
- [. ] Character cards: HP bar header with name L / HP R
- [- ] Blood drop +/- buttons visible on character cards
- [. ] HP +/- works WITHOUT opening overlay (B7 fix)
- [. ] Condition toggle icons visible on character cards (L5 fix)
- [. ] Monster cards: portrait + name + ability actions (no stat table)
- [. ] Monster standee rows compact with number + HP +/- + conditions
- [. ] No card extends full width of screen
- [. ] Bottom card NOT obscured by footer (B10 scroll fix)

## 4. Header + Elements (2 min)

- [. ] Elements in top-right of header (not footer)
- [. ] All 6 element icons load
- [. ] Elements are larger than previous version
- [ .] Tap element → cycles state
- [. ] Strong = full color + glow (element-colored: fire=red, ice=blue)
- [ .] Waning = HALF-FILLED bottom (not just dimmed) — V1 fix
- [ .] Inert = small + greyed
- [ .] Active elements physically larger than inert

## 5. Footer (1 min)

- [ .] Phase button on left
- [ -] Door icons in center
- [ .] Trap/Gold/XP/Hazard pills in center (moved from header — V2 fix)
- [ .] Modifier deck badge on right
- [ .] Scenario header shows "#1 - BLACK BARROW, LEVEL 2" (V3 fix)

## 6. Initiative Numpad (3 min)

- [. ] Tap character initiative area → numpad overlay appears (I1 fix)
- [. ] Numpad has dark fantasy styling (gold border, Cinzel font)
- [. ] Tap 1, 5 → display shows "15"
- [. ] Backspace (⌫) removes last digit
- [. ] SET button enables when input has value
- [. ] Tap SET → initiative set, numpad closes
- [. ] Set all 3 character initiatives
- [. ] Long Rest button (⏸ Rest) works — sets initiative to 99
- [. ] Cancel closes without changing
- [. ] Backdrop tap closes numpad
- [. ] Keys are large enough for comfortable iPad tapping

## 7. Start Round + Ability Cards (3 min)

- [. ] "Start Round" button enabled when all initiatives set
- [. ] Tap → monster ability cards auto-drawn
- [. ] Each monster group shows initiative number from ability card
- [. ] Ability actions show resolved values (Move X, Attack N/E)
- [. ] Figures re-sorted by initiative (lowest first)
- [. ] First figure auto-activated (gold glow)
- [. ] Dead monster groups NOT in turn order (B6 fix)

## 8. Turn Advancement (5 min)

- [. ] Tap active figure's portrait → turn ends, card dims
- [. ] Next figure auto-activates with glow
- [ .] Monster group header clickable to end monster turn
- [ .] Active glow clearly visible
- [ .] Done state clearly dimmed
- [ .] "Next Round" shows in footer (not "Next Turn")
- [. ] No double-tap zoom on portrait taps (I2 fix)
- [. ] No blue flash on any tap (iOS)

## 9. Condition Engine — THE BIG TEST (5 min)

### Strengthen expiry (B1 fix):
- [. ] Apply Strengthen to Brute (tap condition icon on card)
- [. ] Condition icon highlights green on Brute's card
- [. ] End Brute's turn → Strengthen still active
- [. ] Next round, end Brute's turn again → Strengthen EXPIRES (removed)

### Wound + Regenerate (B2 fix):
- [. ] Apply Wound to a monster standee
- [. ] Apply Regenerate to same standee
- [. ] On standee's next turn start: Wound should be REMOVED by Regenerate
- [. ] HP should NOT change (heal consumed by removing wound)

### Wound alone:
- [ .] Apply Wound to a different standee
- [ .] On standee's turn start: takes 1 damage from wound
- [ .] HP decreases by 1

### Poison +1 damage (B4 fix):
- [. ] Apply Poison to a character
- [ -] Deal 2 damage via HP -/- (tap minus twice)
- [ -] Character should lose 3 HP total (2 + 1 from poison)

### Bane (FH — skip if GH only):
- [ ] If testing FH: apply Bane, verify 10 damage at end of next turn

## 10. Monster Conditions (3 min)

- [. ] Monster standee row shows active conditions as icons
- [. ] "+" button on standee opens condition picker (B8 fix)
- [. ] Select a condition → icon appears on standee row
- [. ] Tap active condition icon on standee → removes it
- [. ] Condition picker popup closes after selection

## 11. Health + Kill (3 min)

- [. ] Character HP +/- via blood drop buttons on card (no overlay)
- [. ] Monster standee HP +/- works
- [. ] Reduce standee to 0 → standee dies (dimmed/removed — B5 fix)
- [. ] Dead standees shown as small ☠ badges
- [ .] Rapid taps on +/- work without zoom (I2 fix)

## 12. Room Reveal (2 min)

- [- ] Footer shows closed door icons for rooms 2, 3
- [. ] Tap door → room reveals
- [. ] New monsters auto-spawn with correct HP
- [. ] Door icon changes to revealed state
- [. ] New standees in existing groups or new groups created

## 13. End of Round (3 min)

- [. ] All figures done → "Next Round" enabled
- [. ] Tap "Next Round"
- [ .] Elements decay (strong → waning, waning → inert)
- [ .] Round counter increments
- [ .] Initiatives cleared
- [ .] Phase returns to "Card Selection"
- [ .] Expired conditions removed (strengthened should be gone after 2 rounds)

## 14. Round 2 Full Cycle (3 min)

- [ .] Set new initiatives via numpad
- [ .] Start round → NEW ability cards (different initiatives)
- [ .] Turn order different from round 1
- [ .] Complete all turns → end round 2

## 15. Character Detail + Sheet (3 min)

- [. ] Tap character name → detail overlay opens
- [. ] HP, XP, Gold controls work in overlay
- [ .] Full condition grid available
- [ .] Mark Absent at BOTTOM of overlay (I4 fix)
- [ .] Backdrop tap closes overlay (I5 fix)
- [ .] Character sheet button visible in overlay
- [ .] Tap sheet button → Character Sheet opens (tabbed)
- [ .] Stats tab: level, XP/threshold, HP, hand size
- [ .] Perks tab: shows perk list from class data
- [ .] Tabs switch cleanly

## 16. Character Name (2 min)

- [. ] In character detail overlay, tap name → edit mode
- [. ] Type custom name → saves on blur/Enter
- [. ] Character card shows custom name
- [. ] Name persists through rounds

## 17. Monster Modifier Deck (2 min)

- [. ] Footer shows modifier deck badge
- [ .] Tap → expanded panel with draw/shuffle/bless/curse
- [ -] Draw → last drawn card type displayed with color
- [ .] Bless/curse counts shown

## 18. Party Persistence (2 min)

- [ .] Open Scenario Setup
- [ .] Set a different scenario (Scenario 2 if unlocked)
- [ .] Characters persist (don't need to re-add)
- [ .] HP reset to max
- [ .] Conditions cleared
- [ .] XP/gold preserved from previous scenario

## 19. Modifier Deck (quick FH test — 3 min)

- [. ] Start new game or switch edition to FH
- [. ] Add FH characters, select FH scenario
- [- ] Loot deck badge appears in footer (🃏)
- [- ] Tap → loot deck overlay opens
- [- ] Draw card → resource card with icon appears
- [- ] Assign to character works
- [- ] GH scenario: loot deck NOT shown (correct)

## 20. General iPad UX (throughout)

- [. ] No double-tap zoom anywhere (I2 fix)
- [. ] No blue tap flash on iOS
- [. ] Overlays close on backdrop tap (I5 fix)
- [. ] Scrolling smooth
- [. ] All text readable at arm's length
- [. ] Landscape orientation stable
- [. ] Brief portrait test — does it work?

---

## Issue Log

Format: `[CATEGORY] Description — where/when`

-webapp on ipad won't connect or reload without an open chrome window.
-Open new game with new code: Scenario Setup button displays scenario setup overlay. This should first show edition selection in a new party. Then Party generation. Then Scenario setup.
-webapp on ios connection stalled after period of inactivity. Had to minimize refresh chrome and reload.
-bane, brittle, impair, ward all showing in GH scenarios.
-EXP/GOLD icons not consistent with GH/FH iconology. this needs to be adjusted.
2. scenario setup
-Descriptions of names of characters with cards, appropriately colored but no thumbnail images
-New game in GH with 35 scenarios unlocked. should only be 1 at start of new game
3. Layout Verification
-Heart for health instead of blood drop (lets build an image of a blood drop to universally represent health if we can't find one in the GHS assets)
5. footer
-no door icons for new rooms. Would like to have an svg Icon of closed door and open doors (silohettes) to represent unopened and opened doors
-door toggles are left justified, not a big deal
-trap, gold, exp, hazard, centered and appropriate but the icons aren't the GH/FH icons. Can we find the appropriate icons in the GHS assets or develope icons that are consistent with FH/GH iconology.
-Modifier deck: When opened adjusts the width of the base. Should be a floating overlay that comes up.
-Modifier deck: says 0/0 as if there are no monster attack modifiers
6. Initiative Numpad
-Rest: lets make an SVG icon with zzz's in sleeping pattern. There is something similar in the GHS assets, indicated iniative should also show this symbol rather than REST
9. Condition Engine:
-poison. Everytime you click - does 2 damage instead of waiting until all damage resolved then offering +1.
10. Condition picker:
-overlay still disappears when extending upward beyond limits of the card it originates from
12. Room reveal:
-Clicking button to open room should prompt with an overlay/text "Do you want to open X?" accidental taps at this point automatically move the game forward causing issues.
15. Character Detail:
-Marking absent does not remove from initiate etc. If a character is absent their card should be hidden and their character image displayed in the bottom footer on a "bench" section
-XP threshholds: lets use UI/UX pro to develope a fillbar that shows as a percentage to the next level, E.G level 1 0-45 and fills as you gain xp, then level 2 it auto adjusts to 100% being 95, so on and so forth.
18. Party Persistance:
-EXP should be thought of in 2 categories. In scenario: Exp starts at zero and is collected throughout the scenario. Scenario End: All in scenario EXP collected is then moved to the total exp pool on the character sheet that is used to tabulate if the character levels up. Also any character created not at level 1 should have whatever level they are created at's minimum exp. for instance making the gragheart at level 4 he should have 150 total exp on his character sheet not 0.



*(Fill in during testing)*

