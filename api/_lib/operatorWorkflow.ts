import type { Lead, ServiceJob } from '../../types/platform';

export type OperatorAgingState = 'fresh' | 'needs_follow_up' | 'urgent';
export type LeadSourceGroup = 'fleet' | 'contact' | 'booking' | 'all';

const readString = (value: unknown) => (typeof value === 'string' ? value : '');
const readRecord = (value: unknown) =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const toDate = (value: unknown) => {
  if (typeof value !== 'string' || !value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const diffHours = (value: Date, now: Date) => (now.getTime() - value.getTime()) / 3_600_000;

export const getLeadSourceGroup = (
  lead: Pick<Lead, 'source_page' | 'booking_mode' | 'service_type' | 'intake_metadata'>
): Exclude<LeadSourceGroup, 'all'> => {
  const sourcePage = readString(lead.source_page).toLowerCase();
  const serviceType = readString(lead.service_type).toLowerCase();
  const metadata = readRecord(lead.intake_metadata);

  if (
    sourcePage === 'fleet' ||
    serviceType.includes('fleet proposal') ||
    Boolean(readString(metadata.companyName))
  ) {
    return 'fleet';
  }

  if (readString(lead.booking_mode) === 'instant' || readString(lead.booking_mode) === 'request' || sourcePage === 'booking') {
    return 'booking';
  }

  return 'contact';
};

export const getLeadReviewState = (lead: Pick<Lead, 'intake_metadata'>) => {
  const review = readRecord(readRecord(lead.intake_metadata).dashboardReview);
  return {
    reviewedAt: readString(review.reviewedAt) || null,
    reviewedBy: readString(review.reviewedBy) || null,
    isReviewed: Boolean(readString(review.reviewedAt)),
  };
};

export const getLeadOperatorMeta = (
  lead: Pick<Lead, 'status' | 'created_at' | 'booking_mode' | 'source_page' | 'service_type' | 'intake_metadata' | 'assignee_id'>,
  now = new Date()
) => {
  const createdAt = toDate(lead.created_at);
  const hoursOpen = createdAt ? diffHours(createdAt, now) : 0;
  const sourceGroup = getLeadSourceGroup(lead);
  const review = getLeadReviewState(lead);
  const isOpenLead = ['lead', 'contacted', 'quoted'].includes(readString(lead.status));
  const isRequest = readString(lead.booking_mode) === 'request';
  const isUnassigned = !readString(lead.assignee_id);

  let agingState: OperatorAgingState = 'fresh';
  if (isOpenLead) {
    if (hoursOpen >= 24 || (isRequest && hoursOpen >= 24)) {
      agingState = 'urgent';
    } else if (hoursOpen >= 4 || isRequest || isUnassigned) {
      agingState = 'needs_follow_up';
    }
  }

  let followUpReason = '';
  if (isRequest) {
    followUpReason = 'Booking request is still waiting for confirmation';
  } else if (sourceGroup === 'fleet') {
    followUpReason = 'Fleet proposal needs a tailored response';
  } else if (sourceGroup === 'contact') {
    followUpReason = 'Customer enquiry needs a reply';
  } else if (isOpenLead) {
    followUpReason = 'Lead still needs qualification or booking';
  }
  if (isUnassigned && isOpenLead) {
    followUpReason = followUpReason ? `${followUpReason} and has no owner` : 'Lead is open and unassigned';
  }

  return {
    hoursOpen,
    agingState,
    followUpReason,
    sourceGroup,
    isUnassigned,
    isReviewed: review.isReviewed,
    reviewedAt: review.reviewedAt,
    reviewedBy: review.reviewedBy,
  };
};

export const getJobOperatorMeta = (
  job: Pick<ServiceJob, 'scheduled_at' | 'ui_status' | 'payment_status' | 'assignee_id' | 'pickup_requested'>,
  now = new Date()
) => {
  const scheduledAt = toDate(job.scheduled_at);
  const isScheduled = readString(job.ui_status) === 'scheduled';
  const isUnassigned = !readString(job.assignee_id);
  const isOverdue = Boolean(scheduledAt && scheduledAt.getTime() < now.getTime() && isScheduled);
  const needsPaymentFollowUp = Boolean(
    scheduledAt &&
      scheduledAt.getTime() < now.getTime() &&
      isScheduled &&
      readString(job.payment_status || 'unpaid') !== 'paid'
  );
  const dueWithin48Hours = Boolean(
    scheduledAt &&
      scheduledAt.getTime() >= now.getTime() &&
      scheduledAt.getTime() - now.getTime() <= 48 * 3_600_000
  );

  let agingState: OperatorAgingState = 'fresh';
  if (needsPaymentFollowUp) {
    agingState = 'urgent';
  } else if ((isUnassigned && dueWithin48Hours) || (isOverdue && isScheduled)) {
    agingState = 'needs_follow_up';
  }

  let followUpReason = '';
  if (needsPaymentFollowUp) {
    followUpReason = 'Past appointment is still marked unpaid';
  } else if (isUnassigned && dueWithin48Hours) {
    followUpReason = 'Near-term appointment is still unassigned';
  } else if (isOverdue && isScheduled) {
    followUpReason = 'Scheduled time has passed';
  } else if (Boolean(job.pickup_requested)) {
    followUpReason = 'Pickup logistics need confirmation';
  }

  return {
    agingState,
    followUpReason,
    isUnassigned,
    isOverdue,
    needsPaymentFollowUp,
  };
};

export const compareOperatorJobs = (
  left: Pick<ServiceJob, 'scheduled_at'> & ReturnType<typeof getJobOperatorMeta>,
  right: Pick<ServiceJob, 'scheduled_at'> & ReturnType<typeof getJobOperatorMeta>
) => {
  const weight = (job: ReturnType<typeof getJobOperatorMeta>) => {
    if (job.needsPaymentFollowUp) return 0;
    if (job.isUnassigned && job.agingState !== 'fresh') return 1;
    if (job.isOverdue) return 2;
    if (job.agingState === 'needs_follow_up') return 3;
    return 4;
  };

  const leftWeight = weight(left);
  const rightWeight = weight(right);
  if (leftWeight !== rightWeight) return leftWeight - rightWeight;

  const leftTime = toDate(left.scheduled_at)?.getTime() || Number.MAX_SAFE_INTEGER;
  const rightTime = toDate(right.scheduled_at)?.getTime() || Number.MAX_SAFE_INTEGER;
  return leftTime - rightTime;
};
