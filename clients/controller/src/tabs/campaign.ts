// Campaign tab — party overview, character roster, scenario history, game info
import { getStore, getCommands, getGameCode } from '../main.js';
import { formatName } from '../utils.js';
import type { StateStore, CommandSender } from '@gloomhaven-command/client-lib';
import type { GameState, Character, Party } from '@gloomhaven-command/shared';

// ── Module state ─────────────────────────────────────────────────────────────

let store: StateStore;
let commands: CommandSender;
let tabCampaign: HTMLElement;
let lastRenderedRevision = -1;
let initialized = false;

// ── Public init ──────────────────────────────────────────────────────────────

export function initCampaignTab(): void {
  if (initialized) return;
  initialized = true;

  store = getStore();
  commands = getCommands();
  tabCampaign = document.getElementById('tabCampaign')!;

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
  tabCampaign.innerHTML = [
    renderPartyInfo(state),
    renderCharacterRoster(state),
    renderScenarioHistory(state),
    renderUnlockedCharacters(state),
    renderGameInfo(state),
  ].join('');
}

// ── Party Info ───────────────────────────────────────────────────────────────

function renderPartyInfo(state: GameState): string {
  const party = state.party;
  if (!party || !party.name) {
    return `
      <div class="campaign-section">
        <h3 class="section-title heading-sm">Party</h3>
        <div class="empty-state">No party data. Import a GHS save or start a campaign.</div>
      </div>
    `;
  }

  const edition = state.edition || 'gh';
  const isFrosthaven = edition === 'fh';

  return `
    <div class="campaign-section">
      <h3 class="section-title heading-sm">Party</h3>
      <div class="campaign-kv-grid">
        <div class="campaign-kv">
          <span class="campaign-kv-label">Name</span>
          <span class="campaign-kv-value">${party.name}</span>
        </div>
        <div class="campaign-kv">
          <span class="campaign-kv-label">Reputation</span>
          <span class="campaign-kv-value">${party.reputation}</span>
        </div>
        ${isFrosthaven ? `
          <div class="campaign-kv">
            <span class="campaign-kv-label">Morale</span>
            <span class="campaign-kv-value">${party.morale}</span>
          </div>
        ` : `
          <div class="campaign-kv">
            <span class="campaign-kv-label">Prosperity</span>
            <span class="campaign-kv-value">${party.prosperity}</span>
          </div>
          <div class="campaign-kv">
            <span class="campaign-kv-label">Donations</span>
            <span class="campaign-kv-value">${party.donations}</span>
          </div>
        `}
      </div>
    </div>
  `;
}

// ── Character Roster ─────────────────────────────────────────────────────────

function renderCharacterRoster(state: GameState): string {
  const chars = state.characters;
  if (chars.length === 0) {
    return `
      <div class="campaign-section">
        <h3 class="section-title heading-sm">Character Roster</h3>
        <div class="empty-state">No characters in this game.</div>
      </div>
    `;
  }

  const cards = chars.map(c => renderCharacterCard(c)).join('');

  return `
    <div class="campaign-section">
      <h3 class="section-title heading-sm">Character Roster</h3>
      <div class="campaign-roster-grid">${cards}</div>
    </div>
  `;
}

function renderCharacterCard(char: Character): string {
  const xp = char.experience;
  const gold = char.loot;
  const perks = char.progress?.perks?.length ?? 0;

  return `
    <div class="campaign-char-card">
      <div class="campaign-char-header">
        <span class="campaign-char-name">${formatName(char.name)}</span>
        <span class="campaign-char-meta">${char.edition.toUpperCase()} Lv${char.level}</span>
      </div>
      <div class="campaign-char-stats">
        <div class="campaign-stat">
          <span class="campaign-stat-label">XP</span>
          <div class="campaign-stat-control">
            <button class="btn-icon small" data-action="changeXP" data-delta="-1"
                    data-char-name="${char.name}" data-char-edition="${char.edition}">−</button>
            <span class="campaign-stat-value">${xp}</span>
            <button class="btn-icon small" data-action="changeXP" data-delta="1"
                    data-char-name="${char.name}" data-char-edition="${char.edition}">+</button>
          </div>
        </div>
        <div class="campaign-stat">
          <span class="campaign-stat-label">Gold</span>
          <div class="campaign-stat-control">
            <button class="btn-icon small" data-action="changeGold" data-delta="-1"
                    data-char-name="${char.name}" data-char-edition="${char.edition}">−</button>
            <span class="campaign-stat-value">${gold}</span>
            <button class="btn-icon small" data-action="changeGold" data-delta="1"
                    data-char-name="${char.name}" data-char-edition="${char.edition}">+</button>
          </div>
        </div>
        <div class="campaign-stat">
          <span class="campaign-stat-label">Perks</span>
          <span class="campaign-stat-value">${perks}</span>
        </div>
      </div>
    </div>
  `;
}

// ── Scenario History ─────────────────────────────────────────────────────────

function renderScenarioHistory(state: GameState): string {
  const party = state.party;
  const scenarios = party?.scenarios ?? [];

  return `
    <div class="campaign-section">
      <h3 class="section-title heading-sm">Completed Scenarios</h3>
      ${scenarios.length > 0 ? `
        <div class="campaign-scenario-count">${scenarios.length} completed</div>
        <div class="campaign-scenario-list">
          ${scenarios.map(s =>
            `<span class="campaign-scenario-tag">${s.edition.toUpperCase()} #${s.index}</span>`
          ).join('')}
        </div>
      ` : '<div class="empty-state">No completed scenarios</div>'}
    </div>
  `;
}

// ── Unlocked Characters ──────────────────────────────────────────────────────

function renderUnlockedCharacters(state: GameState): string {
  const unlocked = state.unlockedCharacters ?? [];
  if (unlocked.length === 0) {
    return `
      <div class="campaign-section">
        <h3 class="section-title heading-sm">Unlocked Characters</h3>
        <div class="empty-state">No unlocked characters</div>
      </div>
    `;
  }

  return `
    <div class="campaign-section">
      <h3 class="section-title heading-sm">Unlocked Characters</h3>
      <div class="campaign-unlocked-list">
        ${unlocked.map(name => `<span class="campaign-unlocked-tag">${formatName(name)}</span>`).join('')}
      </div>
    </div>
  `;
}

// ── Game Info ─────────────────────────────────────────────────────────────────

function renderGameInfo(state: GameState): string {
  const totalSec = state.totalSeconds || 0;
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const timeStr = `${hours}h ${minutes}m`;

  return `
    <div class="campaign-section">
      <h3 class="section-title heading-sm">Game Info</h3>
      <div class="campaign-kv-grid">
        <div class="campaign-kv">
          <span class="campaign-kv-label">Game Code</span>
          <span class="campaign-kv-value">${getGameCode()}</span>
        </div>
        <div class="campaign-kv">
          <span class="campaign-kv-label">Edition</span>
          <span class="campaign-kv-value">${(state.edition || 'gh').toUpperCase()}</span>
        </div>
        <div class="campaign-kv">
          <span class="campaign-kv-label">Revision</span>
          <span class="campaign-kv-value">${state.revision}</span>
        </div>
        <div class="campaign-kv">
          <span class="campaign-kv-label">Play Time</span>
          <span class="campaign-kv-value">${timeStr}</span>
        </div>
      </div>
    </div>
  `;
}

// ── Event delegation ─────────────────────────────────────────────────────────

function attachEventListeners(): void {
  tabCampaign.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
    if (!target) return;

    const action = target.dataset.action!;
    const charName = target.dataset.charName!;
    const charEdition = target.dataset.charEdition!;
    const delta = parseInt(target.dataset.delta!, 10);

    // Find current character state to compute absolute value
    const state = store.getState();
    if (!state) return;
    const char = state.characters.find(c => c.name === charName && c.edition === charEdition);
    if (!char) return;

    switch (action) {
      case 'changeXP': {
        const newXP = Math.max(0, char.experience + delta);
        commands.setExperience(charName, charEdition, newXP);
        break;
      }
      case 'changeGold': {
        const newGold = Math.max(0, char.loot + delta);
        commands.setLoot(charName, charEdition, newGold);
        break;
      }
    }
  });
}
