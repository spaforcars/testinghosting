export type LeadStatus =
  | 'lead'
  | 'contacted'
  | 'quoted'
  | 'booked'
  | 'in_service'
  | 'completed'
  | 'closed_lost';

export type LeadUiStatus = 'new_lead' | 'booked' | 'service_completed' | 'closed_lost';
export type JobUiStatus = 'scheduled' | 'completed' | 'cancelled';
export type JobPaymentStatus = 'unpaid' | 'paid';
export type OperatorAgingState = 'fresh' | 'needs_follow_up' | 'urgent';
export type LeadSourceGroup = 'fleet' | 'contact' | 'booking';

export type NotificationStatus = 'queued' | 'sent' | 'failed';

export interface Enquiry {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  message: string;
  service_type?: string | null;
  service_catalog_id?: string | null;
  service_addon_ids?: string[] | null;
  source_page: string;
  metadata?: Record<string, unknown> | null;
  booking_reference?: string | null;
  booking_mode?: 'instant' | 'request' | null;
  status?: 'requested' | 'confirmed' | 'cancelled' | null;
  public_manage_token_expires_at?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface Lead {
  id: string;
  enquiry_id?: string | null;
  name: string;
  email: string;
  phone?: string | null;
  service_type?: string | null;
  service_catalog_id?: string | null;
  service_addon_ids?: string[] | null;
  source_page: string;
  status: LeadStatus;
  ui_status?: LeadUiStatus;
  assignee_id?: string | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  vehicle_year?: number | null;
  booking_mode?: 'instant' | 'request' | null;
  intake_metadata?: Record<string, unknown> | null;
  ai_metadata?: Record<string, unknown> | null;
  assignee_label?: string | null;
  aging_state?: OperatorAgingState | null;
  follow_up_reason?: string | null;
  is_unassigned?: boolean;
  is_reviewed?: boolean;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  source_group?: LeadSourceGroup | null;
  created_at: string;
  updated_at: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface CustomerVehicle {
  id: string;
  client_id: string;
  plate?: string | null;
  vin?: string | null;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  color?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientRecord {
  id: string;
  name: string;
  company_name?: string | null;
  email?: string | null;
  phone?: string | null;
  alternate_phone?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
  country?: string | null;
  tags?: string[] | null;
  notes?: string | null;
  assignee_id?: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface ServiceJob {
  id: string;
  lead_id?: string | null;
  client_id?: string | null;
  client_name: string;
  service_type: string;
  service_catalog_id?: string | null;
  service_addon_ids?: string[] | null;
  status: string;
  ui_status?: JobUiStatus;
  scheduled_at?: string | null;
  scheduled_end_at?: string | null;
  assignee_id?: string | null;
  notes?: string | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  vehicle_year?: number | null;
  estimated_amount?: number | null;
  payment_status?: JobPaymentStatus | null;
  booking_source?: string | null;
  booking_reference?: string | null;
  pickup_requested?: boolean | null;
  pickup_address?: Record<string, unknown> | null;
  completed_at?: string | null;
  ai_metadata?: Record<string, unknown> | null;
  assignee_label?: string | null;
  aging_state?: OperatorAgingState | null;
  follow_up_reason?: string | null;
  is_unassigned?: boolean;
  is_overdue?: boolean;
  needs_payment_follow_up?: boolean;
  created_at: string;
  updated_at: string;
}

export interface JobTimelineEvent {
  id: string;
  service_job_id: string;
  lead_id?: string | null;
  client_id?: string | null;
  event_type: string;
  note?: string | null;
  metadata?: Record<string, unknown> | null;
  created_by?: string | null;
  created_at: string;
}

export type BillingStatus =
  | 'draft'
  | 'sent'
  | 'partially_paid'
  | 'paid'
  | 'overdue'
  | 'void';

export interface BillingRecord {
  id: string;
  lead_id?: string | null;
  client_id?: string | null;
  service_job_id?: string | null;
  record_number?: string | null;
  record_type: string;
  status: BillingStatus;
  currency: string;
  subtotal_amount: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  due_at?: string | null;
  issued_at?: string | null;
  paid_at?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export type CustomerTimelineKind = 'job' | 'note' | 'message' | 'payment' | 'ai';
export type CustomerTimelineCategory = 'Jobs' | 'Payments' | 'Messages' | 'AI' | 'Notes';

export interface CustomerMessageLog {
  id: string;
  created_at: string;
  action: string;
  channel: 'email' | 'sms' | 'whatsapp' | 'internal';
  subject?: string | null;
  body: string;
  recipient?: string | null;
  intent?: string | null;
  status: 'drafted' | 'copied' | 'sent' | 'logged';
  direction: 'outbound' | 'inbound';
  templateId?: string | null;
}

export interface CustomerTimelineItem {
  id: string;
  kind: CustomerTimelineKind;
  category: CustomerTimelineCategory;
  createdAt: string;
  title: string;
  subtitle: string;
  note?: string | null;
  entityId: string;
  entityType: string;
}

export interface CustomerWorkspaceSummary {
  assignedOwnerLabel: string;
  lifetimeEstimatedRevenue: number;
  unpaidBalance: number;
  nextAppointment: ServiceJob | null;
  lastCompletedService: ServiceJob | null;
  recentContactAt?: string | null;
  lastPaymentChangeAt?: string | null;
  unassignedUpcomingCount: number;
  riskFlags: string[];
  recommendedNextAction: string;
}

export interface CustomerWorkspaceResponse {
  client: ClientRecord & {
    assignee_label?: string | null;
  };
  summary: CustomerWorkspaceSummary;
  vehicles: CustomerVehicle[];
  serviceJobs: ServiceJob[];
  unpaidJobs: ServiceJob[];
  paidJobs: ServiceJob[];
  leads: Lead[];
  enquiries: Enquiry[];
  messageLogs: CustomerMessageLog[];
  billingRecords: BillingRecord[];
  aiRuns: Array<Record<string, unknown>>;
  timeline: CustomerTimelineItem[];
}

export interface InAppNotification {
  id: string;
  recipient_user_id: string;
  category: string;
  title: string;
  message: string;
  entity_type?: string | null;
  entity_id?: string | null;
  metadata?: Record<string, unknown> | null;
  read_at?: string | null;
  created_at: string;
}

export interface AdminRecipient {
  id: string;
  email: string;
  enabled: boolean;
  created_at: string;
}

export interface NotificationEvent {
  id: string;
  event_type: string;
  entity_id: string;
  metadata?: Record<string, unknown> | null;
  provider: string;
  provider_message_id?: string | null;
  status: NotificationStatus;
  attempt_count: number;
  last_error?: string | null;
  next_retry_at?: string | null;
  sent_at?: string | null;
  created_at: string;
}
