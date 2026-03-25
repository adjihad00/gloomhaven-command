// Condition constants and helpers — fully implemented from GHS Condition.ts source
import type { ConditionName } from '../types/gameState.js';

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
  'strengthen', 'impair',
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
