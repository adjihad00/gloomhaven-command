# GHS Functionality Audit — Comprehensive

Conducted via directed observation of GHS (Gloomhaven Secretariat) at
`http://192.168.50.96:8080/`, inspection of GHS data files in
`.staging/ghs-client/data/`, and Frosthaven rulebook reference.

---

## 1. Application Overview

GHS is a **single-screen web app** that manages all Gloomhaven/Frosthaven game
state. No page navigation — everything is overlays on a persistent play surface.

### Screen Layout (top → bottom)
- **Header bar:** Hamburger menu (☰), connection status icon, phase hint text
  ("Choose character ability cards, set initiative, click Draw"), Party Sheet
  link (center-right), 6 element icons (Fire, Ice, Air, Earth, Light, Dark)
  on far right
- **Main area:** Character boards (left/top) + monster groups (right/bottom)
  in a responsive grid. Single column → two columns as entities increase.
- **Footer bar:** Phase button (Draw / Next Round + round counter + game clock),
  scenario name + door controls (center), level-derived values
  (gold conversion, trap damage, bonus XP, hazardous terrain), modifier deck
  counter + controls (right), loot deck icon (bottom-left, FH only)
  - **Event effects icons** (level/gold/trap/XP/hazardous) are clickable →
    opens scenario level overlay
  - **Scenario rules** — when a scenario has special rules, an overlay can
    auto-apply them to entities (configurable setting)

### Key Design Principle
Progressive disclosure via overlays. The main screen always shows the full
game state at a glance. Details accessed by clicking specific UI elements.
No tabs, no page changes.

---

## 2. Main Menu (Hamburger ☰)

| Item | Description |
|------|-------------|
| **Undo / Redo** | Shows last action description (e.g., "Open door for tile 'G1b' in #1 Black Barrow"). Full undo stack with configurable max depth. |
| **Set Scenario** | Opens scenario picker overlay with edition filter, search, campaign-locked list |
| **Add Section** | Manually reveal a scenario section (for narrative triggers) |
| **Add Monster** | Manually add a monster group not in the scenario data |
| **Remove Monster** | Remove a monster group |
| **Add Character** | Opens character class picker with level selector |
| **Remove Character** | Remove a character |
| **Add Objective** | Add scenario objectives/escorts |
| **Remove Objective** | Remove objectives |
| **Campaign/Character Management** | Party sheet (front) and campaign sheet (back) |
| **Settings** | Full settings panel (see §10) |
| **Data Management** | Export/import, backups, edition management, spoiler management |
| **Server Connection** | Network sync configuration |
| **About / Help** | Version info, help links |
| **Keyboard icon** | Keyboard shortcut reference |

---

## 3. Scenario Setup — Full Automation Chain

### Setup Flow (exact order)
1. Choose edition (welcome screen: GH, FH, JotL, FC, CS, ToA, B&B, etc.)
2. **Campaign Mode** checkbox — gates scenario selection to unlocked only
3. Add characters — level chosen at add time
4. Set scenario — triggers automatic monster spawn for Room 1

### What Happens Automatically When Scenario Selected
1. Scenario name + number displayed in footer bar
2. **Room 1 monsters auto-spawn** from scenario JSON `rooms[0].monster[]`
3. Spawn count resolved against current character count (player2/3/4 fields)
4. Monster stat cards initialized at calculated scenario level
5. Monster ability decks created, shuffled (one per deck type, shared across
   monster types referencing the same deck name)
6. Door controls appear in footer for room transitions
7. Level-derived values calculated and displayed:

| Scenario Level | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|---|
| Monster Level | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
| Gold per coin | 2 | 2 | 3 | 3 | 4 | 4 | 5 | 6 |
| Trap damage | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
| Hazardous terrain | 1 | 2 | 2 | 2 | 3 | 3 | 3 | 4 |
| Bonus XP | 4 | 6 | 8 | 10 | 12 | 14 | 16 | 18 |

   Formulas: Trap = 2+L, Bonus XP = 4+2L, Gold/Hazardous = lookup table

### Scenario Level Calculation
- **Auto-calculated** = average of all non-absent character levels / 2, rounded up
- **Level adjustment** (−2 to +2) offsets the auto-calculated level
- **Level bonuses adjustment** (−2 to +2) separately offsets trap/gold/XP values
- Manual override: click any level 0–7 directly
- **Solo mode** changes formula (FH: average level, rounded up; GH: +1 to normal)

### Monster Spawn Rules (Player-Count-Dependent)
Scenario JSON `rooms[].monster[]` entries use these fields:
- `type: "normal"|"elite"` — **always spawns** regardless of player count
- `player2: "normal"|"elite"` — spawns only at **2+ players**
- `player3: "normal"|"elite"` — spawns only at **3+ players**
- `player4: "normal"|"elite"` — spawns only at **4 players**

**Room 1** spawn count locked at scenario start based on characters present.
**Subsequent rooms** recalculate based on current non-absent character count
at the moment of door opening.

### Room Reveal
- **Door icons** in footer under scenario name
  - **Closed door**: shows tile reference (e.g., "G1b") + section marker icon
    if section text should be read when opening
  - **Open door**: shows open-door icon after reveal
  - **Separator |** between revealed and unrevealed doors
  - Hovering over closed door reads: "Open door for tile G1b"
- **Shortcut**: click the closed door icon below the scenario name in footer
- Clicking reveals the room:
  - New standees auto-spawn with **glowing halo** animation
  - Existing monster groups gain standees if new room includes that type
  - New monster groups appear with full stat card + ability deck
- **Spawn timing (critical)**: Room spawns use the character count **at the time
  of room reveal**, NOT at scenario start. Adding characters after a room was
  opened does NOT retroactively change its spawns, but WILL affect player count
  for future room openings.
- **Frosthaven doors** have associated section numbers to read when opened
- **Gloomhaven doors** have room references (e.g., G1b, I1b)

---

## 4. Character System

### Adding Characters
- Left panel overlay with **level selector** (1–9) at top
- Class list filtered by active edition (toggleable "All Editions" checkbox)
- **Starting classes** shown by name; **locked classes** shown as "???" with
  icon only (spoiler protection)
- HP auto-set from edition data at selected level
- Initial gold: 30 (new campaign), plus starting items available

### Character Bar — Always Visible (Interaction Zones)

The character bar is a horizontal strip with distinct clickable zones (left→right):

| Zone | Visual | Click Action |
|------|--------|-------------|
| **Far left edge** | Thin drag handle | Click+drag to manually reorder character position |
| **Portrait** | Class art thumbnail with HP bar overlay | Marks turn complete (during play phase) |
| **^ caret** | Small caret above initiative area | Opens initiative input overlay (numpad) |
| **Initiative area** | Large number (play phase) or blank (draw phase) | Inline editable during draw phase |
| **Name + HP area** | Class icon, name, HP current/max | Opens full character menu overlay |
| **+ button** | Plus icon | Opens summon dialog (not general expand) |
| **XP star** | Blue star with XP count | Quick-tap: +1 XP |
| **Loot bag** (GH only) | Gold bag icon with loot count | Quick-tap: +1 loot/gold |
| **Class icon (right)** | Large class icon | Opens full player/character sheet |
| **Far right edge** | Thin drag handle | Click+drag to manually reorder character position |

- **Color-coded border** matches class color (e.g., Brute = blue, Geminate = pink, Boneshaper = green)
- **Active conditions** displayed as small icons inline on the bar
- **Summon indicator** appears when summons are active (shows standee count)

#### FH Character Bar Differences
- **No gold/loot bag icon** by default — FH uses loot deck, not coin-based looting
- **Loot icon appears** only after a character obtains loot cards (shows count of obtained cards)
- **Class-specific token icons** for tracking scenario/ability tokens
- **Form toggle** for multi-form classes (e.g., Geminate shows "Melee" or "Ranged")

### Character Menu Overlay (Click Name/HP Area)

Opens by clicking anywhere between the + icon and the initiative area, including
the name and health numbers.

**Left column** (counters with −/+ buttons):
1. **HP** (red drop) — health counter
2. **XP** (blue star) — experience counter
3. **Gold/Loot** (gold icon) — loot counter
4. **Character token** (scenario/ability token tracker)
5. **ZZZ** — Exhaust character (greyed out, cannot act, but **still counts**
   for future room spawns)
6. **Crown** — Level indicator

**Top-right corner:**
- **Mark Absent** — removes character from turn order AND reduces character
  count for future room spawns (distinct from Exhausted)

**Right column** (condition icons — grid layout):
- Row 1: Stun, Immobilize, Disarm
- Row 2: Wound, Muddle, Poison
- Row 3: Bane, Brittle, Impair *(FH conditions — only shown when FH edition active)*
- Row 4: Infect, Rupture, Poison X *(expansion conditions)*
- Row 5: Wound X, Chill X *(expansion conditions)*
- Beneficial: Strengthen, Invisible, Rejuvenate
- FH beneficial: Ward, Dodge, Safeguard
- **Condition modifiers row**: Permanent | Remove at End of Round | Immune —
  select one of these FIRST, then click a condition to apply that timeline

*Note: Which conditions appear depends on selected edition. With no edition
selected, all conditions from all editions are shown.*

### Character Sheet (Full Overlay)
Accessed via the **class icon on the right side** of the character bar:
- **Class name & race** (e.g., "Inox Brute") + retirement icon
- **Editable name** field
- **Level selector** 1–9 with clickable buttons
- **XP thresholds** per level (0, 45, 95, 150, 210, 275, 345, 420, 500)
- **XP Notes** and **Gold Notes** fields
- **Donations** tracking (Sanctuary of Great Oak for GH / Supply for FH)
- **Items section** with Itemshop link
- **Perks** — full list with multiple checkboxes per perk:
  - Perks modify the character's personal attack modifier deck
  - Types: remove, replace, add, ignore negative item effects
  - Cards modified: -1, +1, +2, +3, rolling modifiers, conditions
- **Battle Goals** — checkmark grid for tracking completed goals
- **Notes** — free text area
- **Player #** assignment
- **Personal Quest** — with "Retire Character" button
- **Retirements** and **Extra Perks** counters
- **Export / Import** buttons for character data
- **"Go to Frosthaven Character Sheet"** cross-edition link

#### FH Character Sheet Differences
- **Mastery section** — 2 masteries per class; completing a mastery rewards a perk mark
- **Perk marks** — earned via: battle goal checkmarks (3 checks = 1 perk),
  mastery completion, leveling up, or starting a new character (based on
  previous retirements)
- **FH Perks** — not just modifier deck changes but actual gameplay abilities
  (class-specific ability perks)
- **Form toggle** — multi-form classes (e.g., Geminate) have a special status
  indicator to switch between forms (Melee ↔ Ranged)
- **X checkbox row** — where checkmarks are applied from battle goals

### Absent vs Exhausted (Critical Distinction)
| State | Still "Present"? | Affects Spawn Count? | Can Act? |
|-------|:---:|:---:|:---:|
| **Active** | Yes | Yes | Yes |
| **Exhausted** | Yes | Yes (still counts) | No |
| **Absent** | No | No (reduces count) | No |

---

## 5. Monster System

### Auto-Spawn from Scenario Data
- Scenario JSON defines `rooms[]`, each with `monster[]` entries
- Each monster entry has `name`, optional `type`, optional `player2`–`player4`
- Standee numbers auto-assigned (configurable: random or sequential)
- Normal/elite type set from spawn data
- Elite standees shown first (configurable setting)

### Monster Panel — Interaction Zones

| Zone | Visual | Click Action |
|------|--------|-------------|
| **Portrait** (circle, left) | Monster artwork | Opens full monster artwork overlay |
| **Ability deck card** | Card back with deck name + count (e.g., "7/8") | Opens monster ability deck overlay |
| **Level number** (top-left of stat card) | Number "1", "2", etc. | Opens monster level override overlay |
| **Monster name** | Text label (e.g., "Algox Guard") | Opens full stat info overlay + ally toggle |
| **Grey +** | Grey plus button on stat card | Adds a new **normal** standee |
| **Yellow +** | Yellow/gold plus button on stat card | Adds a new **elite** standee |
| **Standee tiles** | Individual numbered standee tokens | Opens standee interaction overlay |

- **Stat card** shows dual-column display:
  - Left (white/grey) = normal stats: HP, Move, Attack, Range, passive abilities
  - Right (gold) = elite stats: HP, Move, Attack, Range, passive abilities
  - Passive abilities shown: Shield, Retaliate, flying, etc.
- **Ally indicator** — monsters marked as allies show "Ally" tag and use the Ally
  modifier deck instead of the monster deck

### Monster Ability Cards
- Drawn automatically at round start (Draw → Play phase transition)
- Card shows: **initiative number**, action list (Move, Attack, etc.)
- **Ability deck overlay** (click deck card): full deck management
  - "Reveal All?" → click again → reveals all cards
  - "Edit" → second row of editing options
  - Shuffle controls
- With "Show calculated stats" setting ON: resolved values for normal/elite
  (e.g., "Move 3/2, Attack 2/3") computed from: base stat + card modifier value
- Card modifiers use `valueType: "plus"` (relative to base) or absolute values
- `shuffle: true` on card = shuffle deck after round if this card was drawn
- **Interactive Abilities** (configurable): click ability actions directly to
  apply effects (e.g., summon, elemental infusion)
- **Reveal abilities directly** (configurable): show card immediately vs. hide
  until monster's turn

### Shared Ability Decks
Multiple monster types can reference the same deck. E.g., `bandit-guard` and
`city-guard` both use `"deck": "guard"`. Drawing from one deck affects all
monster groups sharing that deck. GHS handles this correctly.

### Standee Interaction Overlay (Click Standee Token)
- **Header:** Monster portrait → Monster Name #N (e.g., "Bandit Guard #4")
- **Left column** (counters with −/+ buttons):
  1. **HP** — current health / max health
  2. **Bless** — adds/removes Bless cards to attack modifier deck
  3. **Curse** — adds/removes Curse cards to attack modifier deck
- **Skull** — quick kill (instantly removes standee)
- **±** next to HP counter — adjusts **max HP** (not current HP)
- **Condition grid** (right side):
  - Row 1: Stun, Immobilize, Disarm
  - Row 2: Wound, Muddle, Poison
  - Row 3: Bane, Brittle, Infect *(edition-dependent)*
  - Row 4: Rupture, Poison X, Wound X *(expansion)*
  - Row 5: Chill *(expansion)*
  - Beneficial: Strengthen, Invisible, Regenerate
  - FH beneficial: Ward, Safeguard
- Death animation: standee drops and fades, removed from display

### Summon System
- **Summon dialog** (click + on character bar): opens overlay with:
  - Summon token selection
  - **Standee number selection** — summons use standee numbers like monsters,
    so multiple summons of the same name have different numbers for tracking
  - List of possible summons — class-native summons plus summons from items/abilities
- **Summon display**: appears as small tokens next to the character; tracked with
  own HP and conditions
- **Passive vs Active summons** (configurable): passive summons can skip their
  active turn; active summons activate in order at character's turn start
- **Summons do NOT act** the round they are summoned

---

## 6. Round Flow — Complete Lifecycle

### Phase: Draw
- Header hint: "Choose character ability cards, set initiative, click Draw"
- Characters shown in default order (add order), no initiative displayed
- **Initiative input** — Two methods:
  1. Inline textbox on character card (type number)
  2. **Overlay numpad** (phone-style 0–9 grid) via caret icon above initiative
- **Long Rest** option on initiative overlay (clock icon)
- Bottom-left: "Draw" button with game clock

### Phase: Playing (after Draw clicked)
1. **Monster ability cards drawn** automatically for all active monster groups
2. **Characters + monsters sorted by initiative** (ascending) — visual vertical
   card order IS the turn order
3. **Lowest initiative auto-activated** (portrait gets blue glow border)
4. Header hint: "Take turns, click each figure image"
5. Bottom-left: "Next Round" with round counter

### Turn Advancement
- **Click portrait = end turn** for active figure
- Completed figures: portrait **dimmed/greyed out**
- Next in initiative order **auto-activates** (blue glow)
- Visual states: **glow** = active, **dimmed** = done, **normal** = waiting
- **Active standees** (configurable): on monster's turn, each standee has
  active state; double-click standee to mark as done

### End of Round (Next Round clicked)
- Clickable at any time; **warns if turns incomplete** (configurable)
- Steps in order:
  1. Trigger end-of-round effects (scenario rules, items, ability cards)
  2. **Shuffle:** If any drawn AMD card or monster ability card has shuffle icon,
     shuffle that deck's discard back into the deck
  3. **Round bonuses expire:** Active area cards with round bonuses → discard/lost
  4. **Short rests:** Characters with ≥2 discard cards may short rest
     (lose 1 random card, return rest to hand; may suffer 1 damage to re-pick)
  5. **Element decay:** Strong → Waning, Waning → Inert
- Round counter increments, initiative cleared, phase returns to Draw

### Monster Focus & AI Rules (Critical for Engine)
Monsters find focus = enemy they can attack using **fewest movement points**:
1. Calculate shortest path to a valid attack hex for each enemy
2. **Tie-break:** closest by range → earliest in initiative order
3. Prioritize paths with **fewest negative hexes** (traps, hazardous terrain)
   even if longer path — monster avoids traps unless no other viable path
4. Focus doesn't require line-of-sight; only requires a path EXISTS (infinite movement)
5. **No focus** = no move, no attack, but still performs other listed abilities

**Movement rules:**
- Uses fewest movement points to maximize attacks this turn
- If can't attack focus this turn, only moves if it shortens the path
- Ranged attack on adjacent target: moves away first to avoid disadvantage
- Multiple targets: moves to attack most targets with fewest disadvantaged attacks

**Acting order within a set:** Elites first (ascending standee #), then normals (ascending #)

**Element timing for monsters:** First monster of set consumes at start of turn
(benefits ALL monsters of set); last monster of set infuses at end of turn

### Attack Modification Order (4 Steps)
1. Apply all attack bonuses/penalties (+X Attack effects)
2. Draw attack modifier card from attacker's deck, apply it
3. Apply target's **shield** bonus (reduced by Pierce)
4. Apply **ward** and **brittle** (if both present, they cancel and both removed)
→ Target suffers resulting damage (may negate: lose 1 hand card OR 2 discard cards)

### Revealing vs Spawning Monsters
- **Revealed** (new room): act during the round they appear; if initiative already
  passed, insert after current figure
- **Spawned** (scenario rule): same as revealed — act same round
- **Summoned** (summon ability): do NOT act during summoning round

---

## 7. Terrain & Overlay Types

| Type | Effect | Flying/Jump Immune? | Removed? |
|------|--------|:---:|:---:|
| **Featureless** | Normal empty hex | — | — |
| **Corridor** | Connects rooms; acts as empty hex | — | — |
| **Door** | Closed = wall; character entry flips open → corridor | — | No |
| **Trap** | Sprung on entry: apply effect, then remove | Yes (unless jump ends there) | Yes |
| **Hazardous Terrain** | Damage on entry (level-dependent, see table above) | Yes (unless jump ends there) | No |
| **Difficult Terrain** | Costs 2 movement to enter | Yes | No |
| **Icy Terrain** (FH) | Forced 1-hex slide in movement direction on entry | Yes (also teleport immune) | No |
| **Obstacle** | Cannot enter | Yes (unless jump ends there) | No |
| **Objective** | Has HP; can be attacked; init 99; immune to conditions/forced movement | — | When destroyed |
| **Pressure Plate** | Triggers scenario-specific effect | No (even flying/jump trigger) | No |
| **Treasure** | Looted by character; goal or numbered | — | When looted |
| **Wall (overlay)** | Cannot cross by any means including flying/jump | No | No |

---

## 8. Conditions — Complete Reference

### Gloomhaven Conditions (10)
| Condition | Effect | Expires |
|-----------|--------|---------|
| **Stun** | Cannot perform any abilities on turn | End of next turn |
| **Immobilize** | Cannot perform move abilities | End of next turn |
| **Disarm** | Cannot perform attack abilities | End of next turn |
| **Wound** | Suffer 1 damage at start of each turn | When healed |
| **Muddle** | Disadvantage on all attacks | End of next turn |
| **Poison** | +1 to all damage suffered; heal removes poison instead of healing | When healed |
| **Invisible** | Cannot be targeted by enemies | End of next turn |
| **Strengthen** | Advantage on all attacks | End of next turn |
| **Curse** | Add curse card to attack modifier deck | Until drawn |
| **Bless** | Add bless card to attack modifier deck | Until drawn |

### Frosthaven Additional Conditions (6)
| Condition | Effect | Expires |
|-----------|--------|---------|
| **Brittle** | Double the next source of damage suffered | After next damage |
| **Bane** | Suffer 10 damage at end of next turn | End of next turn |
| **Impair** | All positive item effects ignored | End of next turn |
| **Ward** | Halve next source of damage suffered (round down, min 1) | After next damage |
| **Regenerate** | Heal 1 at start of each turn | When suffering damage |
| **Infect** | When healed, suffer damage equal to heal amount instead | Until long rest or scenario end |

### GHS Condition Automation (Settings)
- **Automatic expire conditions:** Auto-remove conditions after figure's turn
  (e.g., Strengthen removed at end of affected figure's next turn)
- **Automatic apply conditions:** Auto-apply before/after turn
  (e.g., Wound damage at start of turn, Regenerate heal at start of turn)
- **Confirm applicable conditions:** Prompt for confirmation on certain
  auto-applications (e.g., Poison confirmation when decreasing HP)
- **Automatic confirm:** Skip confirmation and auto-apply (use with care)
- Per-condition toggles for Wound, Poison, Heal, Shield interactions

---

## 8. Elements

### Element Board
- 6 elements always visible in header: Fire, Ice, Air, Earth, Light, Dark
- **4 states:** Inert (grey) → Infused (full color, just created) → Strong
  (full color, persists) → Waning (half-filled from bottom)
- **Manual click cycle:** Infused → Strong → Waning → Inert (4 clicks to
  cycle through all states)
- **Automatic lifecycle during play:**
  1. Character/monster infuses element → **Infused**
  2. Infusing figure's turn ends → **Strong** (available for consumption)
  3. Click Next Round → **Waning** (half-filled visual)
  4. Click Draw → still **Waning**
  5. Click Next Round again → **Inert**
- **Automatic update element state** (setting): auto-decay before each round
  - Strong → Waning at end of round
  - Waning → Inert at end of round

### Element Interaction with Abilities
- Monster ability cards can infuse elements (shown on card)
- Character abilities can infuse/consume elements
- With **Interactive Abilities** setting: clicking element action on ability
  card auto-infuses/consumes the element on the board

---

## 9. Attack Modifier Decks

### Standard Deck Composition (20 cards)
| Card | Count | Effect |
|------|-------|--------|
| +0 | 6 | No modification |
| +1 | 5 | Add 1 to attack |
| -1 | 5 | Subtract 1 from attack |
| +2 | 1 | Add 2 to attack |
| -2 | 1 | Subtract 2 from attack |
| ×2 | 1 | Double attack value |
| ×0 (Null) | 1 | Miss — zero damage |

### Deck Types
- **Monster AMD** — one shared deck for all monsters (bottom-right, "m" icon)
- **Ally AMD** — separate deck for scenario allies (bottom-right, "A" icon);
  appears above monster deck when allies are present
- **Character AMDs** — one per character (if Character Attack Modifier Deck setting ON)

### GHS Modifier Deck Controls (Bottom-Right Corner)
Each deck shows: deck icon ("m"/"A") | crossed swords (draw) | gear icon | expand icon | counter (20/20)

- **Gear icon** — opens attack modifier deck management overlay
- **"M"/"A" icon** — slides deck to the right to hide it (toggle visibility)
- **Circle/expand icon** (above M) — shows attack modifier decks fullscreen
- **Crossed swords / 20/20** — during active phase, clicking draws a card
- **During draw phase:** Click on deck area opens management overlay directly
- Management overlay shows:
  - Full card stack visualization (face-down draw pile, discard pile)
  - "Reveal All?" / "Shuffle" / "Edit" controls
  - Bless/Curse/-1 counters with −/+ buttons
- **Advantage/Disadvantage** buttons on deck (configurable setting)
  - GH rules: draw 2, use better/worse (rolling modifiers combine)
  - FH rules: draw until 2 non-rolling, use better/worse
- **Character AMD features:**
  - Perks modify deck (add/remove/replace cards)
  - Can display above monster deck or permanently under character
  - Auto-toggle for active character
  - Draw animation (configurable)

---

## 10. Complete GHS Settings Reference

### Gameplay
| Setting | Default | Description |
|---------|---------|-------------|
| Scenario Rooms | ON | Room unlocking in scenarios; disabling also disables auto-standees |
| Room treasures indicator | ON | Show available treasures when room revealed |
| Scenario Rules | ON | Popup for special scenario rules with optional auto-apply |
| Battle Goals | ON | Draw/select battle goals before first round |
| Event Cards | OFF | Event card deck support |
| Party Sheet | ON | Party and campaign sheet (campaign on backside) |
| Character Sheet | ON | Full character sheet with perks, items, personal quest |
| Character Attack Modifier Deck | OFF | Per-character modifier deck (requires Character Sheet) |
| Character Items | OFF | Item state management during scenarios |

### Character
| Setting | Default | Description |
|---------|---------|-------------|
| Initiative is required | ON | If off, manual drag-and-drop ordering |
| Hide absent figures | ON | Don't show absent characters |
| Apply treasure rewards | ON | Auto-apply treasure: gold, XP, items |
| Draw Random Item rewards | OFF | Auto-draw random item card |
| Draw Random Scenario rewards | OFF | Auto-draw random scenario |
| Apply Long Rest | ON | Auto-apply Heal 2 on long rest turn |
| Apply Retirement Bonuses | ON | Dialog for retirement bonuses |
| Apply item actions | OFF | Auto-apply self-affecting item actions (heal, conditions, summons) |
| Shield and Retaliate | OFF | Track Shield/Retaliate for characters |
| Sort by Player # | OFF | Sort by player number between rounds |
| Active summons | ON | Summons activate in order at character's turn start |
| Passive Summons | ON | Allow passive summons to skip active turn |
| Character Forms | ON | Toggle between character forms (click form icon) |
| Form Hint | ON | Show active form name after character name |
| Apply Scenario Rewards | ON | Auto-apply scenario completion rewards |
| Battle Goals Reminder | OFF | Reminder before first round if battle goals not chosen |
| Always show Battle Goals | OFF | Always show battle goal menu on character |
| Display hand size and level | OFF | Show hand size and level on character board |
| Display traits | OFF | Show traits on character board |
| Scenario Statistics | ON | Track damage, kills, loot, XP, heals during scenario |

### Monsters
| Setting | Default | Description |
|---------|---------|-------------|
| Ability Cards | ON | Draw ability cards; if off, manual drag ordering |
| Show calculated stats | ON | **Resolve ability values against base stats** (Move +1 → Move 3) |
| Add stats values to abilities | ON | Add default stats to ability values (e.g., auto-add Range) |
| Add Shield and Retaliate to abilities | ON | Show aggregated Shield/Retaliate on ability card |
| Add Advantage to abilities | ON | Show Advantage on attack actions |
| Reveal abilities directly | ON | Show card immediately vs. hide until monster's turn |
| Remove unused | ON | Auto-remove monsters with no standees |
| Add for all rooms/sections | OFF | Auto-add ALL scenario monsters (spoiler warning) |
| Interactive Abilities | ON | Click ability actions to apply (summons, elements) |
| Combine Interactive Abilities | ON | Apply interactive abilities for all standees at once |
| Show ability numbers | ON | Show card ID on ability cards |
| Show expanded ability cards | OFF | Show all abilities expanded |
| Show ability card title | OFF | Show card title (requires expanded) |
| Stat Cards | ON | Show monster stat cards |
| Show expanded stat cards | OFF | Expand stat cards to show all content |
| Hide stats | ON | Hide stats for un-spawned monsters |

### Standees
| Setting | Default | Description |
|---------|---------|-------------|
| Elite standees first | ON | Show elite standees before normal |
| Active standees | OFF | Per-standee active tracking on monster's turn |
| Automatic Standees | ON | Auto-add standees from scenario data |
| Shield and Retaliate on Standee | OFF | Show Shield/Retaliate values per standee |
| Automatic Standees Dialogs | OFF | Auto-open number picker for new standees |
| Random standees | ON | Assign random unused number to new standees |
| Standees | ON | Display standees at all (master toggle) |
| Shield and Retaliate | OFF | Track extra Shield/Retaliate for standees/summons |

### Conditions/Elements
| Setting | Default | Description |
|---------|---------|-------------|
| Automatic expire conditions | ON | Auto-remove conditions after figure's turn |
| Automatic apply conditions | ON | Auto-apply conditions before/after turn (Wound damage, etc.) |
| Automatic update element state | ON | Auto-decay elements before each round |
| Confirm applicable conditions | ON | Ask confirmation for certain auto-applications |
| Per-condition toggles | — | Individual toggles for Wound, Poison, Heal, Shield interactions |
| Automatic confirm | OFF | Skip confirmation dialogs (apply everything automatically) |

### Frosthaven Rules
| Setting | Default | Description |
|---------|---------|-------------|
| Apply Loot to Character | ON | Auto-add loot to active character |
| Draw Random Item on Loot | OFF | Auto-draw random item on random-item loot |
| Always show Loot Apply Dialog | OFF | Always show character picker for loot |
| Automatic pass calendar time | OFF | Auto-advance calendar week after scenario |
| Apply Building Bonuses | OFF | Auto-apply building upgrade bonuses |
| Unlock buildings from envelopes | OFF | Auto-unlock buildings from personal quests |
| Add Gloomhaven Items | OFF | Add GH/FC items to FH supply per rules |
| Always use Loot Deck | OFF | Show loot deck for all editions (auto for FH) |
| Always draw 3 Battle Goals | OFF | FH rule: draw 3 instead of 2 (auto for FH) |
| Always Attack Modifier Deck for allies | OFF | Always show ally AMD |
| Always Hazardous Terrain | OFF | FH hazardous terrain calc (auto for FH) |
| Always Frosthaven Solo Rules | OFF | FH solo level calc (auto for FH) |
| Always Frosthaven Advantage/Disadvantage Rules | OFF | FH advantage rules (auto for FH) |
| Share Resources House Rule | OFF | Share all resources except gold |

### Gloomhaven 2nd Edition
| Setting | Default | Description |
|---------|---------|-------------|
| Always Monster Imbuements | OFF | Enable Appendix F monster imbuement options for all editions |

### Additional Gameplay
| Setting | Default | Description |
|---------|---------|-------------|
| Round/Turn confirmation | ON | Warn before Next Round if turns incomplete |
| Apply automatic Scenario Rules | OFF | Auto-apply scenario rules without confirmation |
| Automatic Character Unlock | ON | Auto-unlock characters from scenario rewards |
| Character Summons | ON | Enable character summons |
| Apply Events automatically | OFF | Auto-apply event card outcomes |
| Auto. Draw Events | OFF | Auto-draw road events at scenario start |
| Loot Deck | ON | Enable loot deck |
| Attack Modifier Deck for allies | ON | Enable ally AMD |
| Monsters | ON | Master toggle for showing monsters |
| Attack Modifier Deck for monsters | ON | Enable monster AMD |
| AMD with Advantage/Disadvantage | OFF | Add Adv/Disadv buttons to AMDs |
| Damage instead of HP | OFF | Show damage dealt instead of HP remaining |
| Share Character Items Houserule | OFF | Allow item sharing between characters |

### Interface
| Setting | Default | Description |
|---------|---------|-------------|
| Frosthaven Style | OFF | FH-style action/ability/icon rendering + theme |
| Compact Character Sheets | OFF | More compact character sheet layout (WIP) |
| Draw Events Reminder | OFF | Reminder to draw events before first round |
| Toggle Damage/HP on character board | OFF | Double-click HP to toggle |
| Character AM-Deck above Monster Deck | OFF | Show active character's AMD above monster AMD |
| Permanent Character AM Deck | OFF | Always show AMD under character |
| Auto. active AM Deck | OFF | Auto-toggle AMD for active character |
| Permanent Character Items | OFF | Always show items under character |
| Auto. active Items | OFF | Auto-toggle items for active character |
| Animate Character AM Deck draw | OFF | Draw animation for closed AMD |
| Auto fullscreen AM Deck | OFF | Fullscreen AMD on small devices |
| Long press for double click | OFF | Touch: long press = double click |
| Drag'n'drop for figures | ON | Drag to reorder figure list |
| Drag Values | ON | Drag to change values (initiative, HP) |
| Drag Hit Points / Initiative / Loot / XP | ON | Sub-toggles for drag |
| Game Clock | ON | Track session time |
| Merge Game Clocks | OFF | Merge server + local clocks |
| Automatic game clock | OFF | Start/stop on window open/close |
| Gesture zooming | ON | Pinch-to-zoom on touch |
| Fullscreen | OFF | Browser fullscreen mode |
| Autoscroll | ON | Auto-scroll to active figure |
| Portrait-Mode Optimization | ON | Optimize for portrait screens |
| Animations | ON | Enable all animations |
| Stat Animation | OFF | Animate Shield/Retaliate stats |
| Animation Speed | 1.0 | Slider control |
| Barsize | 0.8 | Header/footer size slider |
| Ability fontsize | 1.0 | Ability/stat card font size |
| Show hints | ON | Shortcuts/hints next to menu |
| Tooltips | ON | Display tooltips |
| Show Backup Hint | OFF | Backup reminder when no scenario running |
| Initiative set dialog | OFF | Dialog to start round when all initiatives set |
| Show errata hints | OFF | Display known erratas |
| Column layout | OFF | Multi-column figure layout |
| Use all available columns | OFF | Distribute across all columns |
| Artwork | ON | Show monster/character artwork |
| Max number of undos | — | Configurable undo stack depth |
| Undo/Redo with navigation | OFF | WIP |

### Other Settings
- **Language:** English, German, French, Korean, Spanish, Italian, Chinese (Simplified/Traditional), Russian, Portuguese, Polish, Thai
- **Theme:** Default, Frosthaven, Modern, Button & Bugs (WIP)
- **Automatic Theme:** Adjust theme on edition change
- **Character display:** Full view, compact boards, player number, hide HP/Loot/XP
- **Presets:** "Apply default Helper settings", "Apply Lurkars' personal settings", "Apply X-haven Assistant settings"
- **Debug Settings/Tools**

---

## 11. Data Management

### Export/Import
- **Export Game to File** — full game state JSON
- **Export Settings to File** — settings-only JSON
- **Export Data Dump** — complete data export
- **Import File** — restore from any export
- **Reset Game / Reset Settings / Reset all Data** — destructive resets

### Automatic Backups
- Configurable: every (x) actions, after finishing scenario
- Optional upload URL for remote backup

### Edition Management
Enabled editions (checkboxes):
- **Core:** Gloomhaven, Frosthaven, Jaws of the Lion, Forgotten Circles
- **Community:** The Crimson Scales, Trail of Ashes, Button & Bugs
- **Extras:** Solo Scenarios, Frosthaven Crossover Characters, GH Envelope X
- **Fan-made:** Mercenary Packs, Custom Content Unity Guild, Satire's Extended Battle Goals, Updated digital Solo Items, Seeker of Xorn, Blood and Sand, Skulls in the Snow, ConQuest, Ice Rift, Reddit 100k Subscriber Contest
- **Special:** Gloomhaven 2nd Edition
- **Custom:** Add Edition Data URL

### Spoiler Management
- "Add Spoiler" field for manually unlocking content
- "Manage Unlocks" for toggling unlocked content

---

## 12. Loot System

### Gloomhaven
- **No loot deck** — loot is tile-based on the map
- Characters loot by moving onto a loot tile
- Loot value = gold × gold conversion rate

### Frosthaven
- **Loot deck** present — cards drawn and assigned to characters
- Loot deck composition configured per scenario in loot table
- Types: gold, resources (lumber, metal, hide, arrowvine, axenut,
  corpsecap, flamefruit, rockroot, snowthistle), random item, special
- **Loot deck UI** (bottom-left): click loot deck icon to draw a card
  - Drawn card displayed with artwork + resource label (e.g., "+2 Lumber")
  - Deck counter shows remaining cards (e.g., "19/20")
  - With "Apply Loot to Character" ON: loot auto-assigned to active character
  - **Loot icon appears on character bar** after obtaining loot, showing count
    of obtained cards (e.g., "1" next to loot bag icon)
  - Clicking loot icon on character bar shows all loot cards obtained this scenario
- **Resource types** (9): Lumber, Metal, Hide (materials) + Arrowvine, Axenut,
  Corpsecap, Flamefruit, Rockroot, Snowthistle (herbs)
- Settings: Apply Loot to Character, Draw Random Item on Loot,
  Always show Loot Apply Dialog

---

## 13. Campaign Management

### Party Sheet (front)
- **Party name** — editable
- **Location** tracking
- **Notes** — free text
- **Reputation** with auto-calculated shop price modifier
- **Party achievements** tracking

### Campaign Sheet (back)
- **Prosperity** tracker — checkbox grid (GH: Prosperity 1–9, each level
  with checkboxes; FH: similar system)
- **Sanctuary/Temple donations** — cumulative gold counter
- **Global achievements** tracking
- **Unlocked items** — items available for purchase
- **Completed scenarios** — checked off list
- **Scenario flowchart** — shows unlock chain
- **Event decks** — city/road event management

### Scenario End Rules
- **Lost** if all characters exhausted OR loss condition met
- **Completed** if scenario goal achieved
- Play continues until **end of current round**, then scenario ends
- If both lost AND completed in same round → **scenario is lost**
- Regardless of outcome: recover all cards/items, remove conditions, remove
  bless/curse/-1 from AMDs, gain XP from dial, gain gold from loot cards
- **Lost → Option A:** Return to Frosthaven (keep all gains, outpost phase)
- **Lost → Option B:** Replay immediately (keep XP/gold/treasure, skip outpost, no road event)
- **Completed:** Gain resources, battle goal checkmarks, masteries, conclusion,
  scenario rewards, inspiration (4 − numCharacters), mark map

### Frosthaven Outpost Phase (5 Steps, in order)
1. **Passage of Time** — mark next calendar box; if section number written, read it;
   10 boxes per season → season change (affects event decks)
2. **Outpost Event** — draw from summer/winter outpost event deck; resolve like road events;
   **Attack Events** may target buildings requiring defense checks using Town Guard Deck
3. **Building Operations** — resolve effects of ALL buildings in sequence (normal or wrecked)
4. **Downtime** — characters perform activities in any order:
   - **Level Up** (mandatory if XP ≥ threshold: 45/95/150/210/275/345/420/500)
   - **Retire** (mandatory if personal quest fulfilled)
   - **Create Character** (starting gold = 10 × prosperity + 20)
   - **Craft Items** (at Craftsman building, spend resources)
   - **Brew Potions** (at Alchemist, spend 2 herbs → reveal alchemy chart)
   - **Sell Items** (purchasable: half gold cost; craftable: 2g per resource)
5. **Construction** — build/upgrade/rebuild buildings (1 per phase; spend 2 morale for extra)

### FH-Specific Campaign Systems
- **Prosperity** — checkbox track; determines max starting level for new characters
  (half prosperity, rounded up) and max building upgrade level
- **Morale** (0–20) — affects defense modifier; spend for repairs/extra builds
- **Defense** — total defense value referenced during attack events
- **Soldiers** — spent during attack events to improve defense checks
- **Inspiration** — gained on scenario completion (4 − C); spent as material resources
  for buildings or 15 to complete extra personal quest on retirement
- **Resources** — 3 materials (lumber, metal, hide) + 6 herbs (arrowvine, axenut,
  corpsecap, flamefruit, rockroot, snowthistle); personal supply vs Frosthaven supply
- **Seasons** — summer/winter cycle on calendar; affects event decks
- **Town Guard Deck** — 20-card deck for defense checks (like AMD for town defense)
- **Calendar** — visual calendar with seasons, passage of time tracking
- **Buildings** — build/upgrade/repair/wreck; each building has operations that
  resolve during outpost phase
- **Town Guard Perks** — separate perk system for town defense deck

---

## 14. Data File Reference

### Edition Directory Structure (`.staging/ghs-client/data/`)
```
data/
  {edition}/                  # e.g., gh, fh, jotl, fc, cs, toa
    base.json                 # Edition metadata
    character/
      {class-name}.json       # Character definition
      deck/{class-name}.json  # Character ability cards (full)
    monster/
      {monster-name}.json     # Monster definition
      deck/{deck-name}.json   # Monster ability deck (shared)
    scenarios/
      {number}.json           # Scenario definition
    sections/                 # Room section data
    campaign.json             # Campaign structure
    events.json               # City/road events
    items.json                # Item catalog
    treasures.json            # Treasure definitions
    label/en.json             # Localization strings
```

### Edition Metadata (`base.json`)
```json
{
  "conditions": ["stun","immobilize","disarm","wound","muddle",
                 "poison","invisible","strengthen","curse","bless"],
  "edition": "gh",
  "worldMap": { ... },
  "logoUrl": "..."
}
```
FH adds: `"brittle","bane","impair","ward","regenerate","infect"`

### Character Data (`character/{name}.json`)
```json
{
  "name": "brute",
  "edition": "gh",
  "handSize": 10,
  "color": "#35acd5",
  "stats": [
    { "level": 1, "health": 10 },
    { "level": 2, "health": 12 },
    { "level": 3, "health": 14 }, ...
  ],
  "perks": [
    {
      "type": "remove",
      "count": 1,
      "cards": [{ "count": 2, "attackModifier": { "type": "minus1" } }]
    },
    {
      "type": "replace",
      "count": 1,
      "cards": [
        { "count": 1, "attackModifier": { "type": "minus1" } },
        { "count": 1, "attackModifier": { "type": "plus1" } }
      ]
    },
    {
      "type": "add",
      "count": 2,
      "cards": [{ "count": 1, "attackModifier": { "type": "plus1" } }]
    }
  ]
}
```
**HP lookup:** `stats.find(s => s.level === level).health`

### Character Ability Cards (`character/deck/{name}.json`)
```json
{
  "name": "brute",
  "edition": "gh",
  "abilities": [
    {
      "cardId": 1,
      "level": 1,
      "name": "Trample",
      "initiative": 72,
      "actions": [
        {
          "type": "move",
          "value": 4,
          "subActions": [
            { "type": "specialTarget", "value": "moveTarget" },
            { "type": "attack", "value": 3 }
          ]
        }
      ],
      "bottomActions": [ ... ],
      "lost": false,
      "slots": [ ... ]  // Enhancement slots
    }
  ]
}
```
Key fields: `level`, `initiative`, `actions[]` (top half), `bottomActions[]` (bottom half),
`lost` (card lost after use), `slots[]` (enhancement locations)

### Monster Data (`monster/{name}.json`)
```json
{
  "name": "bandit-guard",
  "edition": "gh",
  "deck": "guard",
  "count": 6,
  "flying": false,
  "stats": [
    { "level": 0, "health": 5, "movement": 2, "attack": 2 },
    { "type": "elite", "level": 0, "health": 9, "movement": 2,
      "attack": 3, "actions": [{ "type": "shield", "value": 1 }] },
    { "level": 1, "health": 6, "movement": 3, "attack": 2 },
    { "type": "elite", "level": 1, "health": 10, "movement": 2,
      "attack": 3, "actions": [{ "type": "shield", "value": 1 }] },
    ...
  ]
}
```
**Stat lookup:** Filter by `level` AND `type` (undefined = normal, "elite" = elite).
**Deck reference:** `deck` field points to shared ability deck name.
**Count:** Maximum standees of this type.

### Monster Ability Deck (`monster/deck/{name}.json`)
```json
{
  "name": "guard",
  "edition": "gh",
  "abilities": [
    {
      "cardId": 524,
      "initiative": 15,
      "shuffle": true,
      "actions": [
        { "type": "shield", "value": 1 },
        { "type": "retaliate", "value": 2 }
      ]
    },
    {
      "cardId": 527,
      "initiative": 50,
      "actions": [
        { "type": "move", "value": 0, "valueType": "plus" },
        { "type": "attack", "value": 0, "valueType": "plus" }
      ]
    }
  ]
}
```
**Resolved values:** When `valueType: "plus"`, resolved = `baseStat + action.value`.
When `valueType` is absent, value is absolute.
`shuffle: true` = shuffle entire deck after this round if this card was drawn.

### Scenario Data (`scenarios/{number}.json`)
```json
{
  "index": "1",
  "name": "Black Barrow",
  "edition": "gh",
  "initial": true,
  "unlocks": ["2"],
  "links": ["2"],
  "rewards": { "partyAchievements": ["first-steps"] },
  "monsters": ["bandit-archer", "bandit-guard", "living-bones"],
  "rooms": [
    {
      "roomNumber": 1,
      "ref": "L1a",
      "initial": true,
      "rooms": [2],
      "monster": [
        { "name": "bandit-guard", "type": "normal" },
        { "name": "bandit-guard", "type": "normal" },
        { "name": "bandit-guard", "player2": "elite" },
        { "name": "bandit-guard", "player3": "normal", "player4": "normal" }
      ]
    },
    {
      "roomNumber": 2,
      "ref": "G1b",
      "rooms": [3],
      "monster": [ ... ]
    },
    {
      "roomNumber": 3,
      "ref": "I1b",
      "marker": "1",
      "treasures": [7],
      "monster": [ ... ]
    }
  ]
}
```
**Spawn resolution:** For each `monster[]` entry:
- If `type` exists → always spawn at that type
- If `player2` exists → spawn at 2+ players at specified type
- If `player3` exists → spawn at 3+ players at specified type
- If `player4` exists → spawn at exactly 4 players at specified type

---

## 15. GH vs FH Rule Differences

| Feature | Gloomhaven | Frosthaven |
|---------|-----------|------------|
| **Loot** | Tile-based on map | Loot deck (draw + assign) |
| **Conditions** | 10 conditions | 16 conditions (+brittle, bane, impair, ward, regenerate, infect) |
| **Battle Goals** | Draw 2, keep 1 | Draw 3, keep 1 |
| **Advantage** | Draw 2, must use better (rolling combine) | Draw 2, character may **choose either**; monsters use better |
| **Disadvantage** | Draw 2, use worse | Draw until 2 non-rolling, use worse |
| **Between scenarios** | City/road events → shop → scenario | Full outpost phase (calendar, events, building, crafting) |
| **Doors** | Room references (L1a, G1b) | Section-based (each door has section number to read) |
| **Resources** | Gold only | Gold + lumber, metal, hide, arrowvine, axenut, corpsecap, flamefruit, rockroot, snowthistle |
| **Solo level** | Party level + 1 | Average level (rounded up) |
| **Hazardous terrain** | 2 + level | ceil((level + 1) / 2) |
| **Items** | Buy from shop | Buy + craft from resources |
| **Starting gold (new char)** | Fixed per class | 10 × prosperity + 20 |
| **Prosperity leveling** | Start at 1 | Start up to half prosperity (rounded up) |
| **Retirement** | Unlock character + city event | Unlock character + building envelope + 2 prosperity |
| **Battle goal reward** | XP | Checkmarks (3 checkmarks = 1 perk mark) |
| **Masteries** | None | 2 per class, grant perk marks |
| **Enhancements** | Available from start | Locked until building 44 built |
| **Seasons** | None | Summer/winter cycle on calendar |
| **Attack events** | None | Outpost events can attack buildings |

---

## 16. Gap Analysis: Current Controller vs GHS

| # | Gap | GHS Behavior | Our Controller | Fix Required | Priority |
|---|-----|-------------|----------------|-------------|----------|
| 1 | **Edition data integration** | All character stats, monster stats, scenarios, ability cards loaded from per-file JSON data structure | `addCharacter` uses **hardcoded maxHealth=10**; `addEntity` creates monsters with **health=0, maxHealth=0**; no data file lookup anywhere in engine | Build data layer that reads GHS edition JSON for all lookups: character HP by level, monster stats by level/type, scenario rooms, ability decks. The shared types already support FH data structures. | **Critical** |
| 2 | **Scenario auto-spawn** | Selecting scenario auto-spawns Room 1 monsters based on player count from scenario JSON; resolves player2/3/4 fields; FH scenarios also have `lootDeckConfig` for auto-building loot deck | `setScenario` resets round/state/monsters but does NOT auto-populate from scenario data files; no loot deck config | Engine must read scenario JSON, resolve player-count-dependent spawns, create monster groups + standees automatically, build loot deck from scenario config | **Critical** |
| 3 | **Room reveal with auto-spawn** | Door icon reveals room, auto-spawns new monsters, adds to existing groups, highlights new standees with halo | `revealRoom` command exists but no spawn automation | Engine must resolve room monster data on reveal, add standees to existing or new groups, support halo animation | **Critical** |
| 4 | **Monster ability card resolution** | Draws ability card at round start; resolves action values against base stats showing normal/elite (e.g., Move 3/2, Attack 2/3) | `drawMonsterAbility` exists but no stat resolution display | Compute baseStat + cardModifier per normal/elite; display resolved values; handle valueType "plus" vs absolute | **Critical** |
| 5 | **Turn order — single sorted list** | Characters + monsters interleaved in one initiative-sorted vertical list; visual order IS turn order | Active Play has initiative timeline but characters and monsters in separate sections | Merge into single initiative-sorted vertical list; characters and monsters interleaved | **Critical** |
| 6 | **Shared ability decks** | Multiple monster types share one deck (e.g., bandit-guard and city-guard both use "guard" deck); drawing affects all groups | Each monster group has independent ability state | Ensure shared deck references work — draw from one deck affects all groups using it | **Critical** |
| 7 | **Scenario level auto-calculation** | Auto-calculates from avg character level / 2, rounded up; separate adjustment offsets; derives trap, gold, XP, hazardous terrain | Level selector is manual buttons 0–7 only | Implement auto-calculation with adjustment offset; auto-derive all level-dependent values | **High** |
| 8 | **Active turn tracking + auto-advance** | Click portrait = end turn; auto-advance to next in initiative; glow/dim visual states; warns if turns incomplete | `toggleTurn` exists but no auto-advance or visual active/done states | Add auto-activation of next figure, dim completed, glow active; configurable round/turn confirmation warning | **High** |
| 9 | **Player count awareness (absent vs exhausted)** | Monster spawns, level calc, room reveals all respect non-absent character count; absent ≠ exhausted | No absent/exhausted distinction affecting spawn counts | Track absent vs exhausted separately; absent changes player count for spawns, exhausted does not | **High** |
| 10 | **Monster stat card — dual column display** | Split normal/elite stat display with HP, Move, Attack, Range, passive abilities per level | Monster Management shows stats but not in GHS-style split card format | Redesign monster stat display to match GHS dual-column normal/elite format | **High** |
| 11 | **Element decay automation** | Elements auto-decay at end of round: Strong → Waning → Inert; waning = half-filled from bottom | Element board exists but decay may not be automated at end of round | Verify/implement automatic element decay on advancePhase; ensure 3-state visual (inert, strong, waning) | **High** |
| 12 | **Condition automation** | Auto-expire (Strengthen end of turn), auto-apply (Wound damage at start), confirm prompts, per-condition toggles | Conditions tracked but no automation for expiry or damage application | Add condition expiry engine, auto-damage for Wound/Poison, configurable per-condition behavior | **High** |
| 13 | **Character sheet overlay** | Full character sheet: level, XP thresholds, perks with AMD modifications, items, personal quest, battle goals, notes, retirement | No character sheet — just basic stats on Active Play tab | Build character sheet overlay reading from edition data; perk system modifying AMD; items, personal quest, retirement flow | **High** |
| 14 | **Character card inline conditions** | Active conditions appear as small icons inline on always-visible character board | Conditions tracked but display is in separate conditionGrid, not inline on card | Show active conditions inline on character card summary | **Medium** |
| 15 | **Modifier deck visualization** | Full card stack visualization with draw/discard pile, reveal all, bless/curse/edit, advantage/disadvantage, per-character decks | Loot & Decks tab has AMD with draw/shuffle/bless/curse but no card stack visual or per-character decks | Add visual deck representation; per-character AMD support; advantage/disadvantage drawing | **Medium** |
| 16 | **Initiative input overlay (numpad)** | Phone-style numpad overlay with Long Rest option; also inline textbox; drag-to-set | Inline number input only during draw phase | Add numpad overlay option, Long Rest button, drag initiative support | **Medium** |
| 17 | **Standee halo on room reveal** | Newly spawned standees have temporary halo/glow to distinguish from existing | No visual distinction for new standees | Add halo animation for newly spawned standees | **Medium** |
| 18 | **Campaign management — full** | Prosperity tracker (checkbox grid), sanctuary donations, global achievements, unlocked items, treasures, scenario flow chart, event decks | Campaign tab shows party info, character roster, completed scenarios, unlocked characters | Add prosperity tracker, sanctuary donations, global achievements, unlocked items/treasures, scenario flowchart | **Medium** |
| 19 | **Party sheet** | Editable name, location, notes, achievements, reputation with auto-calculated shop price modifier | Campaign tab shows party name and reputation but no editable party sheet | Add editable party sheet with reputation → shop modifier mapping | **Medium** |
| 20 | **Undo/Redo** | Full undo with last action description in menu; configurable stack depth; redo support | `undoAction` command exists in protocol | Verify undo works; add redo; show last action description; make stack depth configurable | **Medium** |
| 21 | **Summon management — full** | Character summons with HP/conditions tracking; monster summons via gear icon; passive vs active summons; summon standees | Summon support exists but unclear if HP/conditions tracked; no monster-summon support | Verify summon HP/condition tracking; add monster summon support; passive/active summon distinction | **Medium** |
| 22 | **FH conditions** | 16 conditions including brittle, bane, impair, ward, regenerate, infect | Only GH conditions supported | Add FH-specific conditions with their unique mechanics (brittle = double damage, ward = halve, etc.) | **Medium** |
| 23 | **Loot deck (FH)** | FH loot deck with draw + character assignment + resource types | Loot & Decks tab has loot deck support | Verify FH loot deck works with all resource types; GH has no loot deck | **Medium** |
| 24 | **Spoiler protection** | Locked classes shown as "???" with icon only; Manage Spoilers in Data Management | Not implemented | Add spoiler protection for locked classes when building from edition data | **Low** |
| 25 | **FH outpost phase** | Full outpost phase: calendar, events, building, crafting, morale, defense | Not implemented | Implement outpost phase management (lower priority — focus on scenario play first) | **Low** |
| 26 | **Items system** | Item shop, equip/use/refresh/sell items, item state during scenarios, negative item effects | Not implemented | Add item management system reading from edition item data | **Low** |
| 27 | **Event cards** | Road/city event deck with draw, outcomes, auto-apply options | Not implemented | Add event card support | **Low** |
| 28 | **Battle goals** | Draw 2 (GH) or 3 (FH), keep 1; checkmark tracking; reminder before first round | Not implemented | Add battle goal system | **Low** |
| 29 | **Data backup/restore** | Export/import game state, settings; automatic backups; upload URL | Server has SQLite persistence but no export/import UI | Add export/import for game state and settings | **Low** |
| 30 | **Single-screen vs tabs** | GHS uses one screen with overlays; all game state visible at once | Controller uses 5 tabs (Active Play, Monster Mgmt, Scenario, Loot & Decks, Campaign) | Consider consolidating critical functionality; ensure Active Play shows enough context without tab-switching | **Low** |
| 31 | **Server connection (already done)** | Built-in server sync with reconnection | WebSocket hub with session tokens, reconnect, diff broadcast — already implemented | None — already handled | **Done** |
| 32 | **Keyboard shortcuts** | Full keyboard shortcut reference accessible from menu | Not implemented | Add keyboard shortcut support (lower priority for tablet/touch controller) | **Low** |
| 33 | **Multi-language** | 12 languages with community translation support | English only | Not needed for personal use — skip unless requested | **None** |
| 34 | **Themes** | Default, Frosthaven, Modern, Button & Bugs; auto-switch on edition | Dark parchment theme | Single theme is fine for personal use | **None** |
| 35 | **Drag interactions** | Drag to reorder figures, drag to set initiative/HP/XP/loot values | Not implemented | Consider for touch-friendly controller interactions | **Low** |
| 36 | **Scenario statistics** | Track damage, kills, loot, XP, heals per scenario per character | Not implemented | Nice-to-have analytics feature | **Low** |

### Key Engine Observations
- **Types are FH-ready:** `gameState.ts` already defines all FH conditions, resources,
  buildings, morale, defense, soldiers, inspiration, town guard, loot deck enhancements
- **36 commands exist** but missing: loot deck configuration, section reveals (distinct
  from room reveals), building management, event cards, town guard deck, scenario
  completion/rewards
- **Component stubs unused:** `healthControl.ts`, `conditionGrid.ts`, `initiativeInput.ts`
  are empty stubs — all rendering inlined in `activePlay.ts`
- **Undo system:** stores full state snapshots, capped at 50
- **FH data files available:** `buildings.json`, `campaign.json` (with seasonal events),
  `personal-quests.json`, `favors.json`, `challenges.json`, `trials.json`, `pets.json`,
  plus 128 monster files, 17 character files, and section-based scenario reveals

### Priority Summary
| Priority | Count | Description |
|----------|-------|-------------|
| **Critical** | 6 | Must have for basic functionality — edition data, auto-spawn, ability resolution, turn order, shared decks |
| **High** | 7 | Core gameplay automation — level calc, turn tracking, conditions, character sheet, elements, player count |
| **Medium** | 10 | Enhanced experience — inline conditions, modifier deck, initiative UI, campaign, undo, summons, FH conditions |
| **Low** | 10 | Nice-to-have — outpost, items, events, battle goals, backup, keyboard shortcuts, drag, statistics |
| **Done** | 1 | Server connection/sync already implemented |
| **None** | 2 | Not needed for personal use (multi-language, themes) |
