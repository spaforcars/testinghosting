import { useEffect, useState } from 'react';
import type { PromoPlacement } from '../types/cms';

export const useCmsPromos = (slot: string) => {
  const [promos, setPromos] = useState<PromoPlacement[]>([]);

  useEffect(() => {
    let active = true;
    const loadPromos = async () => {
      try {
        const response = await fetch(`/api/cms/page?slug=${encodeURIComponent(slot)}`);
        if (!response.ok) return;
        const payload = (await response.json()) as { promos?: PromoPlacement[] };
        if (active) {
          setPromos(Array.isArray(payload.promos) ? payload.promos : []);
        }
      } catch {
        if (active) {
          setPromos([]);
        }
      }
    };
    loadPromos();
    return () => {
      active = false;
    };
  }, [slot]);

  return promos;
};
