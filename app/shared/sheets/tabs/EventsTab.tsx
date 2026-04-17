import { h } from 'preact';
import { useContext, useState } from 'preact/hooks';
import type { Party } from '@gloomhaven-command/shared';
import { PartySheetContext } from '../PartySheetContext';

interface EventsTabProps {
  party: Party;
}

/**
 * Phase T0b: Events tab.
 *
 * T0b scope: render `party.eventCards` as a read-only list (all treated
 * as "active" until T6 introduces resolve/draw lifecycle state). No event
 * card images in the asset manifest yet — text-only cards with gilt
 * borders. Missing-image asset requests logged to `docs/ASSET_REQUESTS.md`.
 */
export function EventsTab({ party }: EventsTabProps) {
  const { autoCycle } = useContext(PartySheetContext);
  const [expanded, setExpanded] = useState<string | null>(null);
  const cards = party.eventCards ?? [];

  if (cards.length === 0) {
    return (
      <div class="events-tab events-tab--empty">
        <div class="events-tab__empty-sigil" aria-hidden="true">
          <svg viewBox="0 0 60 80" preserveAspectRatio="xMidYMid meet">
            <rect
              x="4" y="4" width="52" height="72"
              rx="3"
              fill="var(--parchment-aged)"
              stroke="var(--gilt-gold)"
              stroke-width="1.5"
              opacity="0.7"
            />
            <rect x="16" y="22" width="28" height="2" fill="var(--gilt-gold)" opacity="0.5" />
            <rect x="14" y="32" width="32" height="1" fill="var(--parchment-ink-dim)" opacity="0.4" />
            <rect x="14" y="38" width="30" height="1" fill="var(--parchment-ink-dim)" opacity="0.4" />
            <rect x="14" y="44" width="32" height="1" fill="var(--parchment-ink-dim)" opacity="0.4" />
          </svg>
        </div>
        <p class="events-tab__empty-text">No events drawn yet.</p>
        <p class="events-tab__empty-hint">
          Events appear here as your campaign unfolds.
        </p>
      </div>
    );
  }

  return (
    <div class="events-tab">
      <section class="events-tab__section">
        <h2 class="events-tab__section-title">Active Events</h2>
        <ul class="events-tab__list">
          {cards.map((card) => {
            const key = `${card.edition}-${card.type}-${card.cardId}`;
            const isOpen = expanded === key;
            return (
              <li key={key} class="events-tab__card">
                <button
                  type="button"
                  class="events-tab__card-head"
                  aria-expanded={isOpen}
                  onClick={() => !autoCycle && setExpanded(isOpen ? null : key)}
                  disabled={autoCycle}
                >
                  <span class="events-tab__card-type">
                    {card.type.toUpperCase()}
                  </span>
                  <span class="events-tab__card-id">#{card.cardId}</span>
                  <span class="events-tab__card-edition">
                    {card.edition.toUpperCase()}
                  </span>
                  {card.attack && (
                    <span class="events-tab__card-attack" aria-label="Attack event">
                      ⚔
                    </span>
                  )}
                </button>
                {isOpen && (
                  <div class="events-tab__card-body">
                    <p class="events-tab__card-note">
                      Narrative preview arrives in T6 when event lifecycle state
                      lands. This card is part of the active campaign deck.
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
