-- Core profile + RBAC
create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'staff',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.role_permissions (
  id bigserial primary key,
  role text not null,
  module text not null,
  action text not null,
  created_at timestamptz not null default now(),
  unique(role, module, action)
);

-- Customer-facing records
create table if not exists public.enquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  message text not null,
  service_type text,
  source_page text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid references public.enquiries(id) on delete set null,
  name text not null,
  email text not null,
  phone text,
  service_type text,
  source_page text not null,
  status text not null default 'lead',
  assignee_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company_name text,
  email text,
  phone text,
  alternate_phone text,
  address_line1 text,
  address_line2 text,
  city text,
  province text,
  postal_code text,
  country text,
  tags text[] not null default '{}'::text[],
  notes text,
  assignee_id uuid references auth.users(id) on delete set null,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_jobs (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  client_name text not null,
  service_type text not null,
  status text not null default 'booked',
  scheduled_at timestamptz,
  assignee_id uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure new columns exist on older datasets
alter table if exists public.clients add column if not exists company_name text;
alter table if exists public.clients add column if not exists alternate_phone text;
alter table if exists public.clients add column if not exists address_line1 text;
alter table if exists public.clients add column if not exists address_line2 text;
alter table if exists public.clients add column if not exists city text;
alter table if exists public.clients add column if not exists province text;
alter table if exists public.clients add column if not exists postal_code text;
alter table if exists public.clients add column if not exists country text;
alter table if exists public.clients add column if not exists tags text[] not null default '{}'::text[];
alter table if exists public.clients add column if not exists assignee_id uuid references auth.users(id) on delete set null;
alter table if exists public.clients add column if not exists archived boolean not null default false;

alter table if exists public.service_jobs add column if not exists assignee_id uuid references auth.users(id) on delete set null;
alter table if exists public.service_jobs add column if not exists notes text;

-- Customer vehicles
create table if not exists public.customer_vehicles (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  plate text,
  vin text,
  make text,
  model text,
  year int,
  color text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Job timeline events
create table if not exists public.job_timeline_events (
  id uuid primary key default gen_random_uuid(),
  service_job_id uuid not null references public.service_jobs(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  event_type text not null default 'note',
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Billing / invoice status tracking
create table if not exists public.billing_records (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  service_job_id uuid references public.service_jobs(id) on delete set null,
  record_number text,
  record_type text not null default 'invoice',
  status text not null default 'draft',
  currency text not null default 'CAD',
  subtotal_amount numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  due_at timestamptz,
  issued_at timestamptz,
  paid_at timestamptz,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- In-app notifications for staff/admin
create table if not exists public.in_app_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  category text not null default 'system',
  title text not null,
  message text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- Notifications + alerting
create table if not exists public.admin_notification_recipients (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  entity_id uuid not null,
  provider text not null default 'resend',
  provider_message_id text,
  status text not null default 'queued',
  attempt_count int not null default 0,
  last_error text,
  next_retry_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

-- Settings + audit
create table if not exists public.system_settings (
  key text primary key,
  value jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  module text not null,
  entity_type text,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Seed baseline permissions
insert into public.role_permissions (role, module, action) values
  ('super_admin', '*', '*'),
  ('admin', 'dashboard', 'read'),
  ('admin', 'leads', 'read'),
  ('admin', 'leads', 'write'),
  ('admin', 'services', 'read'),
  ('admin', 'services', 'write'),
  ('admin', 'clients', 'read'),
  ('admin', 'clients', 'write'),
  ('admin', 'users', 'read'),
  ('admin', 'users', 'write'),
  ('admin', 'roles', 'read'),
  ('admin', 'roles', 'write'),
  ('admin', 'settings', 'read'),
  ('admin', 'settings', 'write'),
  ('admin', 'notifications', 'read'),
  ('admin', 'notifications', 'write'),
  ('admin', 'billing', 'read'),
  ('admin', 'billing', 'write'),
  ('admin', 'reports', 'read'),
  ('staff', 'dashboard', 'read'),
  ('staff', 'leads', 'read'),
  ('staff', 'leads', 'write'),
  ('staff', 'services', 'read'),
  ('staff', 'services', 'write'),
  ('staff', 'clients', 'read'),
  ('staff', 'clients', 'write'),
  ('staff', 'notifications', 'read'),
  ('staff', 'notifications', 'write'),
  ('staff', 'billing', 'read'),
  ('staff', 'billing', 'write'),
  ('staff', 'reports', 'read'),
  ('client', 'content', 'read'),
  ('client', 'content', 'write'),
  ('client', 'ads', 'read'),
  ('client', 'ads', 'write')
on conflict do nothing;

insert into public.system_settings (key, value)
values ('enquiry_alerts_enabled', 'true'::jsonb)
on conflict (key) do nothing;

insert into public.system_settings (key, value)
values
  ('ops_v1_enabled', 'true'::jsonb),
  ('ops_billing_enabled', 'true'::jsonb),
  ('ops_reports_enabled', 'true'::jsonb)
on conflict (key) do nothing;

-- Indexes for heavy filters/searches
create index if not exists idx_leads_status_created_at on public.leads(status, created_at desc);
create index if not exists idx_leads_assignee_id on public.leads(assignee_id);
create index if not exists idx_leads_source_page on public.leads(source_page);

create index if not exists idx_service_jobs_status_scheduled_at on public.service_jobs(status, scheduled_at);
create index if not exists idx_service_jobs_assignee_id on public.service_jobs(assignee_id);
create index if not exists idx_service_jobs_client_id on public.service_jobs(client_id);
create index if not exists idx_service_jobs_lead_id on public.service_jobs(lead_id);

create index if not exists idx_clients_archived_created_at on public.clients(archived, created_at desc);
create index if not exists idx_clients_assignee_id on public.clients(assignee_id);

create index if not exists idx_customer_vehicles_client_id on public.customer_vehicles(client_id);
create index if not exists idx_job_timeline_service_job_id_created_at on public.job_timeline_events(service_job_id, created_at desc);

create index if not exists idx_billing_records_status_due_at on public.billing_records(status, due_at);
create index if not exists idx_billing_records_client_id on public.billing_records(client_id);
create index if not exists idx_billing_records_service_job_id on public.billing_records(service_job_id);
create index if not exists idx_billing_records_created_at on public.billing_records(created_at desc);

create index if not exists idx_in_app_notifications_recipient_read_created on public.in_app_notifications(recipient_user_id, read_at, created_at desc);
