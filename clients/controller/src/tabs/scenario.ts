// Scenario tab — scenario setup, character management, level, elements, rooms
import { getStore, getCommands, getGameCode } from '../main.js';
import { formatName } from '../utils.js';
import type { StateStore, CommandSender } from '@gloomhaven-command/client-lib';
import type {
  GameState, Character, ElementModel, ElementType, ElementState,
} from '@gloomhaven-command/shared';
import { ELEMENT_TYPES } from '@gloomhaven-command/shared';

// ── Module state ─────────────────────────────────────────────────────────────

let store: StateStore;
let commands: CommandSender;
let tabScenario: HTMLElement;
let lastRenderedRevision = -1;
let initialized = false;

// Track form defaults
let selectedEdition = 'gh';

// Element cycle order: inert → new → strong → waning → inert
const ELEMENT_CYCLE: Record<string, ElementState> = {
  inert: 'new',
  new: 'strong',
  strong: 'waning',
  waning: 'inert',
  consumed: 'new',
  partlyConsumed: 'new',
  always: 'inert',
};

// ── Public init ──────────────────────────────────────────────────────────────

export function initScenarioTab(): void {
  if (initialized) return;
  initialized = true;

  store = getStore();
  commands = getCommands();
  tabScenario = document.getElementById('tabScenario')!;

  attachEventListeners();

  store.subscribe((state) => {
    if (state.revision === lastRenderedRevision) return;
    lastRenderedRevision = state.revision;
    render(state);
  });

  const state = store.getState();
  if (state) {
    lastRenderedRevision = state.revision;
    render(state);
  }
}

// ── Main render ──────────────────────────────────────────────────────────────

function render(state: GameState): void {
  tabScenario.innerHTML = [
    renderScenarioHeader(state),
    renderScenarioSetup(state),
    renderCharacterManagement(state),
    renderLevelSettings(state),
    renderElementBoard(state),
    renderRevealedRooms(state),
  ].join('');
}

// ── Scenario Header ──────────────────────────────────────────────────────────

function renderScenarioHeader(state: GameState): string {
  const scenario = state.scenario;
  const scenarioName = scenario
    ? `Scenario ${scenario.index}`
    : 'No Scenario';
  const editionBadge = scenario
    ? `<span class="scenario-edition-badge">${scenario.edition.toUpperCase()}</span>`
    : '';

  return `
    <div class="scenario-header">
      <div class="scenario-header-info">
        <span class="scenario-header-name">${scenarioName}</span>
        ${editionBadge}
      </div>
      <div class="scenario-header-level">Level ${state.level}</div>
    </div>
  `;
}

// ── Scenario Setup ───────────────────────────────────────────────────────────

function renderScenarioSetup(state: GameState): string {
  const currentEdition = state.edition || selectedEdition || 'gh';

  return `
    <div class="scenario-section">
      <h3 class="section-title heading-sm">Set Scenario</h3>
      <div class="scenario-setup-row">
        <input type="text" id="scenarioIndexInput" class="form-input"
               placeholder="Scenario # (e.g. 1, 51, FC-1)" style="flex:1">
        <select id="scenarioEditionInput" class="form-input form-select" style="width:80px">
          <option value="gh" ${currentEdition === 'gh' ? 'selected' : ''}>GH</option>
          <option value="fh" ${currentEdition === 'fh' ? 'selected' : ''}>FH</option>
          <option value="jotl" ${currentEdition === 'jotl' ? 'selected' : ''}>JotL</option>
          <option value="fc" ${currentEdition === 'fc' ? 'selected' : ''}>FC</option>
          <option value="cs" ${currentEdition === 'cs' ? 'selected' : ''}>CS</option>
        </select>
        <button class="btn btn-primary btn-sm" data-action="setScenario">Set</button>
      </div>
    </div>
  `;
}

// ── Character Management ─────────────────────────────────────────────────────

function renderCharacterManagement(state: GameState): string {
  const chars = state.characters;
  const currentEdition = state.edition || selectedEdition || 'gh';

  let html = `
    <div class="scenario-section">
      <h3 class="section-title heading-sm">Characters</h3>
      <div class="scenario-add-char-row">
        <input type="text" id="charNameInput" class="form-input flex-grow"
               placeholder="Character name (e.g. brute)">
        <select id="charEditionInput" class="form-input form-select" style="width:80px">
          <option value="gh" ${currentEdition === 'gh' ? 'selected' : ''}>GH</option>
          <option value="fh" ${currentEdition === 'fh' ? 'selected' : ''}>FH</option>
          <option value="jotl" ${currentEdition === 'jotl' ? 'selected' : ''}>JotL</option>
          <option value="fc" ${currentEdition === 'fc' ? 'selected' : ''}>FC</option>
          <option value="cs" ${currentEdition === 'cs' ? 'selected' : ''}>CS</option>
        </select>
        <input type="number" id="charLevelInput" class="form-input form-input-sm"
               value="1" min="1" max="9" style="width:50px">
        <button class="btn btn-primary btn-sm" data-action="addCharacter">Add</button>
      </div>
  `;

  if (chars.length === 0) {
    html += '<div class="empty-state">No characters. Add one above.</div>';
  } else {
    html += '<div class="scenario-char-list">';
    for (const char of chars) {
      const absentCls = char.absent ? 'active' : '';
      const exhaustedCls = char.exhausted ? 'active' : '';
      const longRestCls = char.longRest ? 'active' : '';

      html += `
        <div class="scenario-char-row">
          <div class="scenario-char-info">
            <span class="scenario-char-name">${formatName(char.name)}</span>
            <span class="scenario-char-meta">${char.edition.toUpperCase()} Lv${char.level}</span>
            ${char.absent ? '<span class="status-badge badge-absent">Absent</span>' : ''}
            ${char.exhausted ? '<span class="status-badge badge-exhausted">Exhausted</span>' : ''}
            ${char.longRest ? '<span class="status-badge badge-longrest">Long Rest</span>' : ''}
          </div>
          <div class="scenario-char-actions">
            <button class="btn-icon small ${absentCls}" data-action="toggleAbsent"
                    data-char-name="${char.name}" data-char-edition="${char.edition}"
                    title="Toggle Absent">A</button>
            <button class="btn-icon small ${exhaustedCls}" data-action="toggleExhausted"
                    data-char-name="${char.name}" data-char-edition="${char.edition}"
                    title="Toggle Exhausted">E</button>
            <button class="btn-icon small danger" data-action="removeCharacter"
                    data-char-name="${char.name}" data-char-edition="${char.edition}"
                    title="Remove">✕</button>
          </div>
        </div>
      `;
    }
    html += '</div>';
  }

  html += '</div>';
  return html;
}

// ── Level & Round Settings ───────────────────────────────────────────────────

function renderLevelSettings(state: GameState): string {
  const levels = [0, 1, 2, 3, 4, 5, 6, 7];
  const levelBtns = levels.map(l =>
    `<button class="level-btn ${l === state.level ? 'active' : ''}"
             data-action="setLevel" data-level="${l}">${l}</button>`
  ).join('');

  return `
    <div class="scenario-section">
      <h3 class="section-title heading-sm">Level & Round</h3>
      <div class="scenario-settings-row">
        <div class="scenario-setting">
          <span class="scenario-setting-label">Scenario Level</span>
          <div class="level-selector">${levelBtns}</div>
        </div>
        <div class="scenario-setting">
          <span class="scenario-setting-label">Round</span>
          <div class="round-display">
            <button class="btn-icon small" data-action="setRound" data-delta="-1"
                    ${state.round <= 0 ? 'disabled' : ''}>−</button>
            <span class="round-value">${state.round}</span>
            <button class="btn-icon small" data-action="setRound" data-delta="1">+</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ── Element Board (full control) ─────────────────────────────────────────────

function renderElementBoard(state: GameState): string {
  const board = state.elementBoard;
  if (!board || board.length === 0) return '';

  const els = (ELEMENT_TYPES as readonly ElementType[]).map(type => {
    const el = board.find(e => e.type === type);
    const elState = el?.state ?? 'inert';
    const stateLabel = elState === 'inert' ? '' : elState;

    return `<div class="scenario-element">
      <button class="element-btn element-btn-lg state-${elState}"
              data-action="cycleElement" data-element="${type}" title="${type}: ${elState}">
        <img src="/assets/images/element/${type}.svg" alt="${type}"
             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
        <span class="element-fallback" style="display:none">${type.charAt(0).toUpperCase()}</span>
      </button>
      <span class="scenario-element-label">${type}</span>
      ${stateLabel ? `<span class="scenario-element-state">${stateLabel}</span>` : ''}
    </div>`;
  }).join('');

  return `
    <div class="scenario-section">
      <h3 class="section-title heading-sm">Elements</h3>
      <div class="scenario-element-board">${els}</div>
    </div>
  `;
}

// ── Revealed Rooms ───────────────────────────────────────────────────────────

function renderRevealedRooms(state: GameState): string {
  const rooms = state.scenario?.revealedRooms ?? [];

  return `
    <div class="scenario-section">
      <h3 class="section-title heading-sm">Rooms</h3>
      <div class="scenario-room-row">
        <input type="number" id="roomIdInput" class="form-input form-input-sm"
               placeholder="Room #" min="0" style="width:80px">
        <button class="btn btn-secondary btn-sm" data-action="revealRoom">Reveal Room</button>
      </div>
      ${rooms.length > 0
        ? `<div class="scenario-room-list">
            ${rooms.map(r => `<span class="scenario-room-tag">Room ${r}</span>`).join('')}
           </div>`
        : '<div class="empty-state" style="margin-top:8px">No rooms revealed</div>'
      }
    </div>
  `;
}

// ── Event delegation ─────────────────────────────────────────────────────────

function attachEventListeners(): void {
  tabScenario.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
    if (!target) return;

    const action = target.dataset.action!;

    switch (action) {
      case 'setScenario': {
        const indexInput = document.getElementById('scenarioIndexInput') as HTMLInputElement;
        const editionInput = document.getElementById('scenarioEditionInput') as HTMLSelectElement;
        const idx = indexInput.value.trim();
        if (!idx) return;
        const edition = editionInput.value;
        selectedEdition = edition;
        commands.setScenario(idx, edition);
        indexInput.value = '';
        break;
      }
      case 'addCharacter': {
        const nameInput = document.getElementById('charNameInput') as HTMLInputElement;
        const editionInput = document.getElementById('charEditionInput') as HTMLSelectElement;
        const levelInput = document.getElementById('charLevelInput') as HTMLInputElement;
        const name = nameInput.value.trim().toLowerCase().replace(/\s+/g, '-');
        if (!name) return;
        const edition = editionInput.value;
        const level = parseInt(levelInput.value) || 1;
        commands.addCharacter(name, edition, level);
        nameInput.value = '';
        nameInput.focus();
        break;
      }
      case 'toggleAbsent': {
        const name = target.dataset.charName!;
        const edition = target.dataset.charEdition!;
        commands.toggleAbsent(name, edition);
        break;
      }
      case 'toggleExhausted': {
        const name = target.dataset.charName!;
        const edition = target.dataset.charEdition!;
        commands.toggleExhausted(name, edition);
        break;
      }
      case 'removeCharacter': {
        const name = target.dataset.charName!;
        const edition = target.dataset.charEdition!;
        commands.removeCharacter(name, edition);
        break;
      }
      case 'setLevel': {
        const level = parseInt(target.dataset.level!, 10);
        commands.setLevel(level);
        break;
      }
      case 'setRound': {
        const delta = parseInt(target.dataset.delta!, 10);
        const state = store.getState();
        if (!state) return;
        const newRound = Math.max(0, state.round + delta);
        commands.setRound(newRound);
        break;
      }
      case 'cycleElement': {
        const elType = target.dataset.element as ElementType;
        const state = store.getState();
        if (!state) return;
        const current = state.elementBoard.find(e => e.type === elType);
        const currentState = current?.state ?? 'inert';
        const newState = ELEMENT_CYCLE[currentState] ?? 'inert';
        commands.moveElement(elType, newState);
        break;
      }
      case 'revealRoom': {
        const roomInput = document.getElementById('roomIdInput') as HTMLInputElement;
        const roomId = parseInt(roomInput.value, 10);
        if (isNaN(roomId)) return;
        commands.revealRoom(roomId);
        roomInput.value = '';
        break;
      }
    }
  });

  // Enter key in inputs
  tabScenario.addEventListener('keydown', (e) => {
    const input = e.target as HTMLInputElement;
    if (input.id === 'charNameInput' && e.key === 'Enter') {
      const addBtn = tabScenario.querySelector('[data-action="addCharacter"]') as HTMLButtonElement;
      addBtn?.click();
    } else if (input.id === 'scenarioIndexInput' && e.key === 'Enter') {
      const setBtn = tabScenario.querySelector('[data-action="setScenario"]') as HTMLButtonElement;
      setBtn?.click();
    } else if (input.id === 'roomIdInput' && e.key === 'Enter') {
      const revealBtn = tabScenario.querySelector('[data-action="revealRoom"]') as HTMLButtonElement;
      revealBtn?.click();
    }
  });
}
