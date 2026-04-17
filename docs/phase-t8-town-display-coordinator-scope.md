# Phase T8 — Town Phase as Orchestrated Experience (Scope Document)

**Status:** Scope document. Not a Claude Code prompt yet. This captures
Kyle's vision for an interactive, display-driven town phase that coordinates
controller, phones, and display through each of the 5 FH outpost steps (and
the simpler 3-step GH town phase). Implementation is sequenced after T3
(controller outpost flow) and T4 (display town base map), which land the
data surfaces T8 builds on top of.

## Intent

Town phase today is a placeholder checklist. The existing Phase T plan
(T3 + T4) makes it functional — GM can drive outpost steps, display shows
state. **T8 makes it an event.** The display isn't a status panel; it's a
conductor that leads the table through each step, shows animated
consequences of decisions, and gives players a shared surface to look at
while they make choices on their phones.

Kyle's framing: "town phase should actually be engaging for players."
Today's placeholder isn't. Even T3+T4 as described leave phones + GM
doing the interesting work in silence while the display passively
mirrors a few pills.

---

## What T8 Delivers

### 1. Display becomes phase-aware

The display reads `state.party.townPhase.step` and switches its primary
view per step:

- `rewards` — (handled in T1 / T1.1) post-scenario tableau
- `passageOfTime` — calendar-focused
- `outpostEvent` — event card overlay on calendar
- `assault` — dedicated assault resolution screen (new)
- `buildingOps` — outpost map with active-building spotlight
- `downtime` — outpost map with character-movement animations
- `construction` — construction voting + animated build sequence

Transitions between steps have short cinematic animations (map tilts,
overlays slide, flourishes). This is the display's strength — use it.

### 2. Passage of Time

**Display:** large calendar takes over the screen. Season indicator.
Advancing a week animates the token across the calendar; days that carry
section references pulse. The GM hears the section number cue from the
display or controller simultaneously so the table knows to pause and
read.

**Season transitions:** when the party crosses from summer → winter (or
vice versa), the display runs a short seasonal transition (snow building
up / thawing out; particle preset swap). Event deck reshuffle is
indicated by a card-stack animation. Feels like the world is actually
turning.

**Controller:** compact timeline, advance/undo buttons, section text
popup when triggered.

**Phone:** status ("Week N of Season X"); no interactive surface for
this step.

**Engine / commands:** T3 already adds `advanceWeek`. T8 adds
`state.party.townPhase` state object (see below) and wires the display
to its current step.

### 3. Outpost Event

**Display:** event card draws into center of calendar. Narrative text
large enough for the table to read across the room. If the card presents
A/B options, the display shows "Awaiting response from party…" with
phone avatars lighting up as players vote.

**Phone:** A/B buttons appear during event. Each player taps their
preference. This is the first piece of **player agency** during town
phase on their phones.

**Controller:** sees per-player vote tally; final resolution button
("Resolve A" / "Resolve B") respects party vote by default but GM can
override.

**Engine / commands:** T6 already adds `drawRoadEvent`, `drawOutpostEvent`,
`resolveEvent`. T8 adds `castEventVote` (phone → server) and vote
aggregation in `state.party.townPhase.eventVotes`.

### 4. Attack/Assault Events (separate screen)

This is the biggest new mechanical surface. FH outpost attack events
trigger a sequence the app should own end-to-end.

**Display:** switches to assault view.

- Top: the attacking force (enemy banner, force strength).
- Middle: outpost map with targeted buildings highlighted red.
- Bottom: soldier count, defense value, Town Guard AMD deck preview.
- Each roll is animated: Town Guard AMD card flip, die roll (if any),
  damage application to building (health bar decrements, sticker applied
  at thresholds).

**Controller:** drives the resolution — "Draw Town Guard Modifier,"
"Apply damage to [building]," "Spend soldier," "Spend defense."
Mirrors the scenario-mode AMD overlay UX but themed for assault.

**Phone:** informational. Players see their soldiers spent, defense
depleted.

**Engine / commands (new in T8):**
- `startAssault(attackForce, targetBuildings[])`
- `drawTownGuardCard`
- `applyAssaultDamage(buildingId, amount)`
- `spendSoldier(count)`
- `spendDefense(count)`
- `resolveAssault(outcome)`

State additions:
```ts
interface AssaultState {
  attackerName: string;
  attackerForce: number;
  targets: string[]; // building ids
  townGuardDeck: AttackModifierDeckModel; // already on Party, now active
  damageDealt: Record<string /* buildingId */, number>;
  soldiersSpent: number;
  defenseSpent: number;
  resolved: boolean;
}

// on Party.townPhase:
assault?: AssaultState;
```

The Town Guard Deck exists on `Party.townGuardDeck` today but no commands
operate on it. T8 owns that.

### 5. Building Operations (initiative cycle)

**Display:** outpost map. Active building spotlights, others dim. A small
"initiative order" sidebar shows the upcoming buildings. When a building
activates, its icon pulses, a compact overlay slides in showing:

- Building name + operation text.
- What it does this step (cost, effect).
- Status (idle / resolving / done).

**Controller:** tap a building operation → triggers its effect via
existing T3 commands. Advance to next building in initiative.

**Phone:** only shows an interactive surface if a particular building
operation targets a specific player (e.g., Sanctuary donation prompts
individual characters; Enhancer lists a character's cards). Otherwise
the phone shows a "waiting on GM" status tied to current active building.

**Initiative order for buildings:** check FH rulebook for the canonical
order (it's consistent per scenario). Store as a static list per edition
in the reference DB (this may already exist as a label; if not, it's a
new small data surface).

**Engine:** `state.party.townPhase.buildingOpsIdx: number` tracks
progress through the initiative list. `advanceBuildingOp` command moves
to the next.

### 6. Downtime — the Big Deal screen

**Phone is the main surface here** — this is where T2 (Items, Perks,
Level Up, Enhancements, Personal Quest, crafting, brewing) lives.
Players spend the most time in town on this step, navigating tabs.

**Display is the social glue.** It shows:

- The outpost map with character tokens.
- Characters visually **move between buildings** as they interact. When
  a player opens the Enhancer tab on their phone, their token walks to
  the Enhancer building on the display. When they close it, token walks
  back. When they commit an action (buy/craft/brew), a small flourish
  fires above the building.
- A top-right panel shows each character's current status: "At
  Craftsman," "Browsing shop," "Leveling up," "Idle," "Done."
- When all characters have tapped "Done with downtime," the display runs
  a short "everyone is ready" transition and the controller auto-advances.

**This is where the display earns its keep during town.** It takes what
would otherwise be 5 minutes of players heads-down on phones and makes
it a shared scene.

**Engine additions:**
- `state.party.townPhase.characterLocations: Record<string /* char name */, string /* building id or 'idle' */>`
- `setCharacterTownLocation` — phone sends when opening/closing a
  building-associated tab.
- `setCharacterDowntimeReady` — phone sends "Done" → controller gets
  quorum signal.

### 7. Construction voting

**Display:** full-screen construction interface.

- Grid of available buildings (unbuilt + those with available upgrades).
  Each card: building portrait, cost, effect summary.
- Per-player vote preference lights up cards (player avatars stack on
  the card they're voting for).
- GM panel at bottom shows current vote tally, "Build" / "Skip" /
  "Override" actions.
- On GM confirmation, a build animation plays (building rises from the
  ground or gets a "+upgrade" flourish).

**Phone:** a dedicated "Construction Proposals" overlay. Scrollable
list of options. Tap to vote. Change vote freely until GM resolves.

**Controller:** override interface — GM can pick anything regardless of
vote. Must pick before step advances.

**Engine / commands (new):**
- `castConstructionVote(characterName, buildingId | null)`
- `resolveConstruction(buildingId | 'skip')` — GM only
- Vote state on `state.party.townPhase.constructionVotes: Record<string, string>`

Construction itself still uses T3's existing `constructBuilding` /
`upgradeBuilding` / `wreckBuilding` commands — T8 just wraps voting
around them.

### 8. GH town phase variant (simpler)

Map the 3 GH town steps (City Event → Character Management → Scenario
Selection) to the same T8 display coordinator. City event = outpost
event (minus attack handling). Character management = downtime (minus
resource/crafting/building-specific tabs — just Items, Perks, Level Up,
Enhancements, Quest from T2). Scenario selection = T5 world map hands
off here naturally.

---

## State Model

New subtree under `state.party`:

```ts
export type TownPhaseStep =
  | 'rewards' // post-scenario, handled by T1/T1.1
  | 'passageOfTime'
  | 'outpostEvent'
  | 'assault'
  | 'buildingOps'
  | 'downtime'
  | 'construction'
  | 'complete';

export interface TownPhaseState {
  step: TownPhaseStep;
  /** Per-step data — only the relevant one is populated per step. */
  passageOfTime?: {
    fromWeek: number;
    toWeek: number;
    triggeredSections: string[];
    seasonChanged: boolean;
  };
  outpostEvent?: {
    eventId: string;
    eventType: 'outpost-winter' | 'outpost-summer' | 'road' | 'city';
    narrative: string;
    optionA: string;
    optionB: string;
    votes: Record<string /* character name */, 'A' | 'B'>;
    resolution?: 'A' | 'B';
  };
  assault?: AssaultState; // see section 4
  buildingOps?: {
    initiativeOrder: string[]; // building ids
    currentIdx: number;
    completed: string[];
  };
  downtime?: {
    characterLocations: Record<string, string>; // char -> building id or 'idle'
    ready: Record<string, boolean>; // char -> done?
  };
  construction?: {
    availableProposals: Array<{
      buildingId: string;
      kind: 'construct' | 'upgrade';
      cost: Record<string, number>;
    }>;
    votes: Record<string /* character name */, string | null>; // char -> buildingId
    gmResolution?: string | 'skip';
  };
}
```

Add `townPhase?: TownPhaseState` to `Party`.

---

## Command Additions (consolidated)

Commands T8 adds on top of T3's set:

**Phase stepping:**
- `startTownPhase` — transitions rewards → passageOfTime (or sets
  appropriate GH step)
- `advanceTownPhaseStep` — next step (validation: each step has
  preconditions, see per-step sections above)

**Passage of Time:** reuses `advanceWeek` from T3.

**Outpost Event:** reuses `drawOutpostEvent`, `resolveEvent` from T6;
adds `castEventVote(characterName, 'A' | 'B')`.

**Assault:** `startAssault`, `drawTownGuardCard`, `applyAssaultDamage`,
`spendSoldier`, `spendDefense`, `resolveAssault`.

**Building Ops:** reuses `useBuilding` from T3; adds `advanceBuildingOp`.

**Downtime:** `setCharacterTownLocation(characterName, buildingId)`,
`setCharacterDowntimeReady(characterName, ready: boolean)`.

**Construction:** `castConstructionVote(characterName, buildingId | null)`,
`resolveConstruction(buildingId | 'skip')`. Actual build uses T3's
`constructBuilding` / `upgradeBuilding`.

Phone permission whitelist: all `cast*Vote`, `setCharacterTownLocation`,
`setCharacterDowntimeReady` are character-scoped. Everything else is
controller-only.

---

## Recommended Build Order for T8

T8 is too big for one prompt. Proposed sub-splits:

| Batch | Scope | Prereqs | Value |
|---|---|---|---|
| **T8a** | `townPhase` state model + step transitions + display view switcher. Skeleton per-step display views that show step names and basic state readout. Controller step advance buttons. | T3, T4 complete | Makes the display phase-aware. Unlocks everything else. |
| **T8b** | Passage of Time + Outpost Event with voting. Calendar display, event card overlay, phone A/B vote, controller tally + resolve. | T8a, T6 | Highest per-meeting engagement lift for the early steps. |
| **T8c** | Assault screen. Town Guard AMD activation, assault resolution commands, dedicated display view. | T8a | Unlocks FH attack events, which currently have no home. |
| **T8d** | Building Operations initiative cycle. Active-building spotlight, per-building overlays. | T8a, T3 | Paces the building ops step; phone interactions are contextual. |
| **T8e** | Downtime big-deal screen. Character movement animation on outpost map, ready-check, status panel. | T8a, T2a–d complete (so phone tabs are real) | The centerpiece of the town display experience. |
| **T8f** | Construction voting. Phone vote UI, display vote tableau, GM resolution, build animations. | T8a, T3 | Completes the cycle. Shortest sub-batch. |

---

## Risks & Open Questions

1. **Animation complexity vs delivery speed.** Character token pathfinding
   across the outpost map (T8e) is a real chunk of UI work. MVP could use
   simple "avatar appears next to building when active, disappears when
   not" instead of actual walk paths. Decide at the start of T8e, not now.
2. **Voting ties.** If event votes split 2/2, what's the controller flow?
   Probably: GM breaks the tie by tapping the option. State supports this
   (GM can always override). Document in rules reference.
3. **Town Guard Deck construction.** FH defines this per scenario /
   prosperity level / building state. The deck-building logic needs its
   own pass — flag in T8c.
4. **GM override UX.** In multiple steps (event vote, construction vote),
   the controller has final say despite player input. Make sure the
   controller UI always makes this visible so the GM knows they can
   override, and players understand their vote is advisory.
5. **Do characters need to be co-present?** In physical play, everyone
   is at the table. For remote play over shared screen? Out of scope.
   Assume everyone is in the same room as the display.

---

## Where This Fits in the Roadmap

Current Phase T order, updated:

1. **T1** ✅ (landed)
2. **T1.1** — display rewards dismissal fix (small)
3. **T2a** — Items (prompt ready)
4. **T2b** — Level Up + Perks
5. **T2c** — Personal Quest + Retirement
6. **T2d** — Enhancements + FH crafting/brewing
7. **T3** — FH outpost phase controller (still needed; T8 sits on top)
8. **T4** — Display town base map (still needed; T8 sits on top)
9. **T5** — World map scenario selection
10. **T6** — Event card system
11. **T7** — GH town phase variant
12. **T8a–f** — Orchestrated town display (this doc)

T8 isn't a replacement for T3/T4 — it's the layer that makes them feel
alive. T3/T4 should ship even without T8 so playtest progress isn't
blocked by T8's size. Each T3/T4 prompt should:

- Keep its state and commands simple enough that T8 can layer on top
  without refactoring engine code.
- Avoid hard-coding display layout decisions that would conflict with
  T8's phase-aware switcher — in particular, T4's "display town base map"
  view should be designed as a *surface* T8 can take over, not a
  monolithic always-on view.

When I write T3 and T4 prompts, I'll include those constraints.

---

## What to do with this doc

Save it as `docs/PHASE_T8_SCOPE.md` in the repo. Reference it from
`docs/ROADMAP.md` under Phase T. T3/T4 prompts when written will link to
it as the "what comes later" context so they're built compatibly.
