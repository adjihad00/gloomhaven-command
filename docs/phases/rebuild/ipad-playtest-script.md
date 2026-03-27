# Phase R Controller — iPad Playtest Script

Run through Scenario 1 (Black Barrow) as a 3-player game.
Report every issue with category tag. Fix nothing — capture everything.

Categories: [LAYOUT] [INTERACTION] [WORKFLOW] [MISSING] [VISUAL] [BUG]

---

## 1. Connection (2 min)

- [x ] Page loads on iPad Safari/Chrome
- [x] Game code input is tappable, keyboard appears
- [ x] Connect button works
- [ x] Connection status shows connected

## 2. Scenario Setup (5 min)

- [x ] Open menu (☰) → Scenario Setup
- [x ] Edition dropdown shows GH selected
- [x ] Character class grid loads with real GH classes
- [x ] Character thumbnails load (not broken images)
- [x ] Tap Brute → Brute added at selected level
- [ x] HP shows correct value for level (Brute L3 = 14)
- [x ] Add Spellweaver L3, Cragheart L4
- [x ] Level auto-calculates (should be ~2)
- [ x] Level derived values show (Trap, Gold, XP, Hazard)
- [ x] Scenario list loads with real scenarios
- [ x] Search works (type "black" → finds Black Barrow)
- [ x] Select Scenario 1 → preview shows monsters + Room 1 spawns
- [ x] "Start Scenario" → monsters auto-spawn on main screen
- [ x] Close overlay → main screen shows characters + monsters
- [ x] Footer shows door icons for rooms 2 and 3

## 3. Draw Phase — Round 1 (3 min)

- [x ] Phase shows "Card Selection"
- [. ] Footer button says "Set Initiatives..." (disabled)
- [ .] Tap Brute initiative area → input appears
- [ .] Enter 15 → value shows
- [ .] Set Spellweaver to 07
- [ .] Set Cragheart to 42
- [ .] Footer button changes to "Start Round" (enabled, gold)
- [0] Number inputs are easy to tap and type on iPad
- [0 ] Keyboard doesn't obscure the UI badly

## 4. Start Round (2 min)

- [ .] Tap "Start Round"
- [ .] Monster ability cards auto-drawn (each group shows initiative + actions)
- [ .] Figures re-sorted by initiative (Spellweaver first at 07)
- [.] First figure auto-activated (gold glow)
- [. ] Monster ability values show normal/elite resolved (e.g., "Move 3/2, Attack 2/3")
- [ .] Footer button changes to "Next Round"
- [ 0] All figures visible without excessive scrolling

## 5. Turn Advancement — Play Phase (5 min)

- [ .] Tap active figure's portrait → turn ends, bar dims
- [. ] Next figure auto-activates (gold glow)
- [. ] Continue through ALL figures
- [ .] Monster group turn ends via header/portrait tap
- [ .] Turn order matches initiative (lowest first)
- [ .] Active glow is visible and clear on iPad
- [ .] Dimmed (done) state is clearly different from active and waiting

## 6. Health Manipulation (3 min)

- [. ] Tap a character's HP area → detail overlay opens
- [0 ] HP +/- buttons work (value updates)
- [ .] HP bar color changes (green → yellow → red)
- [ .] Close overlay → main screen reflects HP change
- [ .] Monster standee HP +/- works (in MonsterGroup component)
- [ .] +/- tap targets are large enough on iPad (not fiddly)
- [ .] Rapid tapping works (no missed taps)

## 7. Conditions (3 min)

- [ .] Open character detail overlay
- [. ] Condition grid shows condition icons (real SVGs, not broken)
- [. ] Tap Wound → icon highlights red
- [ .] Tap Strengthen → icon highlights green
- [ .] Close overlay → condition icons show inline on character bar
- [ 0] Monster standee conditions work (via what UI?)
- [ 0] Condition icons are recognizable at iPad size

## 8. Elements (2 min)

- [ .] Element board visible in footer
- [ .] All 6 element icons load (fire, ice, air, earth, light, dark)
- [ .] Tap an element → cycles state (visual changes)
- [ .] Inert = dim/grey, Strong = glowing, Waning = pulsing/faded
- [ 0] Element icons are large enough to tap accurately in footer

## 9. End of Round (3 min)

- [ .] After all figures complete, "Next Round" enabled
- [ .] Tap "Next Round"
- [ .] Elements decay (strong → waning, waning → inert)
- [ 0] Round counter increments
- [ .] Initiatives cleared
- [ .] Phase returns to "Card Selection"
- [ 0] Condition that should expire is gone (if Strengthen was applied)

## 10. Round 2 — Verify Full Cycle (5 min)

- [. ] Set new initiatives
- [. ] Start round — NEW monster ability cards drawn (different from Round 1)
- [ .] New initiative order (may differ from Round 1)
- [ .] Play through round 2
- [ .] Wound damage applied at turn start (if wound is on a figure)
- [ 0] End round 2 — everything resets correctly

## 11. Room Reveal (3 min)

- [ .] Footer shows closed door icons
- [ .] Tap a door → room reveals
- [ .] New monsters auto-spawn with correct HP
- [ .] Door icon changes to revealed/open state
- [ .] New standees appear in existing groups or new groups

## 12. Monster Kill (2 min)

- [ .] Reduce a monster standee to 0 HP
- [ .] Standee shows dead state (dimmed/removed)
- [ .] Or use kill button if available
- [ 0] Dead standees don't interfere with turn order

## 13. General iPad UX (throughout)

- [. ] Text is readable at iPad arm's length
- [ .] No horizontal scrolling
- [ .] Scrolling is smooth (no jank)
- [ 0] Overlays are easy to close (X button or backdrop tap)
- [ .] Nothing overflows off screen in landscape
- [ .] Portrait orientation — does it work or break?
- [ .] Double-tap doesn't zoom (viewport meta prevents it)
- [ 0] No rubber-banding on scroll boundaries
- [ .] Reconnects cleanly if you background the app briefly

---

## Issue Log

Format: `[CATEGORY] Description — where/when it happens`

*(Fill in during testing)*

scenario setup:
--Class symbols for adding/removing characters
--scenario level in setup -> Difficulty modifier -2, -1, 0, +1, +2, +3, +4
--overlay should automatically close upon clicking start scenario

Campaign mode:
--Scenario setup shows all scenarios. Would like it to be filtered similar to GHS, only showing unlocked scenarios, and a filter hiding previously completed scenarios. Thought we could a filter for unlocked scenarios with unlooted treasure chests as well
--Edition selection should occur immediately after connection screen. There could still be an option for edition swap at the bottom of scenario setup but ultimately the edition thats being put on the table is going to be consistent during a session and wont change once connected to the game code for that group, unless they complete one and move on to another.
--Where is the party kept track of will this be added?, Do I have to add the character's back everytime
--I can't edit their names
--There is no character/player sheet viewer for the controller, DM will need to be able to view this info

Display:
-Top: Scenario Name and level should be centered in top screen
--Rather than scenario number (#1- LEVEL 2), I would prefer (#1- BLACK BARROW, LEVEL 2) or something along those lines
--trap/gold/XP should swap places with elements, We may have to come up with a more prominent element display
-Bottom: #1 plus door Icons are perfect
--Set initiatives/round progress button looks good
--Again elements and Trap/gold/XP/hazard info should swap location
--Monster modifier deck (will this look different on main display?)
--Mark absent to close to close button, honeslty mark absent could be down at the bottom of the character overlay
--scroll limit, bottom character/monster is getting obscured by the bottom bar, need to have excess scoll space so the final card can move above the bottom bar
--Standees at 0 health don't dissappear
--rapid tapps on the +/- other icons on the overlays results in zoom actions

3. DRAW PHASE
-Initiative should bring up numpad overlay, to key in rather than type initiative, include set button along with set long rest button
--When all standees of one monster type are dead, no ability card is drawn but the monster card is still sorted amongst the turn order rather than the bottom.

6. Health manipulation
--entire character card too wide
--health bar takes up too much space
--Tapping +/- on health bar opens overlay rather than just manipulating health

7. Conditions
--Quicker condition manipulation would be helpful, icons could live on the character card without having to access the overlay on the controller and be toggle on/off
--Monster standee overlay not functional at all
--wound works and decreases health appropriately at the start of turn
--regenerate works and adds health appropriately at the start of turn
--Regenerate+Wound= health doesn't change but wound isn't cleared like it should be by regenerate
--Bane does not fire off like it should.
--all conditions that should clear after completion of next turn do not clear
--No poison telegraph to indicate an additional damage due to poison

8. Elements
--Prefer elements in Top Right rather than bottom right
--Prefer larger more obvious element display
--Rather than dim for waning (too easy to confuse it as inert) Leave it bright but half full of color for waning.
--Would like strong/waning to be larger than inert as well

9. End of round

10. Tech
-When installed as a webapp connection period is not functional unless you also establish a connection in the browser.

Overall: Pleased
Changes I'd Like to see:
-Monster information card (HP/MOV/ATK/RNG etc) unnecessary on the controller as it will be available on the display. 
--It takes up a ton of space and I think we would be better served with just Portrait, Name, [ability card when drawn] in top row then the standees
-Each card should be narrower, going the full width of the screen in the controller is unnecessary, I would say in landscape we should get 3 columns of cards, in portrait 2
The health bar: Lets make the healthbar still clickable but underlay it behind the Character name and be the top of the card, whith health x/y R justified on the healthbar and name L justified on the healthbar
-Under healthbar could be a health icon (blooddrop) with +\- on either side of it.
- Next to that could be a negative conditions, either Toggles like in the overlay but directly on the card or a popup overlay that fans out when the main status icon is clicked.
--Leads to next question is there a UI library we could adopt/install that has more elements with some flare that we could use? For things like the conditions overlay where you click the indicator and a radial with all of the conditions pops up where you click and you click one to apply condition then the fanned out overlay dissappears. 
-less primative monster attack deck
-non-FH scenario but I did initiate a FH scenario and there is no loot deck function whatsover. The loot ticker in the GH scenario is fine but it does not work in we need loot deck that can be drawn and assigned to the active character
