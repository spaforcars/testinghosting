import { createClient } from '@sanity/client';

interface CmsProvider {
  getPageData(slug: string): Promise<unknown | null>;
  getPromoPlacements(slot?: string): Promise<unknown[]>;
}

interface PageConfig {
  pageType: string;
  singletonId: string;
}

const pageConfigBySlug: Record<string, PageConfig> = {
  home: { pageType: 'homePage', singletonId: 'homePage' },
  services: { pageType: 'servicesPage', singletonId: 'servicesPage' },
  fleet: { pageType: 'fleetPage', singletonId: 'fleetPage' },
  faq: { pageType: 'faqPage', singletonId: 'faqPage' },
  contact: { pageType: 'contactPage', singletonId: 'contactPage' },
  settings: { pageType: 'siteSettings', singletonId: 'siteSettings' },
  navigation: { pageType: 'navigationConfig', singletonId: 'navigationConfig' },
  about: { pageType: 'aboutPage', singletonId: 'aboutPage' },
  gallery: { pageType: 'galleryPage', singletonId: 'galleryPage' },
  'auto-repair': { pageType: 'autoRepairPage', singletonId: 'autoRepairPage' },
  'gift-cards': { pageType: 'giftCardsPage', singletonId: 'giftCardsPage' },
  pricing: { pageType: 'pricingPage', singletonId: 'pricingPage' },
};

const getSanityProvider = (): CmsProvider | null => {
  const projectId = process.env.SANITY_PROJECT_ID;
  const dataset = process.env.SANITY_DATASET;

  if (!projectId || !dataset) {
    return null;
  }

  const client = createClient({
    projectId,
    dataset,
    apiVersion: '2024-01-01',
    token: process.env.SANITY_API_TOKEN,
    useCdn: false,
    perspective: 'published',
  });

  return {
    getPageData: async (slug: string) => {
      const pageConfig = pageConfigBySlug[slug];
      if (!pageConfig) return null;

      const byId = await client.fetch(
        `*[_id == $singletonId && _type == $pageType][0]`,
        pageConfig
      );
      if (byId) return byId;

      return client.fetch(`*[_type == $pageType][0]`, pageConfig);
    },
    getPromoPlacements: async (slot?: string) => {
      const now = new Date().toISOString();
      const query = slot
        ? `*[_type == "promoPlacement" && enabled == true && slot == $slot && (!defined(startAt) || startAt <= $now) && (!defined(endAt) || endAt >= $now)] | order(_createdAt desc)`
        : `*[_type == "promoPlacement" && enabled == true && (!defined(startAt) || startAt <= $now) && (!defined(endAt) || endAt >= $now)] | order(_createdAt desc)`;

      return client.fetch(query, { slot, now });
    },
  };
};

const getExternalProvider = (): CmsProvider | null => {
  const baseUrl = process.env.EXTERNAL_CMS_BASE_URL;
  if (!baseUrl) return null;

  const token = process.env.EXTERNAL_CMS_TOKEN;
  const buildHeaders = (): HeadersInit => {
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  };

  const fetchJson = async (url: string): Promise<unknown> => {
    const response = await fetch(url, { headers: buildHeaders() });
    if (!response.ok) {
      throw new Error(`External CMS request failed (${response.status})`);
    }
    return response.json();
  };

  return {
    getPageData: async (slug: string) => {
      try {
        return await fetchJson(`${baseUrl.replace(/\/$/, '')}/pages/${encodeURIComponent(slug)}`);
      } catch (error) {
        console.warn('External CMS page fetch failed:', error);
        return null;
      }
    },
    getPromoPlacements: async (slot?: string) => {
      try {
        const url = new URL(`${baseUrl.replace(/\/$/, '')}/promos`);
        if (slot) {
          url.searchParams.set('slot', slot);
        }
        return (await fetchJson(url.toString())) as unknown[];
      } catch (error) {
        console.warn('External CMS promo fetch failed:', error);
        return [];
      }
    },
  };
};

const getCmsProvider = (): CmsProvider | null => {
  const provider = (process.env.CMS_PROVIDER || 'sanity').toLowerCase();
  if (provider === 'external') {
    return getExternalProvider();
  }
  return getSanityProvider();
};

export const getCmsPageData = async (slug: string): Promise<unknown | null> => {
  const provider = getCmsProvider();
  if (!provider) return null;
  return provider.getPageData(slug);
};

export const getPromoPlacements = async (slot?: string): Promise<unknown[]> => {
  const provider = getCmsProvider();
  if (!provider) return [];
  return provider.getPromoPlacements(slot);
};
