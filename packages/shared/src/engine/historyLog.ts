import type { Character, HistoryEntry } from '../types/gameState.js';

/**
 * Distributive Omit — preserves the discriminated union shape when stripping
 * meta fields. Standard `Omit<A | B, K>` collapses to the intersection of
 * common keys; this variant applies `Omit` to each member separately so
 * variant-specific fields (e.g. `battleGoalChecks` on `scenarioCompleted`)
 * remain on their own branches.
 */
type OmitMeta<T> = T extends unknown ? Omit<T, 'id' | 'sequence'> : never;

/**
 * Phase T0d: append a history entry to a character's progress log.
 *
 * Single source of history mutation. Called from command handlers at
 * meaningful trigger sites (scenario complete, level up, retirement, etc.).
 *
 * - Ensures the `history` array exists.
 * - Assigns a monotonic `id` based on the current max + 1 (stable within
 *   this character's history; not cross-character comparable).
 * - Assigns `sequence` as current length. Simple, monotonic; doesn't need
 *   to correspond to any wall-clock value.
 * - Caller provides everything else including `kind`, the `backfilled`
 *   flag, and typed payload fields.
 *
 * Engine-only. NOT exported from the package barrel — clients must not
 * fabricate history entries.
 */
export function logHistoryEvent(
  char: Character,
  entryWithoutMeta: OmitMeta<HistoryEntry>,
): void {
  if (!char.progress) return;
  if (!char.progress.history) char.progress.history = [];
  const existing = char.progress.history;
  const nextId = existing.length > 0
    ? Math.max(...existing.map((e) => e.id)) + 1
    : 1;
  const entry = {
    ...entryWithoutMeta,
    id: nextId,
    sequence: existing.length,
  } as HistoryEntry;
  existing.push(entry);
}
