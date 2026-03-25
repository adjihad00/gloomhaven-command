// Shared utilities for controller tab modules

/** Convert kebab-case name to Title Case (e.g. "living-bones" → "Living Bones") */
export function formatName(name: string): string {
  return name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
