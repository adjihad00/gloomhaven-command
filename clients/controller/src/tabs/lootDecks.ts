// Loot & Decks tab — loot deck draw/assign, character AMD, ally AMD
import { getStore, getCommands } from '../main.js';
import { formatName } from '../utils.js';
import type { StateStore, CommandSender } from '@gloomhaven-command/client-lib';
import type {
  GameState, Character, LootDeck, LootCard, AttackModifierDeckModel,
} from '@gloomhaven-command/shared';

// ── Module state ─────────────────────────────────────────────────────────────

let store: StateStore;
let commands: CommandSender;
let tabLoot: HTMLElement;
let lastRenderedRevision = -1;
let initialized = false;

// ── Public init ──────────────────────────────────────────────────────────────

export function initLootDecksTab(): void {
  if (initialized) return;
  initialized = true;

  store = getStore();
  commands = getCommands();
  tabLoot = document.getElementById('tabLoot')!;

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
  tabLoot.innerHTML = [
    renderLootDeck(state),
    renderCharacterDecks(state),
    renderAllyDeck(state),
  ].join('');
}

// ── Loot Deck ────────────────────────────────────────────────────────────────

function renderLootDeck(state: GameState): string {
  const deck = state.lootDeck;
  if (!deck || !deck.cards || deck.cards.length === 0) {
    return `
      <div class="loot-section">
        <h3 class="section-title heading-sm">Loot Deck</h3>
        <div class="empty-state">No loot deck configured for this scenario</div>
      </div>
    `;
  }

  const total = deck.cards.length;
  const remaining = Math.max(0, total - deck.current);
  const drawnCards = deck.cards.slice(0, deck.current);
  const activeChars = state.characters.filter(c => !c.absent && !c.exhausted);

  let drawnHtml = '';
  if (drawnCards.length > 0) {
    drawnHtml = '<div class="loot-drawn-list">';
    drawnCards.forEach((card, i) => {
      const charOptions = activeChars.map(c =>
        `<option value="${c.name}|${c.edition}">${formatName(c.name)}</option>`
      ).join('');

      drawnHtml += `
        <div class="loot-drawn-card loot-type-${card.type}">
          <span class="loot-card-type">${formatLootType(card.type)}</span>
          <span class="loot-card-value">${card.value4P}</span>
          <select class="form-input form-select form-input-sm loot-assign-select"
                  data-card-index="${i}" style="flex:1">
            <option value="">Assign to...</option>
            ${charOptions}
          </select>
          <button class="btn btn-secondary btn-sm" data-action="assignLoot"
                  data-card-index="${i}">Assign</button>
        </div>
      `;
    });
    drawnHtml += '</div>';
  }

  return `
    <div class="loot-section">
      <h3 class="section-title heading-sm">Loot Deck</h3>
      <div class="loot-deck-status">
        <span class="loot-deck-count">${remaining} / ${total} remaining</span>
        <button class="btn btn-primary btn-sm" data-action="drawLootCard"
                ${remaining === 0 ? 'disabled' : ''}>Draw Card</button>
      </div>
      ${drawnHtml}
    </div>
  `;
}

function formatLootType(type: string): string {
  const labels: Record<string, string> = {
    money: 'Money',
    lumber: 'Lumber',
    metal: 'Metal',
    hide: 'Hide',
    arrowvine: 'Arrowvine',
    axenut: 'Axenut',
    corpsecap: 'Corpsecap',
    flamefruit: 'Flamefruit',
    rockroot: 'Rockroot',
    snowthistle: 'Snowthistle',
    random_item: 'Random Item',
    special1: 'Special 1',
    special2: 'Special 2',
  };
  return labels[type] || type;
}

// ── Character Attack Modifier Decks ──────────────────────────────────────────

function renderCharacterDecks(state: GameState): string {
  const chars = state.characters.filter(c => !c.absent);
  if (chars.length === 0) return '';

  const cards = chars.map(c => renderAMDCard(
    formatName(c.name),
    c.attackModifierDeck,
    c.name,
    c.edition,
    'character',
  )).join('');

  return `
    <div class="loot-section">
      <h3 class="section-title heading-sm">Character Attack Modifier Decks</h3>
      <div class="amd-grid">${cards}</div>
    </div>
  `;
}

// ── Ally Attack Modifier Deck ────────────────────────────────────────────────

function renderAllyDeck(state: GameState): string {
  const deck = state.allyAttackModifierDeck;
  if (!deck || !deck.cards || deck.cards.length === 0) return '';

  return `
    <div class="loot-section">
      <h3 class="section-title heading-sm">Ally Attack Modifier Deck</h3>
      <div class="amd-grid">
        ${renderAMDCard('Ally', deck, 'ally', '', 'ally')}
      </div>
    </div>
  `;
}

// ── Shared AMD card renderer ─────────────────────────────────────────────────

function renderAMDCard(
  label: string,
  deck: AttackModifierDeckModel,
  name: string,
  edition: string,
  deckType: 'character' | 'ally',
): string {
  const totalCards = deck.cards.length;
  const remaining = Math.max(0, totalCards - deck.current);
  const undrawn = deck.cards.slice(deck.current);
  const blessCount = undrawn.filter(c => c === 'bless').length;
  const curseCount = undrawn.filter(c => c === 'curse').length;

  const deckAttr = deckType === 'ally'
    ? 'data-deck-type="ally"'
    : `data-deck-type="character" data-deck-name="${name}" data-deck-edition="${edition}"`;

  return `
    <div class="amd-card">
      <div class="amd-card-header">
        <span class="amd-card-name">${label}</span>
        <span class="amd-card-count">${remaining}/${totalCards}</span>
      </div>
      <div class="amd-card-actions">
        <button class="btn btn-secondary btn-sm" data-action="drawAMD" ${deckAttr}>Draw</button>
        <button class="btn btn-secondary btn-sm" data-action="shuffleAMD" ${deckAttr}>Shuffle</button>
      </div>
      <div class="amd-card-modifiers">
        <span class="modifier-bc-group">
          <span class="modifier-bc-label">B:${blessCount}</span>
          <button class="btn-icon small" data-action="removeAMDCard" data-card-type="bless"
                  ${deckAttr} ${blessCount === 0 ? 'disabled' : ''}>−</button>
          <button class="btn-icon small" data-action="addAMDCard" data-card-type="bless" ${deckAttr}>+</button>
        </span>
        <span class="modifier-bc-group">
          <span class="modifier-bc-label">C:${curseCount}</span>
          <button class="btn-icon small" data-action="removeAMDCard" data-card-type="curse"
                  ${deckAttr} ${curseCount === 0 ? 'disabled' : ''}>−</button>
          <button class="btn-icon small" data-action="addAMDCard" data-card-type="curse" ${deckAttr}>+</button>
        </span>
      </div>
    </div>
  `;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getDeckId(el: HTMLElement): 'monster' | 'ally' | { character: string; edition: string } {
  const type = el.dataset.deckType;
  if (type === 'ally') return 'ally';
  return { character: el.dataset.deckName!, edition: el.dataset.deckEdition! };
}

// ── Event delegation ─────────────────────────────────────────────────────────

function attachEventListeners(): void {
  tabLoot.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
    if (!target) return;

    const action = target.dataset.action!;

    switch (action) {
      case 'drawLootCard': {
        commands.drawLootCard();
        break;
      }
      case 'assignLoot': {
        const cardIndex = parseInt(target.dataset.cardIndex!, 10);
        const select = tabLoot.querySelector(
          `.loot-assign-select[data-card-index="${cardIndex}"]`
        ) as HTMLSelectElement;
        if (!select || !select.value) return;
        const [charName, charEdition] = select.value.split('|');
        commands.assignLoot(cardIndex, charName, charEdition);
        break;
      }
      case 'drawAMD': {
        const deck = getDeckId(target);
        commands.drawModifierCard(deck);
        break;
      }
      case 'shuffleAMD': {
        const deck = getDeckId(target);
        commands.shuffleModifierDeck(deck);
        break;
      }
      case 'addAMDCard': {
        const deck = getDeckId(target);
        const cardType = target.dataset.cardType as 'bless' | 'curse';
        commands.addModifierCard(deck, cardType);
        break;
      }
      case 'removeAMDCard': {
        const deck = getDeckId(target);
        const cardType = target.dataset.cardType as 'bless' | 'curse';
        commands.removeModifierCard(deck, cardType);
        break;
      }
    }
  });
}
