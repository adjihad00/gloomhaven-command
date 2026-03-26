import { useState, useEffect } from 'preact/hooks';

export function useDataApi<T>(path: string, enabled: boolean = true): {
  data: T | null;
  loading: boolean;
  error: string | null;
} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !path) return;

    setLoading(true);
    setError(null);

    fetch(`/api/data/${path}`)
      .then(res => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
      })
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [path, enabled]);

  return { data, loading, error };
}

// Typed convenience hooks
export function useEditions() {
  return useDataApi<string[]>('editions');
}

export function useCharacterList(edition: string) {
  return useDataApi<any[]>(`${edition}/characters`, !!edition);
}

export function useMonsterList(edition: string) {
  return useDataApi<any[]>(`${edition}/monsters`, !!edition);
}

export function useScenarioList(edition: string) {
  return useDataApi<any[]>(`${edition}/scenarios`, !!edition);
}
