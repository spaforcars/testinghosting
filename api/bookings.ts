import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  BOOKING_CAPACITY_CONFLICT_MESSAGE,
  buildManageLink,
  checkInstantBookingCapacity,
  createBookingReference,
  createManageToken,
  getBookingServiceSelection,
  getBookingSettings,
  getScheduledEndAt,
  getServiceDurationMinutes,
  hashManageToken,
  listAvailableSlots,
} from './_lib/booking';
import { notifyRoles } from './_lib/inAppNotifications';
import {
  getOpsEmailsEnabled,
  getOpsNotificationRecipients,
  sendBookingConfirmationEmail,
  sendBookingRequestAcknowledgementEmail,
  sendEnquiryAlertEmail,
} from './_lib/notifications';
import { getSupabaseAdmin } from './_lib/supabaseAdmin';
import { badRequest, methodNotAllowed, serverError } from './_lib/http';
import { writeAuditLog } from './_lib/audit';
import { normalizeServiceAddonIds, normalizeServiceCatalogId } from './_lib/serviceSelection';
import { getAppBaseUrl } from './_lib/appBaseUrl';

type BookingAssetInput = {
  path: string;
  bucket?: string;
  originalFilename?: string;
  contentType?: string;
  sizeBytes?: number;
};

type PickupAddress = {
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  notes?: string;
};

type BookingBody = {
  serviceId?: string;
  addOnIds?: string[];
  vehicleType?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleYear?: number;
  vehicleDescription?: string;
  issueDetails?: string;
  notes?: string;
  scheduledAt?: string;
  preferredDate?: string;
  preferredDateTo?: string;
  preferredTimeWindow?: string;
  pickupRequested?: boolean;
  pickupAddress?: PickupAddress;
  assets?: BookingAssetInput[];
  sourcePage?: string;
  contact?: {
    fullName?: string;
    email?: string;
    phone?: string;
  };
};

const trim = (value?: string | null) => (typeof value === 'string' ? value.trim() : '');

const buildServiceType = (primary: string, addOns: string[]) => {
  if (!addOns.length) return primary;
  return `${primary} + ${addOns.join(' + ')}`;
};

const buildRequestSummary = (body: BookingBody) => {
  const parts = [
    body.preferredDate ? `Preferred date: ${body.preferredDate}` : '',
    body.preferredDateTo ? `Backup date: ${body.preferredDateTo}` : '',
    body.preferredTimeWindow ? `Time window: ${body.preferredTimeWindow}` : '',
  ].filter(Boolean);
  return parts.join(' | ');
};

const getMissingColumnFromError = (message: string): string | null => {
  const schemaCacheMatch = message.match(/Could not find the '([^']+)' column/i);
  if (schemaCacheMatch) return schemaCacheMatch[1];

  const missingColumnMatch = message.match(/column\s+(?:[a-z0-9_]+\.)?([a-z0-9_]+)\s+does not exist/i);
  if (missingColumnMatch) return missingColumnMatch[1];

  return null;
};

const isMissingTableError = (message: string, table: string) =>
  message.includes(`Could not find the table 'public.${table}'`) ||
  new RegExp(`relation ["']?public\\.${table}["']? does not exist`, 'i').test(message);

const insertWithSchemaFallback = async (
  supabase: ReturnType<typeof getSupabaseAdmin>,
  table: string,
  payload: Record<string, unknown>
) => {
  const currentPayload: Record<string, unknown> = { ...payload };

  for (;;) {
    const { data, error } = await supabase.from(table).insert(currentPayload).select('*').single();
    if (!error && data) {
      return data;
    }

    const message = error?.message || `Failed to insert into ${table}`;
    const missingColumn = getMissingColumnFromError(message);
    if (!missingColumn || !(missingColumn in currentPayload)) {
      throw new Error(message);
    }

    delete currentPayload[missingColumn];
  }
};

const findOrCreateClient = async (
  supabase: ReturnType<typeof getSupabaseAdmin>,
  contact: { fullName: string; email: string; phone: string }
) => {
  let client =
    (
      contact.email
        ? await supabase.from('clients').select('*').eq('email', contact.email).limit(1).maybeSingle()
        : { data: null, error: null }
    ).data || null;

  if (!client && contact.phone) {
    client =
      (
        await supabase.from('clients').select('*').eq('phone', contact.phone).limit(1).maybeSingle()
      ).data || null;
  }

  if (client) {
    const updates: Record<string, unknown> = {};
    if (!client.name && contact.fullName) updates.name = contact.fullName;
    if (!client.email && contact.email) updates.email = contact.email;
    if (!client.phone && contact.phone) updates.phone = contact.phone;
    if (Object.keys(updates).length) {
      const { data } = await supabase
        .from('clients')
        .update(updates)
        .eq('id', client.id)
        .select('*')
        .single();
      client = data || client;
    }
    return client;
  }

  const data = await insertWithSchemaFallback(supabase, 'clients', {
    name: contact.fullName,
    email: contact.email,
    phone: contact.phone,
    archived: false,
  });

  return data;
};

const ensureCustomerVehicle = async (
  supabase: ReturnType<typeof getSupabaseAdmin>,
  clientId: string,
  vehicle: { make?: string; model?: string; year?: number | null; notes?: string }
) => {
  if (!vehicle.make && !vehicle.model && !vehicle.year) return null;

  const { data: existing, error: existingError } = await supabase
    .from('customer_vehicles')
    .select('*')
    .eq('client_id', clientId)
    .eq('make', vehicle.make || null)
    .eq('model', vehicle.model || null)
    .eq('year', vehicle.year || null)
    .limit(1)
    .maybeSingle();

  if (existingError) {
    if (isMissingTableError(existingError.message, 'customer_vehicles')) {
      return null;
    }
    throw new Error(existingError.message);
  }

  if (existing) return existing;

  const { data, error } = await supabase
    .from('customer_vehicles')
    .insert({
      client_id: clientId,
      make: vehicle.make || null,
      model: vehicle.model || null,
      year: vehicle.year || null,
      notes: vehicle.notes || null,
    })
    .select('*')
    .single();

  if (error && isMissingTableError(error.message, 'customer_vehicles')) {
    return null;
  }
  if (error) throw new Error(error.message);
  return data;
};

const finalizeNotificationEvent = async (
  supabase: ReturnType<typeof getSupabaseAdmin>,
  eventId: string | null,
  result: { success: boolean; providerId?: string; error?: string }
) => {
  if (!eventId) return;
  if (result.success) {
    await supabase
      .from('notification_events')
      .update({
        status: 'sent',
        attempt_count: 1,
        sent_at: new Date().toISOString(),
        provider_message_id: result.providerId || null,
        last_error: null,
        next_retry_at: null,
      })
      .eq('id', eventId);
    return;
  }

  await supabase
    .from('notification_events')
    .update({
      status: 'failed',
      attempt_count: 1,
      last_error: result.error || 'Notification failed',
      next_retry_at: new Date(Date.now() + 60_000).toISOString(),
    })
    .eq('id', eventId);
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return methodNotAllowed(res);

  try {
    const body = (req.body || {}) as BookingBody;
    const contact = {
      fullName: trim(body.contact?.fullName),
      email: trim(body.contact?.email),
      phone: trim(body.contact?.phone),
    };

    if (!body.serviceId || !contact.fullName || !contact.email || !contact.phone || !trim(body.vehicleType)) {
      return badRequest(res, 'serviceId, vehicleType, contact.fullName, contact.email, and contact.phone are required');
    }

    const addOnIds = normalizeServiceAddonIds(body.addOnIds);
    const selection = await getBookingServiceSelection(body.serviceId, addOnIds);
    if (!selection) {
      return badRequest(res, 'Selected service is not available');
    }

    const supabase = getSupabaseAdmin();
    const settings = await getBookingSettings(supabase);
    const bookingMode = selection.primaryService.bookingMode;

    let scheduledAt: string | null = null;
    if (bookingMode === 'instant') {
      if (!body.scheduledAt) {
        return badRequest(res, 'scheduledAt is required for instant bookings');
      }

      const requestedSlot = new Date(body.scheduledAt);
      if (Number.isNaN(requestedSlot.getTime())) {
        return badRequest(res, 'scheduledAt must be a valid ISO timestamp');
      }

      const capacity = await checkInstantBookingCapacity(supabase, {
        serviceId: selection.primaryService.id,
        addOnIds,
        scheduledAt: requestedSlot.toISOString(),
      });

      if (!capacity.isAvailable) {
        return res.status(409).json({ error: BOOKING_CAPACITY_CONFLICT_MESSAGE });
      }

      const dateKey = new Intl.DateTimeFormat('en-CA', {
        timeZone: settings.timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
        .format(requestedSlot)
        .replaceAll('/', '-');

      const availability = await listAvailableSlots(supabase, {
        serviceId: selection.primaryService.id,
        addOnIds,
        dateKey,
      });

      const matchedSlot = availability.slots.find(
        (slot) => slot.startAt === requestedSlot.toISOString() && slot.status === 'available'
      );
      if (!matchedSlot) {
        return res.status(409).json({ error: BOOKING_CAPACITY_CONFLICT_MESSAGE });
      }

      scheduledAt = capacity.slot.startAt;
    }

    if (bookingMode === 'request' && !trim(body.issueDetails) && !trim(body.notes)) {
      return badRequest(res, 'issueDetails or notes are required for request bookings');
    }

    const bookingReference = createBookingReference();
    const manageToken = createManageToken();
    const manageTokenHash = hashManageToken(manageToken);
    const manageTokenExpiresAt = new Date(
      Date.now() + settings.manageTokenValidityHours * 60 * 60 * 1000
    ).toISOString();
    const manageLink = buildManageLink(getAppBaseUrl(req), bookingReference, manageToken);

    const serviceType = buildServiceType(
      selection.primaryService.title,
      selection.addOns.map((service) => service.title)
    );
    const preferredSummary = buildRequestSummary(body);
    const vehicleNotes = [trim(body.vehicleType), trim(body.vehicleDescription)].filter(Boolean).join(' | ');
    const bookingStatus = bookingMode === 'instant' ? 'confirmed' : 'requested';

    const metadata = {
      bookingReference,
      bookingMode,
      vehicle: {
        type: trim(body.vehicleType),
        make: trim(body.vehicleMake) || null,
        model: trim(body.vehicleModel) || null,
        year: typeof body.vehicleYear === 'number' ? body.vehicleYear : null,
        description: trim(body.vehicleDescription) || null,
      },
      timing:
        bookingMode === 'instant'
          ? {
              scheduledAt,
              timeZone: settings.timeZone,
            }
          : {
              preferredDate: trim(body.preferredDate) || null,
              preferredDateTo: trim(body.preferredDateTo) || null,
              preferredTimeWindow: trim(body.preferredTimeWindow) || null,
            },
      pickup: {
        requested: Boolean(body.pickupRequested && selection.primaryService.allowsPickupRequest),
        address: body.pickupRequested ? body.pickupAddress || null : null,
      },
      issueDetails: trim(body.issueDetails) || null,
      notes: trim(body.notes) || null,
      selectedServiceId: selection.primaryService.id,
      selectedServiceTitle: selection.primaryService.title,
      selectedAddOnIds: addOnIds,
      selectedAddOnTitles: selection.addOns.map((service) => service.title),
      assets: (body.assets || []).map((asset) => ({
        path: asset.path,
        bucket: asset.bucket || null,
        originalFilename: asset.originalFilename || null,
        contentType: asset.contentType || null,
        sizeBytes: typeof asset.sizeBytes === 'number' ? asset.sizeBytes : null,
      })),
    };

    const message =
      bookingMode === 'instant'
        ? `Confirmed public booking for ${serviceType}${vehicleNotes ? ` | ${vehicleNotes}` : ''}`
        : [trim(body.issueDetails), trim(body.notes), preferredSummary].filter(Boolean).join('\n\n') ||
          `Booking request for ${serviceType}`;

    const enquiry = await insertWithSchemaFallback(supabase, 'enquiries', {
        name: contact.fullName,
        email: contact.email,
        phone: contact.phone,
        message,
        service_type: serviceType,
        service_catalog_id: normalizeServiceCatalogId(selection.primaryService.id),
        service_addon_ids: addOnIds.length ? addOnIds : null,
        source_page: body.sourcePage || 'booking',
        metadata,
        booking_reference: bookingReference,
        booking_mode: bookingMode,
        status: bookingStatus,
        public_manage_token_hash: manageTokenHash,
        public_manage_token_expires_at: manageTokenExpiresAt,
        updated_at: new Date().toISOString(),
      });

    const intakeMetadata = {
      bookingReference,
      preferredSummary: preferredSummary || null,
      pickupRequested: Boolean(body.pickupRequested && selection.primaryService.allowsPickupRequest),
      pickupAddress: body.pickupRequested ? body.pickupAddress || null : null,
      issueDetails: trim(body.issueDetails) || null,
      notes: trim(body.notes) || null,
      vehicleType: trim(body.vehicleType),
      vehicleDescription: trim(body.vehicleDescription) || null,
      assetPaths: (body.assets || []).map((asset) => asset.path),
      manageLinkSent: true,
    };

    const leadStatus = bookingMode === 'instant' ? 'booked' : 'lead';
    const lead = await insertWithSchemaFallback(supabase, 'leads', {
        enquiry_id: enquiry.id,
        name: contact.fullName,
        email: contact.email,
        phone: contact.phone,
        service_type: serviceType,
        service_catalog_id: enquiry.service_catalog_id,
        service_addon_ids: enquiry.service_addon_ids,
        source_page: enquiry.source_page,
        status: leadStatus,
        vehicle_make: trim(body.vehicleMake) || null,
        vehicle_model: trim(body.vehicleModel) || null,
        vehicle_year: typeof body.vehicleYear === 'number' ? body.vehicleYear : null,
        booking_mode: bookingMode,
        intake_metadata: intakeMetadata,
      });

    if (body.assets?.length) {
      const bookingAssets = body.assets
        .filter((asset) => trim(asset.path))
        .map((asset) => ({
          enquiry_id: enquiry.id,
          lead_id: lead.id,
          storage_bucket: asset.bucket || process.env.BOOKING_ASSET_BUCKET || 'booking-assets',
          storage_path: asset.path,
          original_filename: asset.originalFilename || null,
          content_type: asset.contentType || null,
          size_bytes: typeof asset.sizeBytes === 'number' ? asset.sizeBytes : null,
        }));

      if (bookingAssets.length) {
        const { error: assetsError } = await supabase.from('booking_assets').insert(bookingAssets);
        if (assetsError && !isMissingTableError(assetsError.message, 'booking_assets')) {
          throw new Error(assetsError.message);
        }
      }
    }

    let clientId: string | null = null;
    let serviceJobId: string | null = null;

    if (bookingMode === 'instant' && scheduledAt) {
      const client = await findOrCreateClient(supabase, contact);
      clientId = client.id;

      await ensureCustomerVehicle(supabase, client.id, {
        make: trim(body.vehicleMake) || undefined,
        model: trim(body.vehicleModel) || undefined,
        year: typeof body.vehicleYear === 'number' ? body.vehicleYear : null,
        notes: vehicleNotes || undefined,
      });

      const estimatedAmount =
        (selection.primaryService.fixedPriceAmount || 0) +
        selection.addOns.reduce((sum, addOn) => sum + (addOn.fixedPriceAmount || 0), 0);
      const scheduledEndAt = getScheduledEndAt(
        scheduledAt,
        selection.primaryService,
        selection.addOns,
        settings
      );

      const serviceJob = await insertWithSchemaFallback(supabase, 'service_jobs', {
          lead_id: lead.id,
          client_id: client.id,
          client_name: client.name || contact.fullName,
          service_type: serviceType,
          service_catalog_id: enquiry.service_catalog_id,
          service_addon_ids: enquiry.service_addon_ids,
          status: 'booked',
          scheduled_at: scheduledAt,
          scheduled_end_at: scheduledEndAt,
          notes: trim(body.notes) || trim(body.issueDetails) || null,
          vehicle_make: trim(body.vehicleMake) || null,
          vehicle_model: trim(body.vehicleModel) || null,
          vehicle_year: typeof body.vehicleYear === 'number' ? body.vehicleYear : null,
          estimated_amount: estimatedAmount,
          payment_status: 'unpaid',
          booking_source: 'public',
          booking_reference: bookingReference,
          pickup_requested: Boolean(body.pickupRequested && selection.primaryService.allowsPickupRequest),
          pickup_address:
            body.pickupRequested && selection.primaryService.allowsPickupRequest
              ? body.pickupAddress || {}
              : null,
        });

      serviceJobId = serviceJob.id;

      await supabase.from('job_timeline_events').insert({
        service_job_id: serviceJob.id,
        lead_id: lead.id,
        client_id: client.id,
        event_type: 'public_booking_created',
        note: 'Service job created from public booking flow',
        metadata: {
          bookingReference,
          scheduledAt,
          durationMinutes: getServiceDurationMinutes(selection.primaryService, selection.addOns),
        },
        created_by: null,
      });
    }

    const { data: notificationEvent } = await supabase
      .from('notification_events')
      .insert({
        event_type: 'enquiry_created',
        entity_id: enquiry.id,
        metadata: {
          source: 'booking',
          bookingReference,
          bookingMode,
        },
        provider: 'resend',
        status: 'queued',
        attempt_count: 0,
      })
      .select('id')
      .single();

    let emailStatus: 'sent' | 'failed' | 'disabled' = 'disabled';
    let notificationError: string | null = null;
    if (await getOpsEmailsEnabled(supabase)) {
      const recipients = await getOpsNotificationRecipients(supabase);
      const alertResult = await sendEnquiryAlertEmail(recipients, {
        enquiryId: enquiry.id,
        name: enquiry.name,
        email: enquiry.email,
        phone: enquiry.phone,
        message: enquiry.message,
        serviceType: enquiry.service_type,
        sourcePage: enquiry.source_page,
        createdAt: enquiry.created_at,
        bookingReference,
        bookingMode,
        bookingStatus,
        scheduledAt,
        timeZone: settings.timeZone,
        preferredSummary,
        vehicleType: trim(body.vehicleType),
        vehicleMake: trim(body.vehicleMake) || null,
        vehicleModel: trim(body.vehicleModel) || null,
        vehicleYear: typeof body.vehicleYear === 'number' ? body.vehicleYear : null,
        vehicleDescription: trim(body.vehicleDescription) || null,
        pickupRequested: Boolean(body.pickupRequested && selection.primaryService.allowsPickupRequest),
        issueDetails: trim(body.issueDetails) || null,
        notes: trim(body.notes) || null,
        addOnTitles: selection.addOns.map((service) => service.title),
        assetCount: body.assets?.length || 0,
        manageLink,
      });
      emailStatus = alertResult.success ? 'sent' : 'failed';
      notificationError = alertResult.success ? null : alertResult.error || 'Failed to send booking alert';
      await finalizeNotificationEvent(supabase, notificationEvent?.id || null, alertResult);
    }

    const customerEmailResult =
      bookingMode === 'instant' && scheduledAt
        ? await sendBookingConfirmationEmail({
            to: contact.email,
            customerName: contact.fullName,
            bookingReference,
            serviceName: serviceType,
            scheduledAt,
            timeZone: settings.timeZone,
            manageLink,
            pickupRequested: Boolean(body.pickupRequested && selection.primaryService.allowsPickupRequest),
          })
        : await sendBookingRequestAcknowledgementEmail({
            to: contact.email,
            customerName: contact.fullName,
            bookingReference,
            serviceName: serviceType,
            responseSla: settings.requestResponseSla,
            preferredSummary,
            manageLink,
            pickupRequested: Boolean(body.pickupRequested && selection.primaryService.allowsPickupRequest),
          });

    await writeAuditLog(supabase, {
      action: 'create',
      module: 'bookings',
      entityType: 'enquiry',
      entityId: enquiry.id,
      details: {
        bookingReference,
        bookingMode,
        leadId: lead.id,
        clientId,
        serviceJobId,
        emailStatus,
        customerEmailSent: customerEmailResult.success,
      },
    });

    await notifyRoles(supabase, ['super_admin', 'admin', 'staff'], {
      category: 'enquiry',
      title: bookingMode === 'instant' ? 'New confirmed booking' : 'New booking request',
      message:
        bookingMode === 'instant'
          ? `${contact.fullName} booked ${serviceType}.`
          : `${contact.fullName} requested ${serviceType}.`,
      entityType: 'lead',
      entityId: lead.id,
      metadata: {
        enquiryId: enquiry.id,
        bookingReference,
        bookingMode,
        serviceJobId,
      },
    });

    return res.status(200).json({
      enquiryId: enquiry.id,
      leadId: lead.id,
      serviceJobId,
      bookingReference,
      bookingMode,
      status: bookingStatus,
      scheduledAt,
      manageUrl: manageLink,
      emailStatus,
      notificationError,
      customerEmailStatus: customerEmailResult.success ? 'sent' : 'failed',
      customerEmailError: customerEmailResult.success ? null : customerEmailResult.error || null,
    });
  } catch (error) {
    console.error('Booking creation failed:', error);
    return serverError(res, error);
  }
}
