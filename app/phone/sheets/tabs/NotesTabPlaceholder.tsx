import { h } from 'preact';
import { TabPlaceholder } from './TabPlaceholder';

export function NotesTabPlaceholder() {
  return (
    <TabPlaceholder
      title="Notes"
      batch="T0d"
      blurb="Freeform per-character journal. Persists across sessions."
    />
  );
}
