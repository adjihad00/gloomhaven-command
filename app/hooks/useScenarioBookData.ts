import { useState, useEffect } from 'preact/hooks';

interface ScenarioBookDataResult {
  goalText: string | null;
  lossText: string | null;
  specialRules: string | null;
  introduction: string | null;
  loading: boolean;
}

/**
 * Fetches scenario book data (win/loss conditions, introduction, special rules)
 * from /api/ref/scenario-book/{edition}/{index}.
 *
 * Returns null gracefully when book data doesn't exist (e.g., non-FH editions
 * without book PDFs, or scenarios not yet extracted).
 */
export function useScenarioBookData(edition: string, scenarioIndex: string): ScenarioBookDataResult {
  const [data, setData] = useState<ScenarioBookDataResult>({
    goalText: null, lossText: null, specialRules: null, introduction: null, loading: false,
  });

  useEffect(() => {
    if (!edition || !scenarioIndex) return;

    setData(prev => ({ ...prev, loading: true }));

    fetch(`/api/ref/scenario-book/${edition}/${scenarioIndex}`)
      .then(res => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((result: {
        goal_text: string | null;
        loss_text: string | null;
        special_rules_text: string | null;
        introduction: string | null;
      } | null) => {
        setData({
          goalText: result?.goal_text ?? null,
          lossText: result?.loss_text ?? null,
          specialRules: result?.special_rules_text ?? null,
          introduction: result?.introduction ?? null,
          loading: false,
        });
      })
      .catch(() => {
        setData({ goalText: null, lossText: null, specialRules: null, introduction: null, loading: false });
      });
  }, [edition, scenarioIndex]);

  return data;
}
