import type { SupabaseClient } from '@supabase/supabase-js';
import { getOfferingById } from '../../lib/serviceCatalog';
import type { ServiceOffering, ServicesPageContent } from '../../types/cms';
import { getServicesContentForBooking } from './booking';

export interface PublicBookingRecord {
  enquiry: Record<string, any>;
  lead: Record<string, any> | null;
  serviceJob: Record<string, any> | null;
  client: Record<string, any> | null;
  assets: Array<Record<string, any>>;
  primaryService: ServiceOffering | null;
  addOns: ServiceOffering[];
  servicesContent: ServicesPageContent;
}

export const getBookingByReference = async (
  supabase: SupabaseClient,
  reference: string
): Promise<PublicBookingRecord | null> => {
  const { data: enquiry, error } = await supabase
    .from('enquiries')
    .select('*')
    .eq('booking_reference', reference)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!enquiry) return null;

  const servicesContent = await getServicesContentForBooking();
  const { data: lead } = await supabase
    .from('leads')
    .select('*')
    .eq('enquiry_id', enquiry.id)
    .maybeSingle();
  const { data: serviceJob } = await supabase
    .from('service_jobs')
    .select('*')
    .eq('booking_reference', reference)
    .maybeSingle();
  const clientId = serviceJob?.client_id || null;
  const { data: client } = clientId
    ? await supabase.from('clients').select('*').eq('id', clientId).maybeSingle()
    : { data: null };
  const { data: assets } = await supabase
    .from('booking_assets')
    .select('*')
    .eq('enquiry_id', enquiry.id)
    .order('created_at', { ascending: true });

  const primaryService = getOfferingById(servicesContent, enquiry.service_catalog_id);
  const addOns = (enquiry.service_addon_ids || [])
    .map((id: string) => getOfferingById(servicesContent, id))
    .filter(Boolean) as ServiceOffering[];

  return {
    enquiry,
    lead: lead || null,
    serviceJob: serviceJob || null,
    client: client || null,
    assets: assets || [],
    primaryService,
    addOns,
    servicesContent,
  };
};
