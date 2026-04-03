import { useEffect, useState } from 'react';
import { resolveApiUrl } from '../lib/apiClient';

interface CmsState<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

export const useCmsPage = <T,>(slug: string, fallback: T): CmsState<T> => {
  const [state, setState] = useState<CmsState<T>>({
    data: fallback,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let isActive = true;

    const load = async () => {
      try {
        const response = await fetch(
          resolveApiUrl(`/api/cms/page?slug=${encodeURIComponent(slug)}`)
        );
        if (!response.ok) {
          throw new Error(`Failed to load CMS page (${response.status})`);
        }
        const payload = (await response.json()) as { data?: T };
        if (isActive) {
          setState({
            data: payload.data ?? fallback,
            loading: false,
            error: null,
          });
        }
      } catch (error) {
        if (isActive) {
          setState({
            data: fallback,
            loading: false,
            error: error instanceof Error ? error.message : 'Failed to load CMS content',
          });
        }
      }
    };

    load();

    return () => {
      isActive = false;
    };
  }, [fallback, slug]);

  return state;
};
