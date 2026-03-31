import type {
  AboutPageContent,
  AutoRepairPageContent,
  ContactPageContent,
  FaqPageContent,
  FleetPageContent,
  GalleryPageContent,
  GiftCardsPageContent,
  HomePageContent,
  NavigationContent,
  NavigationItem,
  PricingPageContent,
  ServiceOffering,
  SiteSettingsContent,
  ServicesPageContent,
} from '../types/cms';
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
} from './cmsDefaults';

const defaultServiceOfferingLookup = new Map(
  [
    ...defaultServicesPageContent.detailingOfferings,
    ...defaultServicesPageContent.specialtyServices,
    ...defaultServicesPageContent.additionalServices,
  ].map((offering) => [offering.id, offering] as const)
);

const ensureString = (value: unknown, fallback: string): string =>
  typeof value === 'string' && value.trim() ? value : fallback;

const ensureStringArray = (value: unknown, fallback: string[]): string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string') ? (value as string[]) : fallback;

const ensureNumber = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const ensureBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

const ensureNumberArray = (value: unknown, fallback: number[]): number[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'number' && Number.isFinite(item))
    ? (value as number[])
    : fallback;

const isServiceCategory = (value: string): value is ServiceOffering['category'] =>
  value === 'detailing' ||
  value === 'maintenance' ||
  value === 'protection' ||
  value === 'tint' ||
  value === 'restoration' ||
  value === 'add_on';

const adaptServiceOffering = (value: unknown): ServiceOffering | null => {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const id = ensureString(record.id, '');
  const title = ensureString(record.title, '');
  const description = ensureString(record.description, '');
  const categoryCandidate = ensureString(record.category, '');
  const priceLabel = ensureString(record.priceLabel, '');
  const image = ensureString(record.image, '');

  if (!id || !title || !description || !priceLabel || !image || !isServiceCategory(categoryCandidate)) {
    return null;
  }

  const fallback = defaultServiceOfferingLookup.get(id);

  return {
    id,
    title,
    shortTitle: ensureString(record.shortTitle, '') || undefined,
    description,
    category: categoryCandidate,
    priceLabel,
    fixedPriceAmount:
      typeof record.fixedPriceAmount === 'number' && Number.isFinite(record.fixedPriceAmount)
        ? record.fixedPriceAmount
        : fallback?.fixedPriceAmount,
    duration: ensureString(record.duration, '') || undefined,
    image,
    features: ensureStringArray(record.features, []),
    notes: ensureString(record.notes, '') || undefined,
    bookable: ensureBoolean(record.bookable, fallback?.bookable ?? false),
    addOnOnly: ensureBoolean(record.addOnOnly, fallback?.addOnOnly ?? false),
    bookingMode:
      ensureString(record.bookingMode, fallback?.bookingMode || 'instant') === 'request'
        ? 'request'
        : 'instant',
    slotDurationMinutes:
      typeof record.slotDurationMinutes === 'number' && Number.isFinite(record.slotDurationMinutes)
        ? record.slotDurationMinutes
        : fallback?.slotDurationMinutes,
    bufferMinutes:
      typeof record.bufferMinutes === 'number' && Number.isFinite(record.bufferMinutes)
        ? record.bufferMinutes
        : fallback?.bufferMinutes,
    allowsPickupRequest: ensureBoolean(record.allowsPickupRequest, fallback?.allowsPickupRequest ?? false),
    intakeMode:
      ensureString(record.intakeMode, fallback?.intakeMode || 'basic') === 'assessment'
        ? 'assessment'
        : 'basic',
  };
};

export const adaptHomeContent = (raw: unknown): HomePageContent => {
  if (!raw || typeof raw !== 'object') return defaultHomePageContent;
  const page = raw as Partial<HomePageContent>;
  const fallbackFeatures = defaultHomePageContent.whyFeatures;
  const fallbackShowcaseServices = defaultHomePageContent.showcaseServices;
  const fallbackGalleryImages = defaultHomePageContent.galleryImages;

  const whyFeatures = Array.isArray(page.whyFeatures)
    ? page.whyFeatures
        .map((feature) => {
          if (!feature || typeof feature !== 'object') return null;
          const record = feature as unknown as Record<string, unknown>;
          const title = ensureString(record.title, '');
          const description = ensureString(record.description, '');
          const iconCandidate = ensureString(record.icon, 'shield');
          const icon =
            iconCandidate === 'shield' ||
            iconCandidate === 'droplets' ||
            iconCandidate === 'car' ||
            iconCandidate === 'sparkles'
              ? iconCandidate
              : 'shield';
          if (!title || !description) return null;
          return { icon, title, description };
        })
        .filter(Boolean)
    : [];

  const showcaseServices = Array.isArray(page.showcaseServices)
    ? page.showcaseServices
        .map((service) => {
          if (!service || typeof service !== 'object') return null;
          const record = service as unknown as Record<string, unknown>;
          const title = ensureString(record.title, '');
          const price = ensureString(record.price, '');
          const image = ensureString(record.image, '');
          const bookingServiceId = ensureString(record.bookingServiceId, '');
          if (!title || !price || !image) return null;
          return {
            title,
            price,
            image,
            bookingServiceId: bookingServiceId || undefined,
          };
        })
        .filter(Boolean)
    : [];

  return {
    heroTitle: ensureString(page.heroTitle, defaultHomePageContent.heroTitle),
    heroAccent: ensureString(page.heroAccent, defaultHomePageContent.heroAccent),
    heroSubtitle: ensureString(page.heroSubtitle, defaultHomePageContent.heroSubtitle),
    heroImage: ensureString(page.heroImage, defaultHomePageContent.heroImage),
    heroButtonLabel: ensureString(page.heroButtonLabel, defaultHomePageContent.heroButtonLabel),
    heroButtonPath: ensureString(page.heroButtonPath, defaultHomePageContent.heroButtonPath),
    whyTitle: ensureString(page.whyTitle, defaultHomePageContent.whyTitle),
    whyBody: ensureString(page.whyBody, defaultHomePageContent.whyBody),
    whyFeatures: whyFeatures.length
      ? (whyFeatures as HomePageContent['whyFeatures'])
      : fallbackFeatures,
    showcaseBadge: ensureString(page.showcaseBadge, defaultHomePageContent.showcaseBadge),
    showcaseTitle: ensureString(page.showcaseTitle, defaultHomePageContent.showcaseTitle),
    showcaseViewAllLabel: ensureString(
      page.showcaseViewAllLabel,
      defaultHomePageContent.showcaseViewAllLabel
    ),
    showcaseViewAllPath: ensureString(
      page.showcaseViewAllPath,
      defaultHomePageContent.showcaseViewAllPath
    ),
    showcaseServices: showcaseServices.length
      ? (showcaseServices as HomePageContent['showcaseServices'])
      : fallbackShowcaseServices,
    testimonialQuote: ensureString(page.testimonialQuote, defaultHomePageContent.testimonialQuote),
    testimonialAuthor: ensureString(page.testimonialAuthor, defaultHomePageContent.testimonialAuthor),
    galleryBadge: ensureString(page.galleryBadge, defaultHomePageContent.galleryBadge),
    galleryTitle: ensureString(page.galleryTitle, defaultHomePageContent.galleryTitle),
    galleryViewAllLabel: ensureString(
      page.galleryViewAllLabel,
      defaultHomePageContent.galleryViewAllLabel
    ),
    galleryViewAllPath: ensureString(
      page.galleryViewAllPath,
      defaultHomePageContent.galleryViewAllPath
    ),
    galleryImages: ensureStringArray(page.galleryImages, fallbackGalleryImages),
    ctaTitle: ensureString(page.ctaTitle, defaultHomePageContent.ctaTitle),
    ctaBody: ensureString(page.ctaBody, defaultHomePageContent.ctaBody),
    ctaButtonLabel: ensureString(page.ctaButtonLabel, defaultHomePageContent.ctaButtonLabel),
    ctaButtonPath: ensureString(page.ctaButtonPath, defaultHomePageContent.ctaButtonPath),
    promoPlacements: Array.isArray(page.promoPlacements) ? page.promoPlacements : [],
  };
};

export const adaptServicesContent = (raw: unknown): ServicesPageContent => {
  if (!raw || typeof raw !== 'object') return defaultServicesPageContent;
  const page = raw as Partial<ServicesPageContent>;

  const detailingOfferings = Array.isArray(page.detailingOfferings)
    ? page.detailingOfferings.map(adaptServiceOffering).filter(Boolean)
    : [];

  const detailingPackages = Array.isArray(page.detailingPackages)
    ? page.detailingPackages
        .map((row) => {
          if (!row || typeof row !== 'object') return null;
          const record = row as unknown as Record<string, unknown>;
          const vehicleType = ensureString(record.vehicleType, '');
          const fullDetailId = ensureString(record.fullDetailId, '');
          const interiorOnlyId = ensureString(record.interiorOnlyId, '');
          if (!vehicleType || !fullDetailId || !interiorOnlyId) return null;
          return { vehicleType, fullDetailId, interiorOnlyId };
        })
        .filter(Boolean)
    : [];

  const specialtyServices = Array.isArray(page.specialtyServices)
    ? page.specialtyServices.map(adaptServiceOffering).filter(Boolean)
    : [];

  const additionalServices = Array.isArray(page.additionalServices)
    ? page.additionalServices.map(adaptServiceOffering).filter(Boolean)
    : [];

  return {
    badge: ensureString(page.badge, defaultServicesPageContent.badge),
    title: ensureString(page.title, defaultServicesPageContent.title),
    subtitle: ensureString(page.subtitle, defaultServicesPageContent.subtitle),
    detailingPackagesTitle: ensureString(
      page.detailingPackagesTitle,
      defaultServicesPageContent.detailingPackagesTitle
    ),
    detailingOfferings: detailingOfferings.length
      ? (detailingOfferings as ServiceOffering[])
      : defaultServicesPageContent.detailingOfferings,
    detailingPackages: detailingPackages.length
      ? (detailingPackages as ServicesPageContent['detailingPackages'])
      : defaultServicesPageContent.detailingPackages,
    exteriorIncludesTitle: ensureString(
      page.exteriorIncludesTitle,
      defaultServicesPageContent.exteriorIncludesTitle
    ),
    exteriorIncludes: ensureStringArray(
      page.exteriorIncludes,
      defaultServicesPageContent.exteriorIncludes
    ),
    interiorIncludesTitle: ensureString(
      page.interiorIncludesTitle,
      defaultServicesPageContent.interiorIncludesTitle
    ),
    interiorIncludes: ensureStringArray(
      page.interiorIncludes,
      defaultServicesPageContent.interiorIncludes
    ),
    specialtyServicesTitle: ensureString(
      page.specialtyServicesTitle,
      defaultServicesPageContent.specialtyServicesTitle
    ),
    specialtyServices: specialtyServices.length
      ? (specialtyServices as ServiceOffering[])
      : defaultServicesPageContent.specialtyServices,
    additionalServicesTitle: ensureString(
      page.additionalServicesTitle,
      defaultServicesPageContent.additionalServicesTitle
    ),
    additionalServices: additionalServices.length
      ? (additionalServices as ServiceOffering[])
      : defaultServicesPageContent.additionalServices,
    featuredOfferingIds: ensureStringArray(
      page.featuredOfferingIds,
      defaultServicesPageContent.featuredOfferingIds
    ),
  };
};

export const adaptFleetContent = (raw: unknown): FleetPageContent => {
  if (!raw || typeof raw !== 'object') return defaultFleetPageContent;
  const page = raw as Partial<FleetPageContent>;
  return {
    badge: ensureString(page.badge, defaultFleetPageContent.badge),
    title: ensureString(page.title, defaultFleetPageContent.title),
    subtitle: ensureString(page.subtitle, defaultFleetPageContent.subtitle),
    dealershipsTitle: ensureString(page.dealershipsTitle, defaultFleetPageContent.dealershipsTitle),
    dealershipsItems: ensureStringArray(page.dealershipsItems, defaultFleetPageContent.dealershipsItems),
    fleetsTitle: ensureString(page.fleetsTitle, defaultFleetPageContent.fleetsTitle),
    fleetsItems: ensureStringArray(page.fleetsItems, defaultFleetPageContent.fleetsItems),
    proposalTitle: ensureString(page.proposalTitle, defaultFleetPageContent.proposalTitle),
    proposalSubtitle: ensureString(page.proposalSubtitle, defaultFleetPageContent.proposalSubtitle),
  };
};

export const adaptFaqContent = (raw: unknown): FaqPageContent => {
  if (!raw || typeof raw !== 'object') return defaultFaqPageContent;
  const page = raw as Partial<FaqPageContent>;
  const fallback = defaultFaqPageContent.items;

  const items = Array.isArray(page.items)
    ? page.items
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const record = item as unknown as Record<string, unknown>;
          const question = typeof record.question === 'string' ? record.question.trim() : '';
          const answer = typeof record.answer === 'string' ? record.answer.trim() : '';
          if (!question || !answer) return null;
          return { question, answer };
        })
        .filter(Boolean)
    : [];

  return {
    items: items.length ? (items as FaqPageContent['items']) : fallback,
  };
};

export const adaptContactContent = (raw: unknown): ContactPageContent => {
  if (!raw || typeof raw !== 'object') return defaultContactPageContent;
  const page = raw as Partial<ContactPageContent>;
  return {
    title: ensureString(page.title, defaultContactPageContent.title),
    subtitle: ensureString(page.subtitle, defaultContactPageContent.subtitle),
    address: ensureString(page.address, defaultContactPageContent.address),
    mapEmbedUrl: ensureString(page.mapEmbedUrl, defaultContactPageContent.mapEmbedUrl),
  };
};

export const adaptAboutContent = (raw: unknown): AboutPageContent => {
  if (!raw || typeof raw !== 'object') return defaultAboutPageContent;
  const page = raw as Partial<AboutPageContent>;
  const fallbackCards = defaultAboutPageContent.valueCards;

  const valueCards = Array.isArray(page.valueCards)
    ? page.valueCards
        .map((card) => {
          if (!card || typeof card !== 'object') return null;
          const record = card as unknown as Record<string, unknown>;
          const iconCandidate = ensureString(record.icon, 'award');
          const icon =
            iconCandidate === 'award' || iconCandidate === 'heart' || iconCandidate === 'users'
              ? iconCandidate
              : 'award';
          const title = ensureString(record.title, '');
          const description = ensureString(record.description, '');
          if (!title || !description) return null;
          return { icon, title, description };
        })
        .filter(Boolean)
    : [];

  return {
    badge: ensureString(page.badge, defaultAboutPageContent.badge),
    title: ensureString(page.title, defaultAboutPageContent.title),
    subtitle: ensureString(page.subtitle, defaultAboutPageContent.subtitle),
    image: ensureString(page.image, defaultAboutPageContent.image),
    imageBadge: ensureString(page.imageBadge, defaultAboutPageContent.imageBadge),
    evolutionTitle: ensureString(page.evolutionTitle, defaultAboutPageContent.evolutionTitle),
    evolutionBody: ensureString(page.evolutionBody, defaultAboutPageContent.evolutionBody),
    valueCards: valueCards.length ? (valueCards as AboutPageContent['valueCards']) : fallbackCards,
  };
};

export const adaptGalleryContent = (raw: unknown): GalleryPageContent => {
  if (!raw || typeof raw !== 'object') return defaultGalleryPageContent;
  const page = raw as Partial<GalleryPageContent>;
  const fallbackTransformations = defaultGalleryPageContent.transformations;

  const transformations = Array.isArray(page.transformations)
    ? page.transformations
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const record = item as unknown as Record<string, unknown>;
          const label = ensureString(record.label, '');
          const beforeImage = ensureString(record.beforeImage, '');
          const afterImage = ensureString(record.afterImage, '');
          if (!label || !beforeImage || !afterImage) return null;
          return { label, beforeImage, afterImage };
        })
        .filter(Boolean)
    : [];

  return {
    badge: ensureString(page.badge, defaultGalleryPageContent.badge),
    title: ensureString(page.title, defaultGalleryPageContent.title),
    subtitle: ensureString(page.subtitle, defaultGalleryPageContent.subtitle),
    transformations: transformations.length
      ? (transformations as GalleryPageContent['transformations'])
      : fallbackTransformations,
  };
};

export const adaptAutoRepairContent = (raw: unknown): AutoRepairPageContent => {
  if (!raw || typeof raw !== 'object') return defaultAutoRepairPageContent;
  const page = raw as Partial<AutoRepairPageContent>;
  return {
    badge: ensureString(page.badge, defaultAutoRepairPageContent.badge),
    title: ensureString(page.title, defaultAutoRepairPageContent.title),
    subtitle: ensureString(page.subtitle, defaultAutoRepairPageContent.subtitle),
    inputPlaceholder: ensureString(
      page.inputPlaceholder,
      defaultAutoRepairPageContent.inputPlaceholder
    ),
    submitButtonLabel: ensureString(
      page.submitButtonLabel,
      defaultAutoRepairPageContent.submitButtonLabel
    ),
    submittingButtonLabel: ensureString(
      page.submittingButtonLabel,
      defaultAutoRepairPageContent.submittingButtonLabel
    ),
    successTitle: ensureString(page.successTitle, defaultAutoRepairPageContent.successTitle),
    successMessage: ensureString(
      page.successMessage,
      defaultAutoRepairPageContent.successMessage
    ),
  };
};

export const adaptGiftCardsContent = (raw: unknown): GiftCardsPageContent => {
  if (!raw || typeof raw !== 'object') return defaultGiftCardsPageContent;
  const page = raw as Partial<GiftCardsPageContent>;
  return {
    badge: ensureString(page.badge, defaultGiftCardsPageContent.badge),
    title: ensureString(page.title, defaultGiftCardsPageContent.title),
    subtitle: ensureString(page.subtitle, defaultGiftCardsPageContent.subtitle),
    cardBrand: ensureString(page.cardBrand, defaultGiftCardsPageContent.cardBrand),
    cardTitle: ensureString(page.cardTitle, defaultGiftCardsPageContent.cardTitle),
    cardTagline: ensureString(page.cardTagline, defaultGiftCardsPageContent.cardTagline),
    benefits: ensureStringArray(page.benefits, defaultGiftCardsPageContent.benefits),
    configureTitle: ensureString(page.configureTitle, defaultGiftCardsPageContent.configureTitle),
    presetAmounts: ensureNumberArray(page.presetAmounts, defaultGiftCardsPageContent.presetAmounts),
    minCustomAmount: ensureNumber(page.minCustomAmount, defaultGiftCardsPageContent.minCustomAmount),
    recipientEmailLabel: ensureString(
      page.recipientEmailLabel,
      defaultGiftCardsPageContent.recipientEmailLabel
    ),
    senderNameLabel: ensureString(page.senderNameLabel, defaultGiftCardsPageContent.senderNameLabel),
    messageLabel: ensureString(page.messageLabel, defaultGiftCardsPageContent.messageLabel),
    proceedButtonLabel: ensureString(
      page.proceedButtonLabel,
      defaultGiftCardsPageContent.proceedButtonLabel
    ),
    proceedingButtonLabel: ensureString(
      page.proceedingButtonLabel,
      defaultGiftCardsPageContent.proceedingButtonLabel
    ),
    paymentTitle: ensureString(page.paymentTitle, defaultGiftCardsPageContent.paymentTitle),
    backToConfigLabel: ensureString(
      page.backToConfigLabel,
      defaultGiftCardsPageContent.backToConfigLabel
    ),
    paymentNote: ensureString(page.paymentNote, defaultGiftCardsPageContent.paymentNote),
    successTitle: ensureString(page.successTitle, defaultGiftCardsPageContent.successTitle),
    successMessagePrefix: ensureString(
      page.successMessagePrefix,
      defaultGiftCardsPageContent.successMessagePrefix
    ),
    resetButtonLabel: ensureString(
      page.resetButtonLabel,
      defaultGiftCardsPageContent.resetButtonLabel
    ),
  };
};

export const adaptPricingContent = (raw: unknown): PricingPageContent => {
  if (!raw || typeof raw !== 'object') return defaultPricingPageContent;
  const page = raw as Partial<PricingPageContent>;
  return {
    badge: ensureString(page.badge, defaultPricingPageContent.badge),
    title: ensureString(page.title, defaultPricingPageContent.title),
    subtitle: ensureString(page.subtitle, defaultPricingPageContent.subtitle),
    mostPopularBadge: ensureString(
      page.mostPopularBadge,
      defaultPricingPageContent.mostPopularBadge
    ),
    selectPlanLabel: ensureString(page.selectPlanLabel, defaultPricingPageContent.selectPlanLabel),
    customQuoteTitle: ensureString(
      page.customQuoteTitle,
      defaultPricingPageContent.customQuoteTitle
    ),
    customQuoteBody: ensureString(page.customQuoteBody, defaultPricingPageContent.customQuoteBody),
    customQuoteButtonLabel: ensureString(
      page.customQuoteButtonLabel,
      defaultPricingPageContent.customQuoteButtonLabel
    ),
    customQuoteButtonPath: ensureString(
      page.customQuoteButtonPath,
      defaultPricingPageContent.customQuoteButtonPath
    ),
    highlightServiceId: ensureString(
      page.highlightServiceId,
      defaultPricingPageContent.highlightServiceId
    ),
  };
};

const adaptNavigationItem = (item: unknown): NavigationItem | null => {
  if (!item || typeof item !== 'object') return null;
  const record = item as Record<string, unknown>;
  const label = ensureString(record.label, '');
  const path = ensureString(record.path, '');
  const enabled = typeof record.enabled === 'boolean' ? record.enabled : true;
  if (!label || !path) return null;
  return { label, path, enabled };
};

export const adaptNavigationContent = (raw: unknown): NavigationContent => {
  if (!raw || typeof raw !== 'object') return defaultNavigationContent;
  const page = raw as Partial<NavigationContent> & { items?: unknown[] };
  const legacyItems = Array.isArray(page.items)
    ? page.items.map(adaptNavigationItem).filter(Boolean)
    : [];
  const primaryLinks = Array.isArray(page.primaryLinks)
    ? page.primaryLinks.map(adaptNavigationItem).filter(Boolean)
    : legacyItems;
  const secondaryLinks = Array.isArray(page.secondaryLinks)
    ? page.secondaryLinks.map(adaptNavigationItem).filter(Boolean)
    : [];

  return {
    primaryLinks: primaryLinks.length
      ? (primaryLinks as NavigationItem[])
      : defaultNavigationContent.primaryLinks,
    secondaryLinks: secondaryLinks.length
      ? (secondaryLinks as NavigationItem[])
      : defaultNavigationContent.secondaryLinks,
    bookingCtaLabel: ensureString(
      page.bookingCtaLabel,
      defaultNavigationContent.bookingCtaLabel
    ),
    bookingCtaPath: ensureString(page.bookingCtaPath, defaultNavigationContent.bookingCtaPath),
  };
};

export const adaptSiteSettingsContent = (raw: unknown): SiteSettingsContent => {
  if (!raw || typeof raw !== 'object') return defaultSiteSettingsContent;
  const page = raw as Partial<SiteSettingsContent>;
  return {
    businessName: ensureString(page.businessName, defaultSiteSettingsContent.businessName),
    serviceNotice: ensureString(page.serviceNotice, defaultSiteSettingsContent.serviceNotice),
    contactEmail: ensureString(page.contactEmail, defaultSiteSettingsContent.contactEmail),
    contactPhone: ensureString(page.contactPhone, defaultSiteSettingsContent.contactPhone),
    secondaryContactPhone: ensureString(
      page.secondaryContactPhone,
      defaultSiteSettingsContent.secondaryContactPhone
    ),
    contactHours: ensureString(page.contactHours, defaultSiteSettingsContent.contactHours),
    topBarHours: ensureString(page.topBarHours, defaultSiteSettingsContent.topBarHours),
    address: ensureString(page.address, defaultSiteSettingsContent.address),
    instagramUrl: ensureString(page.instagramUrl, defaultSiteSettingsContent.instagramUrl),
    tiktokUrl: ensureString(page.tiktokUrl, defaultSiteSettingsContent.tiktokUrl),
    footerTagline: ensureString(page.footerTagline, defaultSiteSettingsContent.footerTagline),
  };
};
