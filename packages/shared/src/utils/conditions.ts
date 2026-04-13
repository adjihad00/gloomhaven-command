// Condition constants and helpers — fully implemented from GHS Condition.ts source
import type { ConditionName, EntityCondition } from '../types/gameState.js';

/** All condition names from GHS ConditionName enum */
export const ALL_CONDITIONS: readonly ConditionName[] = [
  'stun', 'immobilize', 'disarm', 'wound', 'muddle',
  'poison', 'strengthen', 'invisible', 'curse', 'bless',
  'regenerate', 'ward', 'bane', 'brittle', 'impair',
  'chill', 'infect', 'rupture', 'dodge', 'empower',
  'enfeeble', 'poison_x', 'wound_x', 'heal', 'shield',
  'retaliate', 'safeguard', 'plague', 'invalid',
] as const;

/** Conditions that are beneficial to the entity */
export const POSITIVE_CONDITIONS: readonly ConditionName[] = [
  'strengthen', 'invisible', 'regenerate', 'ward', 'bless',
  'dodge', 'safeguard', 'heal', 'shield', 'retaliate',
] as const;

/** Conditions that are harmful to the entity */
export const NEGATIVE_CONDITIONS: readonly ConditionName[] = [
  'stun', 'immobilize', 'disarm', 'wound', 'muddle',
  'poison', 'curse', 'bane', 'brittle', 'impair',
  'chill', 'infect', 'rupture', 'empower', 'enfeeble',
  'poison_x', 'wound_x',
] as const;

/** Conditions that expire at the end of the entity's next turn */
export const EXPIRE_CONDITIONS: readonly ConditionName[] = [
  'stun', 'immobilize', 'disarm', 'muddle', 'invisible',
  'strengthen', 'impair', 'bane', 'brittle', 'infect',
  'regenerate', 'ward', 'dodge', 'empower', 'enfeeble', 'safeguard',
] as const;

/** Conditions cleared by heal */
export const CLEAR_HEAL_CONDITIONS: readonly ConditionName[] = [
  'wound', 'wound_x', 'poison', 'poison_x', 'bane',
  'brittle', 'infect', 'rupture',
] as const;

/** Conditions that prevent healing */
export const PREVENT_HEAL_CONDITIONS: readonly ConditionName[] = [
  'poison', 'poison_x', 'infect',
] as const;

/** Conditions that can be stacked (multiple instances) */
export const STACKABLE_CONDITIONS: readonly ConditionName[] = [
  'chill', 'plague', 'bless', 'curse', 'enfeeble', 'empower',
] as const;

/** Conditions that apply to the attack modifier deck rather than the entity */
export const AM_DECK_CONDITIONS: readonly ConditionName[] = [
  'bless', 'curse', 'empower', 'enfeeble',
] as const;

/** Conditions that can apply to characters but not monsters */
export const CHARACTER_ONLY_CONDITIONS: readonly ConditionName[] = [
  'impair', 'dodge',
] as const;

/** Conditions that can apply to monsters but not characters */
export const MONSTER_ONLY_CONDITIONS: readonly ConditionName[] = [
  'plague',
] as const;

/** Gloomhaven conditions (10) */
export const GH_CONDITIONS: readonly ConditionName[] = [
  'stun', 'immobilize', 'disarm', 'wound', 'muddle',
  'poison', 'strengthen', 'invisible', 'curse', 'bless',
] as const;

/** Frosthaven conditions (16) */
export const FH_CONDITIONS: readonly ConditionName[] = [
  'stun', 'immobilize', 'disarm', 'wound', 'muddle',
  'poison', 'strengthen', 'invisible', 'curse', 'bless',
  'regenerate', 'ward', 'bane', 'brittle', 'impair', 'infect',
] as const;

/** Get conditions for an edition */
export function getConditionsForEdition(edition: string): readonly ConditionName[] {
  switch (edition) {
    case 'fh': return FH_CONDITIONS;
    case 'gh':
    case 'jotl':
    default: return GH_CONDITIONS;
  }
}

export function isNegativeCondition(name: ConditionName): boolean {
  return (NEGATIVE_CONDITIONS as readonly string[]).includes(name);
}

export function isPositiveCondition(name: ConditionName): boolean {
  return (POSITIVE_CONDITIONS as readonly string[]).includes(name);
}

export function isValidCondition(name: string): name is ConditionName {
  return (ALL_CONDITIONS as readonly string[]).includes(name);
}

export function isExpireCondition(name: ConditionName): boolean {
  return (EXPIRE_CONDITIONS as readonly string[]).includes(name);
}

export function isClearHealCondition(name: ConditionName): boolean {
  return (CLEAR_HEAL_CONDITIONS as readonly string[]).includes(name);
}

export function isStackableCondition(name: ConditionName): boolean {
  return (STACKABLE_CONDITIONS as readonly string[]).includes(name);
}

// ── End-of-round / end-of-turn condition processing ────────────────────────

/**
 * Process conditions at end of round. Returns a new array (no mutation).
 * - state 'new' → 'normal' (survives first round)
 * - expired === true → removed from array
 * - state 'expire' → removed from array
 */
export function processConditionEndOfRound(conditions: EntityCondition[]): EntityCondition[] {
  return conditions
    .filter((c) => !c.expired && c.state !== 'expire')
    .map((c) => {
      if (c.state === 'new') {
        return { ...c, state: 'normal' as const };
      }
      return { ...c };
    });
}

/**
 * Process conditions at end of a figure's turn.
 * - state 'normal' → 'expire' for expire-type conditions (they lasted through the figure's next turn)
 * - state 'turn' → 'normal'
 * - Bane damage (10) returned when bane expires
 * Returns { conditions, baneDamage } so the caller can apply HP loss.
 */
export function processConditionEndOfTurn(
  conditions: EntityCondition[],
): { conditions: EntityCondition[]; baneDamage: number } {
  let baneDamage = 0;

  const updated = conditions
    .filter((c) => {
      // Remove fully expired conditions
      if (c.state === 'expire' || c.state === 'removed') return false;
      if (c.expired) return false;
      return true;
    })
    .map((c) => {
      if (c.state === 'turn') {
        return { ...c, state: 'normal' as const };
      }
      if (c.state === 'normal' && isExpireCondition(c.name)) {
        // Condition has been active for a full turn — mark for expiry
        // Bane deals 10 damage when it expires
        if (c.name === 'bane') {
          baneDamage = 10;
        }
        return { ...c, state: 'expire' as const };
      }
      return { ...c };
    });

  return { conditions: updated, baneDamage };
}

/**
 * Toggle a condition on an entity. Returns a new array (no mutation).
 * If condition exists (active, not expired): remove it.
 * If condition does not exist: add with state 'new' so it survives first round.
 */
export function toggleCondition(
  conditions: EntityCondition[],
  conditionName: ConditionName,
  value?: number,
): EntityCondition[] {
  const existing = conditions.find(
    (c) => c.name === conditionName && !c.expired && c.state !== 'removed',
  );

  if (existing) {
    return conditions.filter((c) => c !== existing);
  }

  return [
    ...conditions,
    {
      name: conditionName,
      value: value ?? 1,
      state: 'new',
      lastState: 'new',
      permanent: false,
      expired: false,
      highlight: false,
    },
  ];
}
