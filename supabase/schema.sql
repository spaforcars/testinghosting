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
  email text,
  phone text,
  notes text,
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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
  ('staff', 'dashboard', 'read'),
  ('staff', 'leads', 'read'),
  ('staff', 'leads', 'write'),
  ('staff', 'services', 'read'),
  ('staff', 'services', 'write'),
  ('staff', 'clients', 'read'),
  ('staff', 'clients', 'write'),
  ('staff', 'notifications', 'read'),
  ('client', 'content', 'read'),
  ('client', 'content', 'write'),
  ('client', 'ads', 'read'),
  ('client', 'ads', 'write')
on conflict do nothing;

insert into public.system_settings (key, value)
values ('enquiry_alerts_enabled', 'true'::jsonb)
on conflict (key) do nothing;
