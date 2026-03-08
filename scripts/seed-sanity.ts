import 'dotenv/config';
import { createClient } from '@sanity/client';
import {
  defaultAboutPageContent,
  defaultAutoRepairPageContent,
  defaultContactPageContent,
  defaultFaqPageContent,
  defaultFleetPageContent,
  defaultGalleryPageContent,
  defaultGiftCardsPageContent,
  defaultHomePageContent,
  defaultNavigationContent,
  defaultPricingPageContent,
  defaultSiteSettingsContent,
  defaultServicesPageContent,
} from '../lib/cmsDefaults';

const projectId = process.env.SANITY_PROJECT_ID;
const dataset = process.env.SANITY_DATASET || 'production';
const token = process.env.SANITY_API_TOKEN;

if (!projectId || !token) {
  throw new Error('Missing SANITY_PROJECT_ID or SANITY_API_TOKEN in root .env');
}

const client = createClient({
  projectId,
  dataset,
  token,
  apiVersion: '2024-01-01',
  useCdn: false,
  perspective: 'published',
});

const deepWithKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const keyed = item as Record<string, unknown>;
        const nested = deepWithKeys(keyed) as Record<string, unknown>;
        return {
          _key:
            typeof keyed._key === 'string' && keyed._key.trim()
              ? keyed._key
              : Math.random().toString(36).slice(2, 12),
          ...nested,
        };
      }
      return deepWithKeys(item);
    });
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, child]) => [key, deepWithKeys(child)])
    );
  }

  return value;
};

const asObject = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
};

const docs: Array<Record<string, unknown>> = [
  {
    _id: 'siteSettings',
    _type: 'siteSettings',
    ...defaultSiteSettingsContent,
  },
  {
    _id: 'navigationConfig',
    _type: 'navigationConfig',
    ...defaultNavigationContent,
  },
  {
    _id: 'homePage',
    _type: 'homePage',
    ...(() => {
      const { promoPlacements, ...rest } = defaultHomePageContent;
      return asObject(deepWithKeys(rest));
    })(),
  },
  {
    _id: 'servicesPage',
    _type: 'servicesPage',
    ...asObject(deepWithKeys(defaultServicesPageContent)),
  },
  {
    _id: 'fleetPage',
    _type: 'fleetPage',
    ...defaultFleetPageContent,
  },
  {
    _id: 'faqPage',
    _type: 'faqPage',
    ...asObject(deepWithKeys(defaultFaqPageContent)),
  },
  {
    _id: 'contactPage',
    _type: 'contactPage',
    ...defaultContactPageContent,
  },
  {
    _id: 'aboutPage',
    _type: 'aboutPage',
    ...asObject(deepWithKeys(defaultAboutPageContent)),
  },
  {
    _id: 'galleryPage',
    _type: 'galleryPage',
    ...asObject(deepWithKeys(defaultGalleryPageContent)),
  },
  {
    _id: 'autoRepairPage',
    _type: 'autoRepairPage',
    ...defaultAutoRepairPageContent,
  },
  {
    _id: 'giftCardsPage',
    _type: 'giftCardsPage',
    ...defaultGiftCardsPageContent,
  },
  {
    _id: 'pricingPage',
    _type: 'pricingPage',
    ...defaultPricingPageContent,
  },
];

const run = async () => {
  for (const doc of docs) {
    await client.createOrReplace(doc as any);
    console.log(`Seeded ${String(doc._type)}`);
  }
  console.log(`Seed complete for project ${projectId}/${dataset}`);
};

run().catch((error) => {
  console.error('Failed to seed Sanity content:', error);
  process.exit(1);
});
