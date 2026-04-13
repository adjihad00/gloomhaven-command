import { h } from 'preact';
import { useEditions } from '../hooks/useDataApi';

interface EditionSelectorProps {
  onSelect: (edition: string) => void;
}

const editionInfo: Record<string, { name: string; abbrev: string; color: string }> = {
  'gh': { name: 'Gloomhaven', abbrev: 'GH', color: '#c8a92c' },
  'fh': { name: 'Frosthaven', abbrev: 'FH', color: '#4a9bd9' },
  'jotl': { name: 'Jaws of the Lion', abbrev: 'JotL', color: '#d4553a' },
  'fc': { name: 'Forgotten Circles', abbrev: 'FC', color: '#9b59b6' },
  'cs': { name: 'Crimson Scales', abbrev: 'CS', color: '#c0392b' },
  'toa': { name: 'Trail of Ashes', abbrev: 'ToA', color: '#e67e22' },
};

export function EditionSelector({ onSelect }: EditionSelectorProps) {
  const { data: editions, loading } = useEditions();

  return (
    <div class="edition-selector">
      <h1 class="edition-selector__title">Gloomhaven Command</h1>
      <p class="edition-selector__subtitle">Select Edition</p>

      {loading && <p class="edition-selector__loading">Loading editions...</p>}

      <div class="edition-selector__grid">
        {(editions || []).map(ed => {
          const info = editionInfo[ed] || { name: ed, abbrev: ed.toUpperCase(), color: 'var(--accent-copper)' };
          return (
            <button
              key={ed}
              class="edition-card"
              style={{ '--edition-color': info.color } as any}
              onClick={() => {
                localStorage.setItem('gc_edition', ed);
                onSelect(ed);
              }}
              aria-label={info.name}
            >
              <span class="edition-card__abbrev">{info.abbrev}</span>
              <span class="edition-card__name">{info.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
