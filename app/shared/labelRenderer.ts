/**
 * Label text interpolation — replaces GHS placeholder patterns with inline icons.
 *
 * GHS labels use patterns like:
 *   %game.action.move%     → action icon
 *   %game.action.range:4%  → action icon + value
 *   %game.condition.wound% → condition icon
 *   %game.element.fire%    → element icon
 *   %game.mapMarker.b%     → bold marker text
 *   %data.scenario.rules.X% → stripped (internal reference)
 *   %data.section:X%       → stripped (internal reference)
 */

import { actionIcon, conditionIcon, elementIcon } from './assets';

/** Replace %game.*% and %data.*% placeholders in label text with HTML */
export function interpolateLabelIcons(text: string): string {
  return text.replace(/%([^%]+)%/g, (_match, inner: string) => {
    // %data.*% — internal references, strip entirely
    if (inner.startsWith('data.')) {
      return '';
    }

    // %game.action.X% or %game.action.X:value%
    if (inner.startsWith('game.action.')) {
      const actionPart = inner.slice('game.action.'.length);
      const colonIdx = actionPart.indexOf(':');
      if (colonIdx >= 0) {
        const name = actionPart.slice(0, colonIdx);
        const value = actionPart.slice(colonIdx + 1);
        return `<img src="${actionIcon(name)}" class="label-icon" alt="${name}" aria-hidden="true" />${value}`;
      }
      // Check for custom/ prefixed actions (e.g., custom.fh-algox)
      return `<img src="${actionIcon(actionPart)}" class="label-icon" alt="${actionPart}" aria-hidden="true" />`;
    }

    // %game.condition.X%
    if (inner.startsWith('game.condition.')) {
      const name = inner.slice('game.condition.'.length);
      return `<img src="${conditionIcon(name)}" class="label-icon label-icon--condition" alt="${name}" aria-hidden="true" />`;
    }

    // %game.element.X%
    if (inner.startsWith('game.element.')) {
      const name = inner.slice('game.element.'.length);
      return `<img src="${elementIcon(name)}" class="label-icon label-icon--element" alt="${name}" aria-hidden="true" />`;
    }

    // %game.mapMarker.X%
    if (inner.startsWith('game.mapMarker.')) {
      const marker = inner.slice('game.mapMarker.'.length).toUpperCase();
      return `<strong>(${marker})</strong>`;
    }

    // %game.resource.X%
    if (inner.startsWith('game.resource.')) {
      const name = inner.slice('game.resource.'.length);
      return `<strong>${name}</strong>`;
    }

    // Unknown pattern — return as-is without percent signs
    return inner;
  });
}
