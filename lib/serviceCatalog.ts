import type {
  DetailingPackageRow,
  ServiceOffering,
  ServiceOfferingCategory,
  ServicesPageContent,
} from '../types/cms';

const categoryOrder: ServiceOfferingCategory[] = [
  'detailing',
  'maintenance',
  'protection',
  'tint',
  'restoration',
  'add_on',
];

const categoryLabels: Record<ServiceOfferingCategory, string> = {
  detailing: 'Detailing',
  maintenance: 'Maintenance',
  protection: 'Protection',
  tint: 'Window Tinting',
  restoration: 'Restoration',
  add_on: 'Additional Services',
};

export interface ResolvedDetailingPackage {
  vehicleType: string;
  fullDetail: ServiceOffering | null;
  interiorOnly: ServiceOffering | null;
}

export const getOfferingLookup = (content: ServicesPageContent) => {
  return new Map(
    [...content.detailingOfferings, ...content.specialtyServices, ...content.additionalServices].map(
      (offering) => [offering.id, offering] as const
    )
  );
};

export const resolveDetailingPackages = (content: ServicesPageContent): ResolvedDetailingPackage[] => {
  const lookup = getOfferingLookup(content);
  return content.detailingPackages.map((item: DetailingPackageRow) => ({
    vehicleType: item.vehicleType,
    fullDetail: lookup.get(item.fullDetailId) || null,
    interiorOnly: lookup.get(item.interiorOnlyId) || null,
  }));
};

export const getPrimaryOfferings = (content: ServicesPageContent): ServiceOffering[] => {
  return [...content.detailingOfferings, ...content.specialtyServices, ...content.additionalServices].filter(
    (offering) => offering.bookable && !offering.addOnOnly
  );
};

export const getAddOnOfferings = (content: ServicesPageContent): ServiceOffering[] => {
  return content.additionalServices.filter((offering) => offering.bookable && offering.addOnOnly);
};

export const getFeaturedOfferings = (content: ServicesPageContent): ServiceOffering[] => {
  const lookup = getOfferingLookup(content);
  const resolved = content.featuredOfferingIds
    .map((id) => lookup.get(id) || null)
    .filter(Boolean) as ServiceOffering[];

  if (resolved.length) return resolved;
  return getPrimaryOfferings(content).slice(0, 3);
};

export const getOfferingById = (
  content: ServicesPageContent,
  offeringId?: string | null
): ServiceOffering | null => {
  if (!offeringId) return null;
  return getOfferingLookup(content).get(offeringId) || null;
};

export const findOfferingByTitle = (
  content: ServicesPageContent,
  title?: string | null
): ServiceOffering | null => {
  if (!title) return null;
  const normalized = title.trim().toLowerCase();
  return (
    [...content.detailingOfferings, ...content.specialtyServices, ...content.additionalServices].find(
      (offering) => offering.title.trim().toLowerCase() === normalized
    ) || null
  );
};

export const buildServiceLabel = (
  primaryOffering: ServiceOffering | null,
  addOns: ServiceOffering[] = [],
  fallback?: string | null
) => {
  if (!primaryOffering) return fallback || '';
  if (!addOns.length) return primaryOffering.title;
  return `${primaryOffering.title} + ${addOns.map((offering) => offering.title).join(' + ')}`;
};

export const resolveServiceDisplay = (
  content: ServicesPageContent,
  primaryOfferingId?: string | null,
  addOnIds?: string[] | null,
  fallback?: string | null
) => {
  const primaryOffering = getOfferingById(content, primaryOfferingId);
  if (!primaryOffering) return fallback || '-';
  const addOns = (addOnIds || [])
    .map((id) => getOfferingById(content, id))
    .filter(Boolean) as ServiceOffering[];
  return buildServiceLabel(primaryOffering, addOns, fallback);
};

export const groupOfferingsByCategory = (offerings: ServiceOffering[]) => {
  const groups = new Map<ServiceOfferingCategory, ServiceOffering[]>();
  offerings.forEach((offering) => {
    const existing = groups.get(offering.category) || [];
    existing.push(offering);
    groups.set(offering.category, existing);
  });

  return categoryOrder
    .filter((category) => groups.has(category))
    .map((category) => ({
      category,
      label: categoryLabels[category],
      offerings: groups.get(category) || [],
    }));
};
