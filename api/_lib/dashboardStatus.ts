export type LeadUiStatus = 'new_lead' | 'booked' | 'service_completed' | 'closed_lost';
export type JobUiStatus = 'scheduled' | 'completed' | 'cancelled';

const leadUiMap: Record<string, LeadUiStatus> = {
  lead: 'new_lead',
  contacted: 'new_lead',
  quoted: 'new_lead',
  booked: 'booked',
  in_service: 'booked',
  completed: 'service_completed',
  closed_lost: 'closed_lost',
};

const leadUiToInternalMap: Record<LeadUiStatus, string[]> = {
  new_lead: ['lead', 'contacted', 'quoted'],
  booked: ['booked', 'in_service'],
  service_completed: ['completed'],
  closed_lost: ['closed_lost'],
};

const jobUiMap: Record<string, JobUiStatus> = {
  booked: 'scheduled',
  in_service: 'scheduled',
  completed: 'completed',
  cancelled: 'cancelled',
};

const jobUiToInternalMap: Record<JobUiStatus, string[]> = {
  scheduled: ['booked', 'in_service'],
  completed: ['completed'],
  cancelled: ['cancelled'],
};

export const mapLeadToUiStatus = (status?: string | null): LeadUiStatus => {
  if (!status) return 'new_lead';
  return leadUiMap[status] || 'new_lead';
};

export const mapLeadUiStatusToInternal = (status?: string | null): string[] => {
  if (!status) return [];
  if (status in leadUiToInternalMap) {
    return leadUiToInternalMap[status as LeadUiStatus];
  }
  return [status];
};

export const mapLeadUiStatusToSingleInternal = (status?: string | null): string => {
  const mapped = mapLeadUiStatusToInternal(status);
  return mapped[0] || 'lead';
};

export const mapJobToUiStatus = (status?: string | null): JobUiStatus => {
  if (!status) return 'scheduled';
  return jobUiMap[status] || 'scheduled';
};

export const mapJobUiStatusToInternal = (status?: string | null): string[] => {
  if (!status) return [];
  if (status in jobUiToInternalMap) {
    return jobUiToInternalMap[status as JobUiStatus];
  }
  return [status];
};

export const mapJobUiStatusToSingleInternal = (status?: string | null): string => {
  const mapped = mapJobUiStatusToInternal(status);
  return mapped[0] || 'booked';
};
