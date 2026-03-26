import type { Character } from '@gloomhaven-command/shared';
import { formatName } from '../shared/formatName';
import { characterThumbnail } from '../shared/assets';

interface Props {
  characters: Character[];
  onSelect: (name: string) => void;
  onDisconnect: () => void;
}

export function CharacterPicker({ characters, onSelect, onDisconnect }: Props) {
  const available = characters.filter(c => !c.absent && !c.exhausted);

  return (
    <div class="setup-screen">
      <div class="setup-content">
        <h1 class="heading-lg" style={{ textAlign: 'center' }}>Select Your Character</h1>

        {available.length === 0 && (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
            No characters available. The GM needs to set up the scenario first.
          </p>
        )}

        <div class="character-grid">
          {available.map(c => (
            <button
              key={c.name}
              class="character-card"
              onClick={() => onSelect(c.name)}
            >
              <img
                class="character-thumb"
                src={characterThumbnail(c.edition, c.name)}
                alt={formatName(c.name)}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <span class="character-name">{formatName(c.name)}</span>
              <span class="character-level">Level {c.level}</span>
            </button>
          ))}
        </div>

        <button class="btn-text" onClick={onDisconnect}>
          Disconnect
        </button>
      </div>
    </div>
  );
}
