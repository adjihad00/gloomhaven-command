import { h } from 'preact';
import { useState } from 'preact/hooks';
import { formatName } from '../../shared/formatName';

interface InitiativeNumpadProps {
  characterName: string;
  currentInitiative: number;
  onSet: (value: number) => void;
  onLongRest: () => void;
  onClose: () => void;
}

export function InitiativeNumpad({ characterName, currentInitiative, onSet, onLongRest, onClose }: InitiativeNumpadProps) {
  const [input, setInput] = useState(
    currentInitiative > 0 ? String(currentInitiative) : ''
  );

  const handleKey = (key: string) => {
    if (key === 'back') {
      setInput(prev => prev.slice(0, -1));
    } else if (key === 'rest') {
      onLongRest();
      onClose();
    } else {
      if (input.length < 2) {
        setInput(prev => prev + key);
      }
    }
  };

  const handleSet = () => {
    const value = parseInt(input, 10);
    if (value > 0 && value <= 99) {
      onSet(value);
      onClose();
    }
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'rest', '0', 'back'];

  return (
    <div class="numpad-backdrop" onClick={onClose}>
      <div class="numpad-panel" onClick={(e) => e.stopPropagation()}>
        <div class="numpad-title">
          {formatName(characterName)}
        </div>

        <div class="numpad-display">
          <span class="numpad-value">{input || '\u2014'}</span>
        </div>

        <div class="numpad-grid">
          {keys.map(key => (
            <button
              key={key}
              class={`numpad-key ${key === 'rest' ? 'numpad-rest' : ''} ${key === 'back' ? 'numpad-back' : ''}`}
              onClick={() => handleKey(key)}
              aria-label={key === 'rest' ? 'Long Rest' : key === 'back' ? 'Backspace' : key}
            >
              {key === 'rest' ? (
                <span class="numpad-rest__content">
                  <span class="numpad-rest__icon">{'\u23F8'}</span>
                  <span class="numpad-rest__label">Rest</span>
                </span>
              ) : key === 'back' ? '\u232B' : key}
            </button>
          ))}
        </div>

        <div class="numpad-actions">
          <button class="numpad-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            class={`numpad-confirm ${input ? 'numpad-confirm--ready' : ''}`}
            onClick={handleSet}
            disabled={!input}
          >
            SET
          </button>
        </div>
      </div>
    </div>
  );
}
