import { h } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import type { Party } from '@gloomhaven-command/shared';
import { WaxSealHeader } from '../WaxSealHeader';

interface UnlocksTabProps {
  party: Party;
}

const CHEST_ICON = (
  <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
    <path
      d="M3 8 H17 V16 H3 Z"
      fill="none"
      stroke="currentColor"
      stroke-width="1.4"
      stroke-linejoin="round"
    />
    <path
      d="M3 8 C3 5.5 5 4 10 4 C15 4 17 5.5 17 8"
      fill="none"
      stroke="currentColor"
      stroke-width="1.4"
      stroke-linejoin="round"
    />
    <rect x="9" y="9" width="2" height="4" fill="currentColor" />
    <path d="M3 11 H17" stroke="currentColor" stroke-width="0.8" />
  </svg>
);

/**
 * Phase T0c: Unlocks tab.
 *
 * Three collapsible sections — items, characters, treasures — all read-only.
 * Unlocks happen via gameplay events; in-sheet unlock is out of scope.
 */
export function UnlocksTab({ party }: UnlocksTabProps) {
  const [query, setQuery] = useState('');

  const items = party.unlockedItems ?? [];
  const characters = party.unlockedCharacters ?? [];
  const treasures = party.treasures ?? [];

  const q = query.trim().toLowerCase();
  const filteredItems = useMemo(
    () => (q ? items.filter((it) => it.name.toLowerCase().includes(q) || it.edition.toLowerCase().includes(q)) : items),
    [items, q],
  );
  const filteredCharacters = useMemo(
    () => (q ? characters.filter((c) => c.toLowerCase().includes(q)) : characters),
    [characters, q],
  );
  const filteredTreasures = useMemo(
    () => (q ? treasures.filter((t) => t.name.toLowerCase().includes(q) || t.edition.toLowerCase().includes(q)) : treasures),
    [treasures, q],
  );

  return (
    <div class="unlocks-tab">
      <WaxSealHeader title="Unlocks" icon={CHEST_ICON} />

      <div class="unlocks-tab__search">
        <input
          class="unlocks-tab__search-input"
          type="search"
          placeholder="Search unlocks…"
          value={query}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
          aria-label="Filter unlocks"
        />
      </div>

      <Section
        title="Items"
        count={items.length}
        filteredCount={filteredItems.length}
        emptyText="No items unlocked yet."
      >
        {filteredItems.length > 0 && (
          <ul class="unlocks-tab__list">
            {filteredItems.map((it, i) => (
              <li key={`${it.edition}-${it.name}-${i}`} class="unlocks-tab__row">
                <span class="unlocks-tab__row-name">{it.name}</span>
                <span class="unlocks-tab__edition-chip">{it.edition.toUpperCase()}</span>
                {it.count > 1 && (
                  <span class="unlocks-tab__count-pill">×{it.count}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Characters"
        count={characters.length}
        filteredCount={filteredCharacters.length}
        emptyText="No characters unlocked yet."
      >
        {filteredCharacters.length > 0 && (
          <ul class="unlocks-tab__list">
            {filteredCharacters.map((name) => (
              <li key={name} class="unlocks-tab__row">
                <span class="unlocks-tab__row-name">{name}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Treasures"
        count={treasures.length}
        filteredCount={filteredTreasures.length}
        emptyText="No treasures unlocked yet."
      >
        {filteredTreasures.length > 0 && (
          <ul class="unlocks-tab__list">
            {filteredTreasures.map((t, i) => (
              <li key={`${t.edition}-${t.name}-${i}`} class="unlocks-tab__row">
                <span class="unlocks-tab__row-name">{t.name}</span>
                <span class="unlocks-tab__edition-chip">{t.edition.toUpperCase()}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

interface SectionProps {
  title: string;
  count: number;
  filteredCount: number;
  emptyText: string;
  children?: preact.ComponentChildren;
}

function Section({ title, count, filteredCount, emptyText, children }: SectionProps) {
  const [open, setOpen] = useState(true);
  return (
    <section class="unlocks-tab__section">
      <button
        type="button"
        class="unlocks-tab__section-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span class="unlocks-tab__chevron" aria-hidden="true">
          {open ? '▾' : '▸'}
        </span>
        <span class="unlocks-tab__section-title">{title}</span>
        <span class="unlocks-tab__section-count">
          {filteredCount === count ? count : `${filteredCount} / ${count}`}
        </span>
      </button>
      {open && (
        <div class="unlocks-tab__section-body">
          {count === 0 ? (
            <p class="unlocks-tab__empty">{emptyText}</p>
          ) : filteredCount === 0 ? (
            <p class="unlocks-tab__empty">No matches.</p>
          ) : (
            children
          )}
        </div>
      )}
    </section>
  );
}
