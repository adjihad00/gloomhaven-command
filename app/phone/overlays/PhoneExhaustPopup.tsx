import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';

interface PhoneExhaustPopupProps {
  characterHealth: number;
  onConfirmExhaust: () => void;
  onCancelToOneHP: () => void;
}

export function PhoneExhaustPopup({ characterHealth, onConfirmExhaust, onCancelToOneHP }: PhoneExhaustPopupProps) {
  const [show, setShow] = useState(false);
  const prevHealth = useRef(characterHealth);

  useEffect(() => {
    // Show popup when health drops to 0 (not on initial render if already 0)
    if (characterHealth === 0 && prevHealth.current > 0) {
      setShow(true);
    }
    prevHealth.current = characterHealth;
  }, [characterHealth]);

  if (!show) return null;

  const handleConfirm = () => {
    setShow(false);
    onConfirmExhaust();
  };

  const handleCancel = () => {
    setShow(false);
    onCancelToOneHP();
  };

  return (
    <div class="exhaust-popup" role="dialog" aria-modal="true">
      <div class="exhaust-popup__overlay" />
      <div class="exhaust-popup__content">
        <div class="exhaust-popup__skull" aria-hidden="true">
          <svg viewBox="0 0 64 64" width="72" height="72" fill="currentColor">
            <path d="M32 4C18.7 4 8 14.7 8 28c0 8.4 4.3 15.8 10.8 20.1V56c0 2.2 1.8 4 4 4h18.4c2.2 0 4-1.8 4-4v-7.9C51.7 43.8 56 36.4 56 28 56 14.7 45.3 4 32 4zm-6 36a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm12 0a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm-6 8c-2.2 0-4-1.3-4-3h8c0 1.7-1.8 3-4 3z" />
          </svg>
        </div>
        <h2 class="exhaust-popup__title">You Have Been Exhausted</h2>
        <p class="exhaust-popup__desc">
          Your health has reached 0. All cards go to the lost pile.
          You keep all XP and gold earned this scenario.
        </p>
        <div class="exhaust-popup__actions">
          <button
            class="exhaust-popup__btn exhaust-popup__btn--confirm"
            onClick={handleConfirm}
            aria-label="Confirm exhaustion"
          >
            Confirm Exhaust
          </button>
          <button
            class="exhaust-popup__btn exhaust-popup__btn--cancel"
            onClick={handleCancel}
            aria-label="Cancel, return to 1 HP"
          >
            Cancel (Back to 1 HP)
          </button>
        </div>
      </div>
    </div>
  );
}
