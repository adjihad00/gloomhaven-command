// Monster Management tab — add/remove monster groups, standees, ability cards
import { getStore, getCommands } from '../main.js';
import { formatName } from '../utils.js';
import type { StateStore, CommandSender } from '@gloomhaven-command/client-lib';
import type {
  GameState, Monster, MonsterEntity, MonsterType,
} from '@gloomhaven-command/shared';

// ── Module state ─────────────────────────────────────────────────────────────

let store: StateStore;
let commands: CommandSender;
let tabMonsters: HTMLElement;
let lastRenderedRevision = -1;
let initialized = false;

// Track selected edition for the add-monster form
let selectedEdition = 'gh';

// ── Public init ──────────────────────────────────────────────────────────────

export function initMonsterTab(): void {
  if (initialized) return;
  initialized = true;

  store = getStore();
  commands = getCommands();
  tabMonsters = document.getElementById('tabMonsters')!;

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
  const monsterGroups = state.monsters || [];

  tabMonsters.innerHTML = [
    renderAddMonster(state),
    monsterGroups.length > 0
      ? `<div class="mgmt-groups">${monsterGroups.map(m => renderMonsterGroup(m)).join('')}</div>`
      : '<div class="empty-state">No monster groups. Add one above.</div>',
  ].join('');
}

// ── Add Monster Section ──────────────────────────────────────────────────────

function renderAddMonster(state: GameState): string {
  const currentEdition = state.edition || selectedEdition || 'gh';

  return `
    <div class="mgmt-add-section">
      <h3 class="section-title heading-sm">Add Monster Group</h3>
      <div class="add-monster-row">
        <input type="text" id="monsterNameInput" class="form-input flex-grow"
               placeholder="Monster name (e.g. living-bones)">
        <input type="text" id="monsterEditionInput" class="form-input"
               placeholder="Edition" value="${currentEdition}" style="width:80px">
        <button class="btn btn-primary btn-sm" data-action="addMonsterGroup">Add</button>
      </div>
    </div>
  `;
}

// ── Monster Group Card ───────────────────────────────────────────────────────

function renderMonsterGroup(monster: Monster): string {
  const entities = [...monster.entities].sort((a, b) => a.number - b.number);
  const liveEntities = entities.filter(e => !e.dead);
  const deadEntities = entities.filter(e => e.dead);

  // Find next available standee number
  const usedNumbers = entities.map(e => e.number);
  let nextNumber = 1;
  while (usedNumbers.includes(nextNumber)) nextNumber++;

  return `
    <div class="mgmt-monster-card" data-monster-name="${monster.name}" data-monster-edition="${monster.edition}">
      <div class="mgmt-monster-header">
        <div class="mgmt-monster-info">
          <img src="/assets/images/monster/thumbnail/${monster.edition}-${monster.name}.png"
               class="mgmt-monster-icon" alt="${monster.name}"
               onerror="this.style.display='none'">
          <div>
            <span class="mgmt-monster-name">${formatName(monster.name)}</span>
            <span class="mgmt-monster-level">Lv ${monster.level}</span>
          </div>
        </div>
        <div class="mgmt-monster-actions">
          <span class="mgmt-entity-count">${liveEntities.length} active</span>
          <button class="btn-icon danger" data-action="removeMonsterGroup"
                  data-monster-name="${monster.name}" data-monster-edition="${monster.edition}"
                  title="Remove group">✕</button>
        </div>
      </div>

      <!-- Add Standee -->
      <div class="mgmt-add-standee">
        <span class="mgmt-label">Add Standee:</span>
        <input type="number" class="form-input form-input-sm standee-number-input"
               data-field="standeeNum" data-monster-name="${monster.name}"
               value="${nextNumber}" min="1" max="20" style="width:60px">
        <select class="form-input form-select form-input-sm"
                data-field="standeeType" data-monster-name="${monster.name}">
          <option value="normal">Normal</option>
          <option value="elite">Elite</option>
          <option value="boss">Boss</option>
        </select>
        <button class="btn btn-secondary btn-sm" data-action="addStandee"
                data-monster-name="${monster.name}" data-monster-edition="${monster.edition}">+</button>
      </div>

      <!-- Live Standees -->
      ${liveEntities.length > 0 ? `
        <div class="mgmt-standee-list">
          ${liveEntities.map(e => renderStandeeRow(monster, e, false)).join('')}
        </div>
      ` : '<div class="mgmt-empty">No standees</div>'}

      <!-- Dead Standees (collapsed) -->
      ${deadEntities.length > 0 ? `
        <details class="mgmt-dead-section">
          <summary class="mgmt-dead-summary">${deadEntities.length} dead</summary>
          <div class="mgmt-standee-list dead-list">
            ${deadEntities.map(e => renderStandeeRow(monster, e, true)).join('')}
          </div>
        </details>
      ` : ''}

      <!-- Ability Cards -->
      <div class="mgmt-ability-section">
        <div class="mgmt-ability-header">
          <span class="mgmt-label">Ability:</span>
          <span class="mgmt-ability-value">
            ${monster.ability !== undefined && monster.ability >= 0
              ? `Card #${monster.ability}`
              : 'Not drawn'}
          </span>
        </div>
        <div class="mgmt-ability-actions">
          <button class="btn btn-secondary btn-sm" data-action="drawAbility"
                  data-monster-name="${monster.name}" data-monster-edition="${monster.edition}">Draw</button>
          <button class="btn btn-secondary btn-sm" data-action="shuffleAbilities"
                  data-monster-name="${monster.name}" data-monster-edition="${monster.edition}">Shuffle</button>
        </div>
      </div>
    </div>
  `;
}

// ── Standee Row ──────────────────────────────────────────────────────────────

function renderStandeeRow(monster: Monster, entity: MonsterEntity, isDead: boolean): string {
  const typeBadge = entity.type === 'elite' ? 'E' : entity.type === 'boss' ? 'B' : 'N';
  const typeClass = entity.type === 'elite' ? 'elite' : entity.type === 'boss' ? 'boss' : 'normal';

  return `
    <div class="mgmt-standee-row ${typeClass} ${isDead ? 'dead' : ''}">
      <span class="mgmt-standee-number">${entity.number}</span>
      <span class="mgmt-standee-type ${typeClass}">${typeBadge}</span>
      <span class="mgmt-standee-hp">${entity.health}/${entity.maxHealth}</span>
      <button class="btn-icon small" title="Remove standee"
              data-action="removeStandee"
              data-monster-name="${monster.name}" data-monster-edition="${monster.edition}"
              data-entity-number="${entity.number}" data-entity-type="${entity.type}">✕</button>
    </div>
  `;
}

// ── Event delegation ─────────────────────────────────────────────────────────

function attachEventListeners(): void {
  tabMonsters.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
    if (!target) return;

    const action = target.dataset.action!;

    switch (action) {
      case 'addMonsterGroup': {
        const nameInput = document.getElementById('monsterNameInput') as HTMLInputElement;
        const editionInput = document.getElementById('monsterEditionInput') as HTMLInputElement;
        const name = nameInput.value.trim().toLowerCase().replace(/\s+/g, '-');
        const edition = editionInput.value.trim().toLowerCase() || 'gh';
        if (!name) return;
        selectedEdition = edition;
        commands.addMonsterGroup(name, edition);
        nameInput.value = '';
        nameInput.focus();
        break;
      }
      case 'removeMonsterGroup': {
        const name = target.dataset.monsterName!;
        const edition = target.dataset.monsterEdition!;
        commands.removeMonsterGroup(name, edition);
        break;
      }
      case 'addStandee': {
        const monsterName = target.dataset.monsterName!;
        const edition = target.dataset.monsterEdition!;
        const numInput = tabMonsters.querySelector(
          `[data-field="standeeNum"][data-monster-name="${monsterName}"]`
        ) as HTMLInputElement;
        const typeSelect = tabMonsters.querySelector(
          `[data-field="standeeType"][data-monster-name="${monsterName}"]`
        ) as HTMLSelectElement;
        const number = parseInt(numInput.value) || 1;
        const type = typeSelect.value as MonsterType;
        commands.addEntity(monsterName, edition, number, type);
        break;
      }
      case 'removeStandee': {
        const monsterName = target.dataset.monsterName!;
        const edition = target.dataset.monsterEdition!;
        const entityNumber = parseInt(target.dataset.entityNumber!, 10);
        const entityType = target.dataset.entityType as MonsterType;
        commands.removeEntity(monsterName, edition, entityNumber, entityType);
        break;
      }
      case 'drawAbility': {
        const monsterName = target.dataset.monsterName!;
        const edition = target.dataset.monsterEdition!;
        commands.drawMonsterAbility(monsterName, edition);
        break;
      }
      case 'shuffleAbilities': {
        const monsterName = target.dataset.monsterName!;
        const edition = target.dataset.monsterEdition!;
        commands.shuffleMonsterAbilities(monsterName, edition);
        break;
      }
    }
  });

  // Handle Enter key in monster name input
  tabMonsters.addEventListener('keydown', (e) => {
    const input = e.target as HTMLInputElement;
    if (input.id === 'monsterNameInput' && e.key === 'Enter') {
      const addBtn = tabMonsters.querySelector('[data-action="addMonsterGroup"]') as HTMLButtonElement;
      addBtn?.click();
    }
  });
}
