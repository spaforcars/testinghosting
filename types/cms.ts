export interface PromoPlacement {
  _id?: string;
  slot: string;
  title: string;
  message?: string;
  ctaLabel?: string;
  ctaLink?: string;
  image?: string;
  enabled?: boolean;
  startAt?: string;
  endAt?: string;
}

export interface HomeFeature {
  icon: 'shield' | 'droplets' | 'car' | 'sparkles';
  title: string;
  description: string;
}

export interface HomeShowcaseService {
  title: string;
  price: string;
  image: string;
  bookingServiceId?: string;
}

export interface HomePageContent {
  heroTitle: string;
  heroAccent: string;
  heroSubtitle: string;
  heroImage: string;
  heroButtonLabel: string;
  heroButtonPath: string;
  whyTitle: string;
  whyBody: string;
  whyFeatures: HomeFeature[];
  showcaseBadge: string;
  showcaseTitle: string;
  showcaseViewAllLabel: string;
  showcaseViewAllPath: string;
  showcaseServices: HomeShowcaseService[];
  testimonialQuote: string;
  testimonialAuthor: string;
  galleryBadge: string;
  galleryTitle: string;
  galleryViewAllLabel: string;
  galleryViewAllPath: string;
  galleryImages: string[];
  ctaTitle: string;
  ctaBody: string;
  ctaButtonLabel: string;
  ctaButtonPath: string;
  promoPlacements: PromoPlacement[];
}

export interface CmsServiceCard {
  id: string;
  title: string;
  description: string;
  category: string;
  price: string;
  duration: string;
  image: string;
  features: string[];
  idealFor?: string;
  process?: string;
  notes?: string;
}

export interface ServicesPageContent {
  badge: string;
  title: string;
  subtitle: string;
  services: CmsServiceCard[];
}

export interface FleetPageContent {
  badge: string;
  title: string;
  subtitle: string;
  dealershipsTitle: string;
  dealershipsItems: string[];
  fleetsTitle: string;
  fleetsItems: string[];
  proposalTitle: string;
  proposalSubtitle: string;
}

export interface FaqPageItem {
  question: string;
  answer: string;
}

export interface FaqPageContent {
  items: FaqPageItem[];
}

export interface ContactPageContent {
  title: string;
  subtitle: string;
  address: string;
  mapEmbedUrl: string;
}

export interface AboutValueCard {
  icon: 'award' | 'heart' | 'users';
  title: string;
  description: string;
}

export interface AboutPageContent {
  badge: string;
  title: string;
  subtitle: string;
  image: string;
  imageBadge: string;
  evolutionTitle: string;
  evolutionBody: string;
  valueCards: AboutValueCard[];
}

export interface GalleryTransformation {
  label: string;
  beforeImage: string;
  afterImage: string;
}

export interface GalleryPageContent {
  badge: string;
  title: string;
  subtitle: string;
  transformations: GalleryTransformation[];
}

export interface AutoRepairPageContent {
  badge: string;
  title: string;
  subtitle: string;
  inputPlaceholder: string;
  submitButtonLabel: string;
  submittingButtonLabel: string;
  successTitle: string;
  successMessage: string;
}

export interface GiftCardsPageContent {
  badge: string;
  title: string;
  subtitle: string;
  cardBrand: string;
  cardTitle: string;
  cardTagline: string;
  benefits: string[];
  configureTitle: string;
  presetAmounts: number[];
  minCustomAmount: number;
  recipientEmailLabel: string;
  senderNameLabel: string;
  messageLabel: string;
  proceedButtonLabel: string;
  proceedingButtonLabel: string;
  paymentTitle: string;
  backToConfigLabel: string;
  paymentNote: string;
  successTitle: string;
  successMessagePrefix: string;
  resetButtonLabel: string;
}

export interface PricingPageContent {
  badge: string;
  title: string;
  subtitle: string;
  mostPopularBadge: string;
  selectPlanLabel: string;
  customQuoteTitle: string;
  customQuoteBody: string;
  customQuoteButtonLabel: string;
  customQuoteButtonPath: string;
  highlightServiceId: string;
}

export interface NavigationItem {
  label: string;
  path: string;
  enabled: boolean;
}

export interface NavigationContent {
  primaryLinks: NavigationItem[];
  secondaryLinks: NavigationItem[];
  bookingCtaLabel: string;
  bookingCtaPath: string;
}

export interface SiteSettingsContent {
  businessName: string;
  serviceNotice: string;
  contactEmail: string;
  contactPhone: string;
  topBarHours: string;
  address: string;
  instagramUrl: string;
  tiktokUrl: string;
  footerTagline: string;
}
