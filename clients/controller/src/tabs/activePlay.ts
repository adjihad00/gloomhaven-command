// Active Play tab — initiative timeline, character cards, monster standees,
// element board, FABs, and event delegation
import { getStore, getCommands } from '../main.js';
import { formatName } from '../utils.js';
import type { StateStore, CommandSender } from '@gloomhaven-command/client-lib';
import type {
  GameState, Character, Monster, MonsterEntity, Summon,
  ElementModel, ElementType, ElementState, ConditionName,
  CommandTarget, FigureIdentifier, OrderedFigure,
  AttackModifierDeckModel,
} from '@gloomhaven-command/shared';
import {
  NEGATIVE_CONDITIONS, POSITIVE_CONDITIONS,
  isPositiveCondition,
  getInitiativeOrder,
  ELEMENT_TYPES,
} from '@gloomhaven-command/shared';

// ── Condition subsets for the compact UI ─────────────────────────────────────

/** Conditions shown on character cards (negative + positive gameplay conditions) */
const CHAR_CONDITIONS: ConditionName[] = [
  'stun', 'immobilize', 'disarm', 'wound', 'muddle', 'poison',
  'strengthen', 'invisible', 'regenerate', 'ward',
];

/** Conditions shown on monster standees and summons (negative only) */
const ENTITY_CONDITIONS: ConditionName[] = [
  'stun', 'immobilize', 'disarm', 'wound', 'muddle', 'poison',
];

// ── Module state ─────────────────────────────────────────────────────────────

let store: StateStore;
let commands: CommandSender;
let tabPlay: HTMLElement;
let fabContainer: HTMLElement;
let lastRenderedRevision = -1;
let initialized = false;

// ── Public init ──────────────────────────────────────────────────────────────

export function initActivePlayTab(): void {
  if (initialized) return;
  initialized = true;

  store = getStore();
  commands = getCommands();
  tabPlay = document.getElementById('tabPlay')!;
  fabContainer = document.getElementById('fabContainer')!;

  attachEventListeners();

  store.subscribe((state) => {
    if (state.revision === lastRenderedRevision) return;
    lastRenderedRevision = state.revision;
    render(state);
    updateFabs(state);
  });

  // Initial render
  const state = store.getState();
  if (state) {
    lastRenderedRevision = state.revision;
    render(state);
    updateFabs(state);
  }
}

// ── Main render ──────────────────────────────────────────────────────────────

function render(state: GameState): void {
  tabPlay.innerHTML =
    renderTimeline(state) +
    renderCharacters(state) +
    renderMonsters(state) +
    renderModifierDeck(state) +
    renderElements(state);

  requestAnimationFrame(() => scrollTimelineToActive());
}

// ── Timeline ─────────────────────────────────────────────────────────────────

function renderTimeline(state: GameState): string {
  const order = getInitiativeOrder(state);
  const mainFigures = order.filter(f => f.type === 'character' || f.type === 'monster');

  if (mainFigures.length === 0) {
    return `<div class="play-timeline"><div class="timeline-track">
      <span class="timeline-empty">No figures in play</span>
    </div></div>`;
  }

  const figures = mainFigures.map(f => {
    const cls = f.active ? 'active' : f.off ? 'completed' : '';
    const figureId = `${f.edition}-${f.name}`;
    const thumbDir = f.type === 'character' ? 'character' : 'monster';
    const iconUrl = `/assets/images/${thumbDir}/thumbnail/${figureId}.png`;
    const fallback = formatName(f.name).substring(0, 2).toUpperCase();
    const initDisplay = f.initiative > 0 ? f.initiative : '—';

    return `<div class="tl-figure ${cls}" data-figure-id="${figureId}">
      <div class="tl-init">${initDisplay}</div>
      <div class="tl-icon-ring">
        <img src="${iconUrl}" class="tl-icon-img" alt="${f.name}"
             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
        <span class="tl-icon-fallback" style="display:none">${fallback}</span>
      </div>
      <div class="tl-name">${formatName(f.name)}</div>
      ${f.active ? '<div class="tl-active-arrow">▲</div>' : ''}
    </div>`;
  }).join('');

  return `<div class="play-timeline"><div class="timeline-track" id="timelineTrack">${figures}</div></div>`;
}

function scrollTimelineToActive(): void {
  const track = document.getElementById('timelineTrack');
  if (!track) return;
  const container = track.parentElement!;
  const activeEl = track.querySelector('.tl-figure.active') as HTMLElement | null;

  if (activeEl) {
    const activeCenter = activeEl.offsetLeft + activeEl.offsetWidth / 2;
    const offset = container.offsetWidth / 2 - activeCenter;
    track.style.transform = `translateX(${offset}px)`;
  } else {
    const trackW = track.scrollWidth;
    const containerW = container.offsetWidth;
    const offset = Math.max(0, (containerW - trackW) / 2);
    track.style.transform = `translateX(${offset}px)`;
  }
}

// ── Character Cards ──────────────────────────────────────────────────────────

function renderCharacters(state: GameState): string {
  const chars = state.characters.filter(c => !c.absent);
  if (chars.length === 0) return '';

  let html = `<div class="play-section">
    <div class="play-section-header" data-collapse="characters">
      <span class="play-section-title">Characters</span>
      <span class="play-section-toggle">▼</span>
    </div>
    <div class="play-section-content" id="playCharactersContent">
      <div class="characters-grid">`;

  for (const char of chars) {
    const turnCls = char.active ? 'active-turn' : char.off ? 'turn-done' : '';
    const initSection = state.state === 'draw'
      ? `<input type="number" class="init-input" min="1" max="99"
               value="${char.initiative > 0 ? char.initiative : ''}"
               placeholder="—"
               data-action="setInitiative"
               data-target-type="character"
               data-target-name="${char.name}"
               data-target-edition="${char.edition}">`
      : `<span class="init-display">${char.initiative > 0 ? char.initiative : '—'}</span>`;

    html += `<div class="character-card ${turnCls}"
                  data-target-type="character"
                  data-target-name="${char.name}"
                  data-target-edition="${char.edition}">
      <div class="character-card-main">
        <div class="character-card-header">
          <div class="character-card-name">${formatName(char.name)}</div>
          <div class="character-card-init">${initSection}</div>
        </div>
        ${renderHealthControl(char.health, char.maxHealth, 'character', char.name, char.edition)}
        ${renderConditions(char.entityConditions.map(c => c.name), CHAR_CONDITIONS, 'character', char.name, char.edition)}
        ${renderSummons(char)}
      </div>
    </div>`;
  }

  html += '</div></div></div>';
  return html;
}

function renderSummons(char: Character): string {
  const summons = char.summons.filter(s => !s.dead);
  if (summons.length === 0) return '';

  let html = '<div class="summons-section">';
  for (const s of summons) {
    html += `<div class="summon-card">
      <div class="summon-card-header">
        <div>
          <div class="summon-card-name">${s.name || 'Summon'}</div>
          <div class="summon-card-parent">${formatName(char.name)}'s summon</div>
        </div>
        <div class="summon-card-actions">
          ${renderHealthControl(s.health, s.maxHealth, 'summon', char.name, char.edition, s.uuid)}
          <button class="kill-btn" data-action="removeSummon"
                  data-target-name="${char.name}"
                  data-target-edition="${char.edition}"
                  data-summon-uuid="${s.uuid}"
                  title="Remove summon">☠</button>
        </div>
      </div>
      ${renderConditions(s.entityConditions.map(c => c.name), ENTITY_CONDITIONS, 'summon', char.name, char.edition, s.uuid)}
    </div>`;
  }
  html += '</div>';
  return html;
}

// ── Monster Standees ─────────────────────────────────────────────────────────

function renderMonsters(state: GameState): string {
  const monsters = state.monsters.filter(m => m.entities.some(e => e.number !== undefined));
  if (monsters.length === 0) return '';

  let html = `<div class="play-section">
    <div class="play-section-header" data-collapse="monsters">
      <span class="play-section-title">Monsters</span>
      <span class="play-section-toggle">▼</span>
    </div>
    <div class="play-section-content" id="playMonstersContent">
      <div class="monsters-grid">`;

  for (const mon of monsters) {
    const turnCls = mon.active ? 'active-turn' : mon.off ? 'turn-done' : '';
    const sorted = [...mon.entities]
      .filter(e => e.number !== undefined)
      .sort((a, b) => a.number - b.number);

    html += `<div class="monster-group ${turnCls}">
      <div class="monster-group-header">
        <div class="monster-group-name">${formatName(mon.name)}</div>
        <div class="monster-group-init">${mon.initiative > 0 ? mon.initiative : '—'}</div>
      </div>
      <div class="monster-standees">`;

    for (const entity of sorted) {
      const isElite = entity.type === 'elite';
      const isBoss = entity.type === 'boss';
      const deadCls = entity.dead ? 'dead' : '';
      const typeCls = isElite ? 'elite' : isBoss ? 'boss' : '';
      const activeConditions = entity.entityConditions
        .filter(c => !c.expired && c.state !== 'removed')
        .map(c => c.name);

      html += `<div class="standee-row ${typeCls} ${deadCls}">
        <div class="standee-main-row">
          <div class="standee-number">${entity.number}</div>
          ${renderHealthControl(entity.health, entity.maxHealth, 'monster', mon.name, mon.edition, undefined, entity.number)}
          <div class="standee-spacer"></div>
          <button class="kill-btn ${entity.dead ? 'dead' : ''}"
                  data-action="toggleDead"
                  data-target-type="monster"
                  data-target-name="${mon.name}"
                  data-target-edition="${mon.edition}"
                  data-entity-number="${entity.number}"
                  data-entity-health="${entity.health}"
                  data-entity-dead="${entity.dead}"
                  title="${entity.dead ? 'Revive' : 'Kill'}">☠</button>
        </div>
        ${renderConditions(activeConditions, ENTITY_CONDITIONS, 'monster', mon.name, mon.edition, undefined, entity.number)}
      </div>`;
    }

    html += '</div></div>';
  }

  html += '</div></div></div>';
  return html;
}

// ── Monster Modifier Deck ────────────────────────────────────────────────────

function renderModifierDeck(state: GameState): string {
  const deck = state.monsterAttackModifierDeck;
  if (!deck) return '';

  const totalCards = deck.cards.length;
  const remaining = Math.max(0, totalCards - deck.current);
  const undrawn = deck.cards.slice(deck.current);
  const blessCount = undrawn.filter(c => c === 'bless').length;
  const curseCount = undrawn.filter(c => c === 'curse').length;

  return `<div class="play-section">
    <div class="play-section-header" data-collapse="modifierDeck">
      <span class="play-section-title">Monster Modifier Deck</span>
      <span class="play-section-toggle">▼</span>
    </div>
    <div class="play-section-content" id="playModifierContent">
      <div class="modifier-deck-row">
        <span class="modifier-deck-count">${remaining}/${totalCards}</span>
        <button class="btn btn-secondary btn-sm" data-action="drawModifier">Draw</button>
        <button class="btn btn-secondary btn-sm" data-action="shuffleModifier">Shuffle</button>
        <span class="modifier-bc-group">
          <span class="modifier-bc-label">B:${blessCount}</span>
          <button class="btn-icon small" data-action="removeModifierCard" data-card-type="bless"
                  ${blessCount === 0 ? 'disabled' : ''}>−</button>
          <button class="btn-icon small" data-action="addModifierCard" data-card-type="bless">+</button>
        </span>
        <span class="modifier-bc-group">
          <span class="modifier-bc-label">C:${curseCount}</span>
          <button class="btn-icon small" data-action="removeModifierCard" data-card-type="curse"
                  ${curseCount === 0 ? 'disabled' : ''}>−</button>
          <button class="btn-icon small" data-action="addModifierCard" data-card-type="curse">+</button>
        </span>
      </div>
    </div>
  </div>`;
}

// ── Element Board ────────────────────────────────────────────────────────────

function renderElements(state: GameState): string {
  const board = state.elementBoard;
  if (!board || board.length === 0) return '';

  const els = (ELEMENT_TYPES as readonly ElementType[]).map(type => {
    const el = board.find(e => e.type === type);
    const elState = el?.state ?? 'inert';
    return `<button class="element-btn state-${elState}" data-action="cycleElement" data-element="${type}" title="${type}">
      <img src="/assets/images/element/${type}.svg" alt="${type}"
           onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
      <span class="element-fallback" style="display:none">${type.charAt(0).toUpperCase()}</span>
    </button>`;
  }).join('');

  return `<div class="play-section">
    <div class="play-section-header" data-collapse="elements">
      <span class="play-section-title">Elements</span>
      <span class="play-section-toggle">▼</span>
    </div>
    <div class="play-section-content" id="playElementsContent">
      <div class="element-board">${els}</div>
    </div>
  </div>`;
}

// ── Shared render helpers ────────────────────────────────────────────────────

function renderHealthControl(
  health: number, maxHealth: number,
  targetType: string, name: string, edition: string,
  summonUuid?: string, entityNumber?: number,
): string {
  const dataAttrs = buildDataAttrs(targetType, name, edition, summonUuid, entityNumber);
  return `<div class="health-control">
    <button class="health-btn minus" data-action="changeHealth" data-delta="-1" ${dataAttrs}>−</button>
    <span class="health-value"><span class="health-current">${health}</span>/${maxHealth}</span>
    <button class="health-btn plus" data-action="changeHealth" data-delta="1" ${dataAttrs}>+</button>
  </div>`;
}

function renderConditions(
  active: ConditionName[], conditions: ConditionName[],
  targetType: string, name: string, edition: string,
  summonUuid?: string, entityNumber?: number,
): string {
  const dataAttrs = buildDataAttrs(targetType, name, edition, summonUuid, entityNumber);
  const btns = conditions.map(cond => {
    const isActive = active.includes(cond);
    const positiveCls = isPositiveCondition(cond) ? 'positive' : '';
    return `<button class="condition-btn ${isActive ? 'active' : ''} ${positiveCls}"
                    data-action="toggleCondition"
                    data-condition="${cond}"
                    ${dataAttrs}
                    title="${cond}">
      <img src="/assets/images/condition/${cond}.svg" alt="${cond}"
           onerror="this.onerror=null; this.parentElement.textContent='${cond.charAt(0).toUpperCase()}'">
    </button>`;
  }).join('');

  return `<div class="condition-grid">${btns}</div>`;
}

function buildDataAttrs(
  targetType: string, name: string, edition: string,
  summonUuid?: string, entityNumber?: number,
): string {
  let attrs = `data-target-type="${targetType}" data-target-name="${name}" data-target-edition="${edition}"`;
  if (summonUuid) attrs += ` data-summon-uuid="${summonUuid}"`;
  if (entityNumber !== undefined) attrs += ` data-entity-number="${entityNumber}"`;
  return attrs;
}

// ── FABs ─────────────────────────────────────────────────────────────────────

function updateFabs(state: GameState): void {
  const order = getInitiativeOrder(state);
  const nonAbsent = order.filter(f => !f.absent);
  const activeFigure = nonAbsent.find(f => f.active);
  const allOff = nonAbsent.length > 0 && nonAbsent.every(f => f.off);

  if (state.state === 'draw') {
    // Check if all non-absent characters have initiative set
    const activeChars = state.characters.filter(c => !c.absent);
    const allInitSet = activeChars.length > 0 && activeChars.every(c => c.initiative > 0);

    if (allInitSet) {
      fabContainer.innerHTML = `<button class="fab-btn fab-primary" id="fabAction">⚔</button>
        <span class="fab-label">Start Round</span>`;
      document.getElementById('fabAction')!.addEventListener('click', () => commands.advancePhase());
    } else {
      fabContainer.innerHTML = `<button class="fab-btn fab-disabled" disabled>⚔</button>
        <span class="fab-label">Set Initiatives...</span>`;
    }
  } else if (activeFigure) {
    // Find the next non-off, non-absent figure after the active one
    const activeIdx = nonAbsent.indexOf(activeFigure);
    const remaining = nonAbsent.filter((f, i) => i > activeIdx && !f.off);

    if (remaining.length > 0) {
      // There's a next figure — "Next Turn" activates the next figure
      // (which auto-deactivates the current in handleToggleTurn)
      const next = remaining[0];
      fabContainer.innerHTML = `<button class="fab-btn fab-primary" id="fabAction">▶</button>
        <span class="fab-label">Next Turn</span>`;
      document.getElementById('fabAction')!.addEventListener('click', () =>
        commands.toggleTurn(next.figureId));
    } else {
      // This is the last active figure — end their turn
      fabContainer.innerHTML = `<button class="fab-btn fab-primary" id="fabAction">▶</button>
        <span class="fab-label">End Turn</span>`;
      document.getElementById('fabAction')!.addEventListener('click', () =>
        commands.toggleTurn(activeFigure.figureId));
    }
  } else if (allOff) {
    // All done — next round
    fabContainer.innerHTML = `<button class="fab-btn fab-round" id="fabAction">⟳</button>
      <span class="fab-label">Next Round</span>`;
    document.getElementById('fabAction')!.addEventListener('click', () => commands.advancePhase());
  } else if (nonAbsent.length > 0) {
    // No figure active but not all off (edge case) — activate next pending
    const next = nonAbsent.find(f => !f.off);
    if (next) {
      fabContainer.innerHTML = `<button class="fab-btn fab-primary" id="fabAction">▶</button>
        <span class="fab-label">Next Turn</span>`;
      document.getElementById('fabAction')!.addEventListener('click', () =>
        commands.toggleTurn(next.figureId));
    }
  } else {
    fabContainer.innerHTML = '';
  }
}

// ── Event delegation ─────────────────────────────────────────────────────────

function attachEventListeners(): void {
  // Click delegation on tabPlay
  tabPlay.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
    if (!target) {
      // Check for section collapse
      const header = (e.target as HTMLElement).closest('.play-section-header[data-collapse]') as HTMLElement | null;
      if (header) {
        const content = header.nextElementSibling as HTMLElement;
        const toggle = header.querySelector('.play-section-toggle') as HTMLElement;
        if (content) content.classList.toggle('collapsed');
        if (toggle) toggle.classList.toggle('collapsed');
      }
      return;
    }

    const action = target.dataset.action!;

    switch (action) {
      case 'changeHealth': {
        const ct = buildTarget(target);
        if (!ct) return;
        const delta = parseInt(target.dataset.delta!, 10);
        commands.changeHealth(ct, delta);
        break;
      }
      case 'toggleCondition': {
        const ct = buildTarget(target);
        if (!ct) return;
        const condition = target.dataset.condition as ConditionName;
        commands.toggleCondition(ct, condition);
        break;
      }
      case 'cycleElement': {
        const elType = target.dataset.element as ElementType;
        const state = store.getState();
        if (!state) return;
        const current = state.elementBoard.find(e => e.type === elType);
        const newState: ElementState = (!current || current.state === 'inert') ? 'new' : 'inert';
        commands.moveElement(elType, newState);
        break;
      }
      case 'removeSummon': {
        const charName = target.dataset.targetName!;
        const charEdition = target.dataset.targetEdition!;
        const uuid = target.dataset.summonUuid!;
        commands.removeSummon(charName, charEdition, uuid);
        break;
      }
      case 'drawModifier': {
        commands.drawModifierCard('monster');
        break;
      }
      case 'shuffleModifier': {
        commands.shuffleModifierDeck('monster');
        break;
      }
      case 'addModifierCard': {
        const cardType = target.dataset.cardType as 'bless' | 'curse';
        commands.addModifierCard('monster', cardType);
        break;
      }
      case 'removeModifierCard': {
        const cardType = target.dataset.cardType as 'bless' | 'curse';
        commands.removeModifierCard('monster', cardType);
        break;
      }
      case 'toggleDead': {
        const name = target.dataset.targetName!;
        const edition = target.dataset.targetEdition!;
        const entityNum = parseInt(target.dataset.entityNumber!, 10);
        const isDead = target.dataset.entityDead === 'true';
        const health = parseInt(target.dataset.entityHealth!, 10);
        const ct: CommandTarget = { type: 'monster', name, edition, entityNumber: entityNum };
        if (isDead) {
          // Revive: heal by 1 (auto-revive in applyCommand)
          commands.changeHealth(ct, 1);
        } else {
          // Kill: damage equal to current health
          commands.changeHealth(ct, -health);
        }
        break;
      }
    }
  });

  // Initiative input change delegation
  tabPlay.addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement;
    if (input.dataset.action !== 'setInitiative') return;

    const name = input.dataset.targetName!;
    const edition = input.dataset.targetEdition!;
    const value = parseInt(input.value, 10);
    if (!isNaN(value) && value > 0) {
      commands.setInitiative(name, edition, value);
    }
  });
}

function buildTarget(el: HTMLElement): CommandTarget | null {
  const type = el.dataset.targetType;
  const name = el.dataset.targetName;
  const edition = el.dataset.targetEdition;

  if (!type || !name || !edition) return null;

  switch (type) {
    case 'character':
      return { type: 'character', name, edition };
    case 'monster': {
      const entityNum = parseInt(el.dataset.entityNumber!, 10);
      return { type: 'monster', name, edition, entityNumber: entityNum };
    }
    case 'summon': {
      const uuid = el.dataset.summonUuid!;
      return { type: 'summon', characterName: name, characterEdition: edition, summonUuid: uuid };
    }
    default:
      return null;
  }
}

// ── Utilities ────────────────────────────────────────────────────────────────
// formatName imported from ../utils.js
