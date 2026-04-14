import { h } from 'preact';
import { useState } from 'preact/hooks';
import { formatName } from '../../shared/formatName';
import { LongRestIcon } from '../../components/Icons';

interface PhoneInitiativeNumpadProps {
  characterName: string;
  currentInitiative: number;
  onSet: (value: number) => void;
  onLongRest: () => void;
  onClose: () => void;
}

export function PhoneInitiativeNumpad({
  characterName, currentInitiative, onSet, onLongRest, onClose,
}: PhoneInitiativeNumpadProps) {
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
    <div class="phone-numpad-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div class="phone-numpad" onClick={(e) => e.stopPropagation()}>
        <div class="phone-numpad__title">{formatName(characterName)}</div>

        <div class="phone-numpad__display">
          <span class="phone-numpad__value">{input || '\u2014'}</span>
        </div>

        <div class="phone-numpad__grid">
          {keys.map(key => (
            <button
              key={key}
              class={`phone-numpad__key ${key === 'rest' ? 'phone-numpad__key--rest' : ''} ${key === 'back' ? 'phone-numpad__key--back' : ''}`}
              onClick={() => handleKey(key)}
              aria-label={key === 'rest' ? 'Long Rest' : key === 'back' ? 'Backspace' : key}
            >
              {key === 'rest' ? (
                <span class="phone-numpad__rest-content">
                  <LongRestIcon size={24} class="phone-numpad__rest-icon" />
                  <span>Rest</span>
                </span>
              ) : key === 'back' ? '\u232B' : key}
            </button>
          ))}
        </div>

        <div class="phone-numpad__actions">
          <button class="phone-numpad__cancel" onClick={onClose}>Cancel</button>
          <button
            class={`phone-numpad__confirm ${input ? 'phone-numpad__confirm--ready' : ''}`}
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
