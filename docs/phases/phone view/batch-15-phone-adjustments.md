# Batch 15: Phone View Adjustments + Character Theming + Timeline + Condition Splash Art

## Skills to Read FIRST

Before any work, read these skill files in order:

1. **UI/UX Pro Max skill** — Read ALL `.md` files in:
   `C:\Users\Kyle Diaz\.claude\plugins\marketplaces\ui-ux-pro-max-skill\`
2. **Frontend Agent skills** — Read ALL `.md` files in:
   `C:\Users\Kyle Diaz\.agents\skills\`
3. **Project conventions** — Read `app/CONVENTIONS.md`
4. **Shared styles** — Read `app/shared/styles/theme.css`

Priority when skills conflict: (1) `app/CONVENTIONS.md`, (2) UI/UX Pro Max, (3) agent skills.

---

## Overview

This batch makes 9 adjustments to the phone client, grouped into three tiers:

- **Tier 1 (Functional fixes):** Landscape support, loot changes, exhaust rework, remove elements, defer summons
- **Tier 2 (New features):** Initiative timeline overlay, loot deck draw popup
- **Tier 3 (Design features):** Per-character theming, condition splash art overlays

Audit the current phone codebase before starting:
```
app/phone/App.tsx
app/phone/ScenarioView.tsx
app/phone/components/    (all files)
app/phone/overlays/      (all files)
app/phone/styles/phone.css
app/components/           (shared components used by phone)
app/hooks/                (all hooks)
```

Also read the old phone.html for timeline reference — it's in the `clients/` directory or repo history. The timeline was a horizontal strip showing all figures (characters + monster groups + summons) sorted by initiative, advancing left to right, with the active figure highlighted.

---

## Tier 1: Functional Fixes

### 1.1 — Landscape View Support

The phone must work in BOTH portrait and landscape orientations. Remove any portrait lock from the PWA manifest and CSS.

**Portrait layout** (current): Vertical stack as-is — HP bar, initiative, turn banner, conditions, counters, action bar.

**Landscape layout**: Two-column arrangement optimized for wider viewport:
- **Left column (~55%):** HP bar (still dominant) + initiative section + turn banner
- **Right column (~45%):** Condition strip (vertical in landscape), XP + Loot counters, action buttons
- Character header spans full width at top

Use CSS media query `@media (orientation: landscape) and (max-height: 500px)` to detect phone-in-landscape (not tablet). The action bar should remain bottom-anchored in both orientations.

Test at common phone landscape sizes: 844×390 (iPhone 14), 915×412 (Pixel 7), 932×430 (iPhone 15 Pro Max).

### 1.2 — Loot: Read-Only Tracker (No +/-)

**Remove** the +/- buttons from the loot counter. Loot is read-only on the phone — the controller manages loot assignment. The phone just displays the current `character.loot` value (GH) or `character.lootCards.length` (FH).

Keep the loot icon + count display. It should still show FH resource breakdowns if loot cards exist (lumber, metal, hide, herbs).

The XP counter KEEPS its +/- buttons — players adjust XP themselves during play.

### 1.3 — Loot Deck Draw Popup (FH Only)

When FH loot deck is active (`state.lootDeck?.cards?.length > 0`), add a loot draw button that:
- Only appears/is-active during the player's active turn
- Tapping opens a popup overlay showing:
  - "Draw Loot Card" button
  - Sends `drawLootCard` command (this draws from the shared deck)
  - After draw, displays the drawn card type (money amount, resource type, random item)
  - Card auto-assigns to this character (controller can reassign if needed)
- Disabled/hidden when not the player's turn
- Button placement: near the loot counter area

**Note:** `drawLootCard` is currently in the phone permission blocklist from Batch 14. You'll need to add it to the phone whitelist in `wsHub.ts`, but ONLY allow it when the phone's character is the active figure. This requires checking `state` in the permission validator — if that's too complex for the permission check, just add `drawLootCard` to the whitelist and we'll accept that a player could technically draw when it's not their turn.

### 1.4 — Remove Exhaust Button, Add Auto-Exhaust Popup

**Remove** the Exhaust button from `PhoneActionBar`.

**Add** an auto-exhaust detection popup: When the character's health reaches 0 (watch for `character.health === 0` in state updates), show a full-screen overlay:

```
╔═══════════════════════════════╗
║                               ║
║     ☠  YOU HAVE BEEN          ║
║        EXHAUSTED              ║
║                               ║
║  Your health has reached 0.   ║
║  All cards go to lost pile.   ║
║  You keep all XP and gold     ║
║  earned this scenario.        ║
║                               ║
║  ┌─────────┐  ┌──────────┐   ║
║  │ Confirm │  │  Cancel  │   ║
║  │(Exhaust)│  │(Back to 1)│  ║
║  └─────────┘  └──────────┘   ║
╚═══════════════════════════════╝
```

- **Confirm**: sends `toggleExhausted` command, character is exhausted
- **Cancel**: sends `changeHealth` with delta +1, returning character to 1 HP (they chose to lose a card instead of dying)
- Style this dramatically — dark overlay, skull icon, dramatic typography. This is a significant game moment.
- The popup should feel weighty, not casual. Use Cinzel for the heading, deep red accents.

### 1.5 — Add Element Board to Phone

The phone currently has NO element display. Players need to see which elements are Strong/Waning/Inert so they can plan their abilities, and they need to be able to consume and infuse elements during their turn.

**Display:** A compact horizontal row of the 6 element icons (Fire, Ice, Air, Earth, Light, Dark) showing current state. Reuse or adapt the shared `ElementBoard` component from `app/components/ElementBoard.tsx`.

**Element states (visual):**
- **Inert:** Greyed out / desaturated
- **Strong:** Full color, bright
- **Waning:** Half-filled from bottom (CSS clip-path — this was already implemented for the controller in Batch 3)

**Interaction:** Tapping an element cycles its state via the `moveElement` command:
- Inert → Strong (infuse)
- Strong → Consumed/Inert (consume)
- Waning → Consumed/Inert (consume)
- This matches the controller's click-cycle behavior

**When active:** Elements should only be tappable/interactive during the player's active turn. Outside their turn, the element row is read-only (shows current state, taps do nothing or are visually disabled).

**Placement:**
- **Portrait:** Below the condition strip, above the XP/Loot counters. Compact single row.
- **Landscape:** In the right column, between conditions and counters.

**Size:** Icons should be ~32-36px. The row should be compact — this is reference information, not a primary interaction. But it must be clearly readable at a glance across the table.

**Server permission:** Add `moveElement` to the phone command whitelist in `wsHub.ts`. Unlike character-targeted commands, `moveElement` doesn't have a character target — it's a global game state command. Allow it for phone clients only during their active turn if feasible, otherwise just whitelist it (the controller can also move elements, so conflicts are manageable).

### 1.6 — Defer Summons

Remove `PhoneSummonSection` from the phone ScenarioView for now. Summon management needs to be developed jointly with the controller (which currently has no summon mechanism either). Leave the component files in place but don't render them.

Add a code comment: `// TODO: Summons deferred — develop jointly with controller summon mechanism`

---

## Tier 2: New Features

### 2.1 — Initiative Timeline Overlay

This is a key feature from the old phone.html that needs to be rebuilt in Preact. It shows ALL figures in the scenario sorted by initiative, advancing left to right.

**Behavior:**
- **Appears** at the start of the play phase (after Draw is clicked and abilities are drawn)
- **Shows** a horizontal timeline strip with all figures in initiative order:
  - Characters: class portrait thumbnail + initiative number
  - Monster groups: monster portrait + initiative number (from drawn ability card)
  - Character summons: small summon icon attached to their summoner
- **Active figure** is highlighted (gold glow/border, slightly larger)
- **Completed figures** are dimmed/greyed
- **Waiting figures** are normal opacity
- **The player's own character** has a distinct marker (accent border in their class color)
- **Auto-dismisses** when the player's character becomes the active figure (their turn starts)
- **Can be manually dismissed** by tapping anywhere on the overlay
- **Re-appears** when the player's turn ends (they tap End Turn) — showing progression
- **Fixed position** at top of screen, does NOT scroll with content
- **Slides in from top** with a smooth animation, slides out when dismissed

**Visual design direction (use UI/UX Pro Max + frontend design skill):**
- Horizontal scroll if many figures (6+ figures common in Gloomhaven)
- Compact — should not dominate the screen. Think of it as a thin progress bar with detail
- Height: ~80-90px including initiative numbers
- Portraits should be circular thumbnails (40-50px)
- Use GHS portrait assets: `assets/ghs/images/{edition}/characters/{name}.png` for characters, `assets/ghs/images/{edition}/monsters/{name}.png` for monsters
- Background: semi-transparent dark, blurred backdrop
- The timeline should feel like a physical initiative tracker sliding across a table

**Data source:** `state.figures` gives the ordered figure list. Cross-reference with `state.characters` and `state.monsters` for initiative values. Use the same sorting logic as `getInitiativeOrder()` from the shared engine.

### 2.2 — Character Detail: Swipe-to-Close

The existing `PhoneCharacterDetail` overlay opens from the bottom. Enhance it:

- **X button** in top-right corner (already requested, may exist)
- **Swipe down gesture** to close: track touch start/move/end on the overlay panel. If user swipes down more than 80px, close the overlay with a slide-down animation. Partial swipe (< 80px) snaps back.
- Use `touch-action: pan-y` on the overlay body to allow native-feeling swipe
- The swipe should feel physical — the panel follows the finger, with slight resistance/rubber-banding

Implementation: track `touchstart` Y position, on `touchmove` translate the panel down by the delta, on `touchend` if delta > 80px animate close, else snap back with a spring animation.

---

## Tier 3: Design Features

### 3.1 — Per-Character Theming

**This is a design-heavy task. Use UI/UX Pro Max skill extensively.**

Each FH/GH character class has a distinct visual identity on their character mat. The phone app should reflect this — when a player selects their character, the phone's color palette and accent elements shift to match that character's identity.

**How it works:**
- On character selection (in `CharacterPicker.tsx` or when `App.tsx` resolves the character), apply a CSS class to the root phone element: `phone--character-{name}` (e.g., `phone--character-boneshaper`, `phone--character-drifter`)
- Define CSS custom property overrides per character class that change:
  - `--phone-accent`: primary accent color (from `character.color` in edition data)
  - `--phone-accent-glow`: glow/shadow color for active states
  - `--phone-accent-gradient`: subtle background gradient
  - `--phone-accent-dark`: darker variant for borders/shadows
  - `--phone-texture`: optional subtle texture overlay (parchment tint, ice crystals, bone patterns, etc.)

**Character color reference** (from GHS edition data `character.color` field):
- Each character JSON has a `color` field (e.g., Brute = `#35acd5`, Boneshaper = green, Drifter = earthy brown)
- Load the character's color dynamically and derive the accent palette from it

**What changes per character:**
- HP bar fill color shifts toward character accent
- Initiative section border/glow uses character accent
- Turn banner "Your Turn" glow uses character accent
- Character header accent bar (already uses class color)
- Action bar button highlights
- Numpad overlay accent
- Character detail overlay header

**What stays the same (the dark fantasy foundation):**
- Background base color (`#1a1410`)
- Font choices (Cinzel + Crimson Pro)
- Overall dark fantasy aesthetic
- Gold accent for universal UI elements (navigation, etc.)
- Shadow/depth treatment

**Design approach:** Think of it like a character's personal game screen. A Boneshaper's phone should have subtle green bone/necromantic accents. A Drifter's should feel earthy and weathered. A Blinkblade's should have sharp, electric blue highlights. The character's personality bleeds into the UI without overwhelming the base theme.

To get the character color, read from the game state: `character.color` is available after character selection. If specific per-class textures or patterns are desired, they can be added as background CSS patterns (no additional asset files needed — use CSS gradients, repeating patterns, or SVG data URIs).

### 3.2 — Condition Splash Art Overlays

**This is the most design-intensive feature. Use UI/UX Pro Max + frontend design skill together.**

When a character's turn begins (they become the active figure) and they have certain conditions, show a dramatic full-screen splash overlay that:
1. Demands attention — this is a rule reminder, not decoration
2. Shows the condition's effect briefly
3. Must be dismissed before the player can act

**Conditions that trigger splash overlays:**

#### Wound (before turn-start processing)
- **Visual:** Blood dripping down the screen. Red vignette. The wound condition icon large and centered.
- **Text:** "WOUNDED — You suffer 1 damage" (Cinzel, large)
- **Subtext:** "Wound is removed when healed" (Crimson Pro, smaller)
- **Animation:** Blood streaks animate downward from top. Screen pulses red briefly. 
- **Duration:** Must be dismissed by tap. Auto-dismiss after 4 seconds if not tapped.
- **Audio cue:** None (this is a tabletop companion, phones should be silent)

#### Stun
- **Visual:** Heavy chains or stone pillars overlaid. Grey/blue cold wash over the screen. Stun icon centered large.
- **Text:** "STUNNED — You cannot perform any abilities"
- **Subtext:** "You cannot use items. Stun is removed at end of your turn."
- **Animation:** Screen shakes briefly (CSS transform), then locks with chains/bars visual.
- **Interaction:** Must dismiss to proceed. Player literally can't do anything on their turn when stunned, so this overlay should linger and feel oppressive.

#### Disarm
- **Visual:** Crossed-out sword imagery. Red/orange slash across the screen. Disarm icon large.
- **Text:** "DISARMED — You cannot perform attack abilities"
- **Subtext:** "You may still move and perform non-attack actions. Removed at end of your turn."
- **Animation:** Sword icon slashes across, then fades to the static overlay.

#### Immobilize
- **Visual:** Rope/net/roots wrapping visual. Earth/brown tones. Immobilize icon.
- **Text:** "IMMOBILIZED — You cannot perform move abilities"
- **Subtext:** "You may still attack and perform non-move actions. Removed at end of your turn."
- **Animation:** Roots/ropes grow inward from edges, settling around the center.

#### Muddle
- **Visual:** Swirling fog/confusion effect. Purple/grey haze. Muddle icon.
- **Text:** "MUDDLED — Disadvantage on all attacks"
- **Subtext:** "Draw 2 modifier cards, use the worse result. Removed at end of your turn."
- **Animation:** Swirling/pulsing fog effect.

#### Poison
- **Visual:** Green toxic bubbles/drip. Poison icon. Green vignette.
- **Text:** "POISONED — All attacks against you gain +1"
- **Subtext:** "Heal removes poison instead of restoring HP."
- **Animation:** Green bubbles rise from bottom. Toxic drip from top.

#### Regenerate (positive — different tone)
- **Visual:** Warm golden healing glow. Green/gold aura. Regenerate icon.
- **Text:** "REGENERATE — Heal 1, self"
- **Subtext:** "Regenerate is removed when you suffer damage."
- **Animation:** Warm pulse outward from center. Gentle, not aggressive.
- **Tone:** This is a POSITIVE reminder. Warm, hopeful, brief.

#### Bane (FH only)
- **Visual:** Dark purple/black ominous cloud. Skull/death imagery. Bane icon.
- **Text:** "BANE — You will suffer 10 damage at end of next turn"
- **Subtext:** "Bane is removed by healing."
- **Animation:** Dark clouds roll in from edges. Ominous pulse.
- **Note:** Bane fires at end of NEXT turn, not immediately. This is a warning.

**Implementation approach:**

Create a `PhoneConditionSplash` component that:
1. Watches for the player's character becoming the active figure (`character.active === true` transition)
2. Checks which conditions are present
3. Queues splash overlays in priority order: Stun first (most restrictive), then Wound, Poison, Disarm, Immobilize, Muddle, Bane, Regenerate
4. Shows them one at a time with a tap-to-dismiss or 4-second auto-dismiss
5. After all splashes are dismissed, the player can interact with their turn

**Visual implementation:**
- Each condition splash is a full-viewport overlay (`position: fixed; inset: 0; z-index: 100`)
- Background effects use CSS only: gradients, box-shadows, animations, clip-paths, pseudo-elements
- The condition icon should use the GHS SVG asset: `assets/ghs/images/conditions/{condition}.svg` (or `.png`)
- Text uses Cinzel for the condition name, Crimson Pro for the description
- Tap anywhere to dismiss. Show a subtle "tap to dismiss" hint at the bottom.
- Each splash should feel like a brief cinematic moment — dramatic but not slow

**CSS animation examples:**
- Blood drip: CSS `@keyframes` with `linear-gradient` shifting + `background-position` animation
- Screen shake: `@keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-4px)} 75%{transform:translateX(4px)} }`
- Fog swirl: Radial gradient with animated rotation via pseudo-element
- Roots growing: `clip-path` animation from edges inward
- Toxic bubbles: Multiple `::before`/`::after` pseudo-elements with staggered rise animations

---

## Files to Create/Modify

### New Files
```
app/phone/components/PhoneElementRow.tsx              — Compact element board for phone
app/phone/components/PhoneInitiativeTimeline.tsx       — Timeline strip component
app/phone/overlays/PhoneConditionSplash.tsx       — Condition splash overlay system
app/phone/overlays/PhoneLootDeckPopup.tsx          — FH loot draw popup
app/phone/overlays/PhoneExhaustPopup.tsx           — Auto-exhaust at 0 HP
```

### Modified Files
```
app/phone/ScenarioView.tsx         — Wire new components, add elements, remove summons
app/phone/components/PhoneCounterRow.tsx   — Remove loot +/-, add loot draw button (FH)
app/phone/components/PhoneActionBar.tsx    — Remove exhaust button
app/phone/overlays/PhoneCharacterDetail.tsx — Add swipe-to-close gesture
app/phone/styles/phone.css         — Landscape media queries, character themes, splash art CSS
app/phone/App.tsx                  — Apply character theme class to root
server/src/wsHub.ts                — Add drawLootCard + moveElement to phone whitelist
```

### Files to Remove (content only, keep file)
```
app/phone/components/PhoneSummonSection.tsx — Gut contents, leave stub with TODO comment
```

---

## Verification Checklist

- [ ] Phone works in portrait orientation (existing behavior preserved)
- [ ] Phone works in landscape orientation (two-column layout, all sections accessible)
- [ ] Loot shows read-only count (no +/- buttons)
- [ ] FH loot deck draw button appears during active turn, draws card
- [ ] XP still has +/- buttons
- [ ] Exhaust button removed from action bar
- [ ] 0 HP triggers exhaustion popup with Confirm/Cancel
- [ ] Cancel on exhaust popup sets HP to 1
- [ ] Element board shows 6 elements with correct state (inert/strong/waning)
- [ ] Elements are interactive during player's active turn (tap to cycle)
- [ ] Elements are read-only/disabled when not player's turn
- [ ] Waning elements show half-filled visual (CSS clip-path)
- [ ] Summon section not rendered (component stubbed with TODO)
- [ ] Initiative timeline appears at play phase start
- [ ] Timeline shows all figures in initiative order with portraits
- [ ] Timeline auto-dismisses when player's turn starts
- [ ] Timeline re-appears when player ends their turn
- [ ] Character detail overlay has X button and swipe-to-close
- [ ] Swipe down > 80px closes detail, < 80px snaps back
- [ ] Character theme colors applied based on selected character
- [ ] HP bar, initiative glow, turn banner reflect character accent color
- [ ] Wound splash shows blood drip animation on turn start
- [ ] Stun splash shows chains/lock with "cannot act" message
- [ ] Disarm splash shows crossed sword with "cannot attack" message
- [ ] Immobilize splash shows roots/net with "cannot move" message
- [ ] Muddle splash shows fog with "disadvantage" message
- [ ] Poison splash shows toxic bubbles with "+1 attack against you" message
- [ ] Regenerate splash shows warm glow with "heal 1" message
- [ ] Bane splash shows ominous cloud with "10 damage end of next turn" warning
- [ ] Condition splashes queue in priority order (stun first)
- [ ] Each splash dismissable by tap or 4-second auto-dismiss
- [ ] All splashes shown before player can interact with turn
- [ ] Service worker cache busting still works after changes (hashes regenerated)

---

## Docs to Update

- `docs/BUGFIX_LOG.md` — append entries for exhaust rework, loot change
- `docs/DESIGN_DECISIONS.md` — append entries for: landscape layout strategy, per-character theming system, condition splash art approach, timeline overlay design, exhaust auto-detection replacing manual button, summon deferral rationale, loot read-only on phone, phone element board (interactive on active turn only)
- `docs/APP_MODE_ARCHITECTURE.md` — update phone ScenarioView section to reflect new layout (landscape + portrait), new overlays (timeline, splash, exhaust, loot draw)
- `docs/PROJECT_CONTEXT.md` — update phone component list
- `docs/ROADMAP.md` — update Phase 3 completion status
- `docs/COMMAND_PROTOCOL.md` — note drawLootCard + moveElement added to phone whitelist

**Commit message:** `feat: phone landscape, character theming, initiative timeline, condition splash overlays`
