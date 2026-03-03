export type LeadStatus =
  | 'lead'
  | 'contacted'
  | 'quoted'
  | 'booked'
  | 'in_service'
  | 'completed'
  | 'closed_lost';

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
  assignee_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ServiceJob {
  id: string;
  lead_id?: string | null;
  client_name: string;
  service_type: string;
  status: string;
  scheduled_at?: string | null;
  created_at: string;
  updated_at: string;
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
