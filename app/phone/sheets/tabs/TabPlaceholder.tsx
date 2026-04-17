import { h } from 'preact';

interface TabPlaceholderProps {
  /** Tab title, e.g. "Items". */
  title: string;
  /** Batch marker for visibility, e.g. "T2a". */
  batch: string;
  /** One-line description of what arrives in that batch. */
  blurb: string;
}

/**
 * Phase T0a: shared placeholder body for tabs that land in later batches.
 *
 * The one exemption to the project's "no placeholders" rule, granted for
 * structural reasons in the T0a prompt — the sheet shell needs to render
 * the full tab list from day one so nav patterns are settled.
 */
export function TabPlaceholder({ title, batch, blurb }: TabPlaceholderProps) {
  return (
    <div class="tab-placeholder">
      <h3 class="tab-placeholder__title">{title}</h3>
      <p class="tab-placeholder__blurb">{blurb}</p>
      <p class="tab-placeholder__availability">
        Available in <span class="tab-placeholder__batch">{batch}</span>.
      </p>
    </div>
  );
}
