import type { StructureResolver } from 'sanity/structure';

const singletonItems = [
  { id: 'siteSettings', title: 'Site Settings', schemaType: 'siteSettings' },
  { id: 'navigationConfig', title: 'Navigation Config', schemaType: 'navigationConfig' },
  { id: 'homePage', title: 'Home Page', schemaType: 'homePage' },
  { id: 'servicesPage', title: 'Services Page', schemaType: 'servicesPage' },
  { id: 'pricingPage', title: 'Pricing Page', schemaType: 'pricingPage' },
  { id: 'fleetPage', title: 'Fleet Page', schemaType: 'fleetPage' },
  { id: 'galleryPage', title: 'Gallery Page', schemaType: 'galleryPage' },
  { id: 'aboutPage', title: 'About Page', schemaType: 'aboutPage' },
  { id: 'faqPage', title: 'FAQ Page', schemaType: 'faqPage' },
  { id: 'contactPage', title: 'Contact Page', schemaType: 'contactPage' },
  { id: 'autoRepairPage', title: 'Auto Repair Page', schemaType: 'autoRepairPage' },
  { id: 'giftCardsPage', title: 'Gift Cards Page', schemaType: 'giftCardsPage' },
] as const;

export const singletonTypes: Set<string> = new Set(singletonItems.map((item) => item.schemaType));

export const structure: StructureResolver = (S) =>
  S.list()
    .title('Website Content')
    .items([
      ...singletonItems.map((item) =>
        S.listItem()
          .title(item.title)
          .id(item.id)
          .child(S.document().schemaType(item.schemaType).documentId(item.id))
      ),
      S.divider(),
      S.documentTypeListItem('promoPlacement').title('Promo Placements'),
    ]);
