// TODO: Condition name lists, toggle helpers, expiry logic

export const CONDITIONS = [
  'poison', 'wound', 'immobilize', 'disarm', 'stun',
  'muddle', 'curse', 'bless', 'strengthen', 'invisible',
  'regenerate', 'ward', 'impair', 'bane', 'brittle',
  'infect', 'rupture', 'chill',
] as const;

export type ConditionName = typeof CONDITIONS[number];

export function isValidCondition(name: string): name is ConditionName {
  return (CONDITIONS as readonly string[]).includes(name);
}
