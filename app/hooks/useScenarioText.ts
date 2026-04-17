import { useState, useEffect } from 'preact/hooks';
import { interpolateLabelIcons } from '../shared/labelRenderer';

interface ScenarioTextResult {
  /** Scenario title from reference DB (e.g. "A Black Ship"), or null if not loaded/missing. */
  name: string | null;
  specialRules: string[];
  loading: boolean;
  error: string | null;
}

/**
 * Fetches scenario rules text from /api/ref/scenario-text and returns
 * display-ready HTML strings with interpolated icons.
 *
 * Client-side filters label keys to avoid prefix false positives
 * (e.g., prefix "scenario.rules.fh.1" matching "scenario.rules.fh.10").
 */
export function useScenarioText(edition: string, scenarioIndex: string): ScenarioTextResult {
  const [name, setName] = useState<string | null>(null);
  const [specialRules, setSpecialRules] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!edition || !scenarioIndex) return;

    setLoading(true);
    setError(null);

    fetch(`/api/ref/scenario-text/${edition}/${scenarioIndex}`)
      .then(res => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
      })
      .then((data: { name: string | null; rules: unknown[] | null; rulesLabels: Record<string, string> }) => {
        setName(data.name ?? null);

        const prefix = `scenario.rules.${edition}.${scenarioIndex}`;
        const filtered: Array<{ key: string; value: string; sortKey: number }> = [];

        for (const [key, value] of Object.entries(data.rulesLabels)) {
          if (key === prefix) {
            // Exact match — main rule (sort first)
            filtered.push({ key, value, sortKey: 0 });
          } else if (key.startsWith(prefix + '.')) {
            // Sub-rule — e.g., scenario.rules.fh.0.1
            const suffix = key.slice(prefix.length + 1);
            const num = parseInt(suffix, 10);
            filtered.push({ key, value, sortKey: isNaN(num) ? 999 : num });
          }
          // Keys like scenario.rules.fh.10 when prefix is scenario.rules.fh.1 are skipped
        }

        // Sort by numeric suffix (main rule first, then sub-rules in order)
        filtered.sort((a, b) => a.sortKey - b.sortKey);

        // Interpolate icon placeholders and return as HTML strings
        const rules = filtered.map(r => interpolateLabelIcons(r.value));
        setSpecialRules(rules);
      })
      .catch(err => {
        setError(err.message);
        setName(null);
        setSpecialRules([]);
      })
      .finally(() => setLoading(false));
  }, [edition, scenarioIndex]);

  return { name, specialRules, loading, error };
}
