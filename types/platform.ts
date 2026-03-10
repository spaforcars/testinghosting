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

export type NotificationStatus = 'queued' | 'sent' | 'failed';

export interface Enquiry {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  message: string;
  service_type?: string | null;
  source_page: string;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

export interface Lead {
  id: string;
  enquiry_id?: string | null;
  name: string;
  email: string;
  phone?: string | null;
  service_type?: string | null;
  source_page: string;
  status: LeadStatus;
  ui_status?: LeadUiStatus;
  assignee_id?: string | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  vehicle_year?: number | null;
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
  status: string;
  ui_status?: JobUiStatus;
  scheduled_at?: string | null;
  assignee_id?: string | null;
  notes?: string | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  vehicle_year?: number | null;
  estimated_amount?: number | null;
  payment_status?: JobPaymentStatus | null;
  completed_at?: string | null;
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
  provider: string;
  status: NotificationStatus;
  attempt_count: number;
  last_error?: string | null;
  next_retry_at?: string | null;
  sent_at?: string | null;
  created_at: string;
}
