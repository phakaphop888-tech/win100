-- WIN100 PostgreSQL schema
-- Apply in Supabase SQL Editor as a privileged role.
-- Do not expose SERVICE_ROLE_KEY to the browser.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('passenger', 'driver', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.account_status as enum ('active', 'suspended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.driver_status as enum ('pending', 'approved', 'rejected', 'suspended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ride_status as enum (
    'SEARCHING',
    'DRIVER_ASSIGNED',
    'DRIVER_EN_ROUTE',
    'DRIVER_ARRIVED',
    'TRIP_STARTED',
    'TRIP_COMPLETED',
    'CANCELLED'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_method as enum ('cash', 'promptpay');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum ('pending', 'paid', 'failed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ticket_status as enum ('open', 'in_progress', 'resolved', 'closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.sos_status as enum ('active', 'acknowledged', 'resolved');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.favorite_label as enum ('home', 'school', 'university', 'work', 'other');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Updated-at helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Core tables
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'passenger',
  full_name text not null default '',
  phone text,
  avatar_path text,
  status public.account_status not null default 'active',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profiles_phone_unique unique (phone)
);

create table if not exists public.drivers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  verification_status public.driver_status not null default 'pending',
  is_online boolean not null default false,
  is_busy boolean not null default false,
  rating_avg numeric(3,2) not null default 5.00,
  rating_count integer not null default 0,
  rejection_reason text,
  national_id_last4 text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint drivers_rating_avg_check check (rating_avg >= 1 and rating_avg <= 5),
  constraint drivers_rating_count_check check (rating_count >= 0)
);

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null unique references public.drivers (id) on delete cascade,
  brand text not null default '',
  model text not null default '',
  color text not null default '',
  plate_number text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.driver_documents (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers (id) on delete cascade,
  doc_type text not null,
  storage_path text not null,
  mime_type text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint driver_documents_type_check check (
    doc_type in ('national_id', 'selfie', 'vehicle_registration', 'other')
  )
);

create table if not exists public.driver_locations (
  driver_id uuid primary key references public.drivers (id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  accuracy double precision,
  heading double precision,
  speed double precision,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint driver_locations_lat_check check (latitude between -90 and 90),
  constraint driver_locations_lng_check check (longitude between -180 and 180)
);

create table if not exists public.platform_settings (
  id text primary key default 'default',
  base_fare numeric(10,2) not null default 20,
  price_per_km numeric(10,2) not null default 10,
  min_fare numeric(10,2) not null default 25,
  match_radius_km numeric(6,2) not null default 5,
  gps_stale_seconds integer not null default 45,
  search_timeout_seconds integer not null default 90,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint platform_settings_positive check (
    base_fare >= 0 and price_per_km >= 0 and min_fare >= 0
    and match_radius_km > 0 and gps_stale_seconds > 0 and search_timeout_seconds > 0
  )
);

create table if not exists public.rides (
  id uuid primary key default gen_random_uuid(),
  passenger_id uuid not null references public.profiles (id),
  driver_id uuid references public.drivers (id),
  status public.ride_status not null default 'SEARCHING',
  pickup_address text not null,
  pickup_lat double precision not null,
  pickup_lng double precision not null,
  dropoff_address text not null,
  dropoff_lat double precision not null,
  dropoff_lng double precision not null,
  distance_km numeric(8,3),
  duration_min numeric(8,2),
  fare_amount numeric(10,2) not null,
  payment_method public.payment_method not null default 'cash',
  cancel_reason text,
  cancelled_by uuid references public.profiles (id),
  offered_driver_ids uuid[] not null default '{}',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint rides_pickup_lat_check check (pickup_lat between -90 and 90),
  constraint rides_dropoff_lat_check check (dropoff_lat between -90 and 90)
);

create table if not exists public.ride_status_history (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides (id) on delete cascade,
  from_status public.ride_status,
  to_status public.ride_status not null,
  changed_by uuid references public.profiles (id),
  note text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null unique references public.rides (id) on delete cascade,
  passenger_id uuid not null references public.profiles (id),
  amount numeric(10,2) not null,
  method public.payment_method not null,
  status public.payment_status not null default 'pending',
  provider_ref text,
  promptpay_payload text,
  paid_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint payments_amount_check check (amount >= 0)
);

create table if not exists public.ratings (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null unique references public.rides (id) on delete cascade,
  from_profile_id uuid not null references public.profiles (id),
  to_driver_id uuid not null references public.drivers (id),
  score integer not null,
  comment text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint ratings_score_check check (score between 1 and 5)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text not null,
  type text not null default 'info',
  ride_id uuid references public.rides (id) on delete set null,
  is_read boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides (id) on delete cascade,
  sender_id uuid not null references public.profiles (id),
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  constraint chat_messages_body_check check (char_length(body) between 1 and 2000)
);

create table if not exists public.favorite_places (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  label public.favorite_label not null default 'other',
  name text not null,
  address text not null default '',
  latitude double precision not null,
  longitude double precision not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  ride_id uuid references public.rides (id) on delete set null,
  subject text not null,
  message text not null,
  admin_reply text,
  status public.ticket_status not null default 'open',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.win_stands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null default '',
  latitude double precision not null,
  longitude double precision not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.sos_events (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides (id) on delete cascade,
  profile_id uuid not null references public.profiles (id),
  latitude double precision,
  longitude double precision,
  status public.sos_status not null default 'active',
  created_at timestamptz not null default timezone('utc', now()),
  resolved_at timestamptz
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default timezone('utc', now())
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists idx_profiles_role on public.profiles (role);
create index if not exists idx_drivers_status_online on public.drivers (verification_status, is_online, is_busy);
create index if not exists idx_driver_locations_updated on public.driver_locations (updated_at desc);
create index if not exists idx_rides_passenger_created on public.rides (passenger_id, created_at desc);
create index if not exists idx_rides_driver_status on public.rides (driver_id, status);
create index if not exists idx_rides_status_created on public.rides (status, created_at desc);
create index if not exists idx_ride_history_ride on public.ride_status_history (ride_id, created_at);
create index if not exists idx_payments_status on public.payments (status, created_at desc);
create index if not exists idx_notifications_profile on public.notifications (profile_id, created_at desc);
create index if not exists idx_chat_ride_created on public.chat_messages (ride_id, created_at);
create index if not exists idx_favorites_profile on public.favorite_places (profile_id);
create index if not exists idx_tickets_status on public.support_tickets (status, created_at desc);
create index if not exists idx_audit_created on public.audit_logs (created_at desc);
create index if not exists idx_sos_status on public.sos_events (status, created_at desc);
create index if not exists idx_win_stands_active on public.win_stands (is_active);

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_drivers_updated on public.drivers;
create trigger trg_drivers_updated before update on public.drivers
for each row execute function public.set_updated_at();

drop trigger if exists trg_vehicles_updated on public.vehicles;
create trigger trg_vehicles_updated before update on public.vehicles
for each row execute function public.set_updated_at();

drop trigger if exists trg_rides_updated on public.rides;
create trigger trg_rides_updated before update on public.rides
for each row execute function public.set_updated_at();

drop trigger if exists trg_payments_updated on public.payments;
create trigger trg_payments_updated before update on public.payments
for each row execute function public.set_updated_at();

drop trigger if exists trg_tickets_updated on public.support_tickets;
create trigger trg_tickets_updated before update on public.support_tickets
for each row execute function public.set_updated_at();

drop trigger if exists trg_stands_updated on public.win_stands;
create trigger trg_stands_updated before update on public.win_stands
for each row execute function public.set_updated_at();

drop trigger if exists trg_settings_updated on public.platform_settings;
create trigger trg_settings_updated before update on public.platform_settings
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auth: create profile. Role from signup is passenger/driver only — never admin.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested text := lower(coalesce(new.raw_user_meta_data->>'role', 'passenger'));
  assigned public.user_role := 'passenger';
begin
  if requested = 'driver' then
    assigned := 'driver';
  end if;

  insert into public.profiles (id, role, full_name, phone)
  values (
    new.id,
    assigned,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'phone', '')
  );

  if assigned = 'driver' then
    insert into public.drivers (profile_id) values (new.id);
    insert into public.vehicles (driver_id)
    select d.id from public.drivers d where d.profile_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Helpers (private schema for security definer)
-- ---------------------------------------------------------------------------
create schema if not exists private;

create or replace function private.current_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and status = 'active'
  );
$$;

create or replace function public.is_driver()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'driver'
      and status = 'active'
  );
$$;

create or replace function private.driver_id_for(uid uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.drivers where profile_id = uid
$$;

create or replace function private.haversine_km(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
)
returns double precision
language sql
immutable
as $$
  select (
    6371 * acos(
      least(1.0, greatest(-1.0,
        cos(radians(lat1)) * cos(radians(lat2)) *
        cos(radians(lng2) - radians(lng1)) +
        sin(radians(lat1)) * sin(radians(lat2))
      ))
    )
  );
$$;

create or replace function private.write_audit(
  p_action text,
  p_entity text,
  p_entity_id uuid,
  p_meta jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), p_action, p_entity, p_entity_id, coalesce(p_meta, '{}'::jsonb));
end;
$$;

create or replace function private.notify_profile(
  p_profile uuid,
  p_title text,
  p_body text,
  p_type text,
  p_ride uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (profile_id, title, body, type, ride_id)
  values (p_profile, p_title, p_body, p_type, p_ride);
end;
$$;

create or replace function private.append_history(
  p_ride uuid,
  p_from public.ride_status,
  p_to public.ride_status,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.ride_status_history (ride_id, from_status, to_status, changed_by, note)
  values (p_ride, p_from, p_to, auth.uid(), p_note);
end;
$$;

create or replace function private.can_transition(
  p_from public.ride_status,
  p_to public.ride_status
)
returns boolean
language sql
immutable
as $$
  select case
    when p_from = 'SEARCHING' and p_to in ('DRIVER_ASSIGNED', 'CANCELLED') then true
    when p_from = 'DRIVER_ASSIGNED' and p_to in ('DRIVER_EN_ROUTE', 'SEARCHING', 'CANCELLED') then true
    when p_from = 'DRIVER_EN_ROUTE' and p_to in ('DRIVER_ARRIVED', 'CANCELLED') then true
    when p_from = 'DRIVER_ARRIVED' and p_to in ('TRIP_STARTED', 'CANCELLED') then true
    when p_from = 'TRIP_STARTED' and p_to in ('TRIP_COMPLETED', 'CANCELLED') then true
    else false
  end;
$$;

-- ---------------------------------------------------------------------------
-- Matching: nearest approved / online / not busy / fresh GPS
-- ---------------------------------------------------------------------------
create or replace function private.find_nearest_driver(
  p_lat double precision,
  p_lng double precision,
  p_exclude uuid[] default '{}'
)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_settings public.platform_settings%rowtype;
  v_id uuid;
begin
  select * into v_settings from public.platform_settings where id = 'default';
  if v_settings.id is null then
    raise exception 'missing_settings';
  end if;

  select d.id into v_id
  from public.drivers d
  join public.profiles p on p.id = d.profile_id
  join public.driver_locations loc on loc.driver_id = d.id
  where d.verification_status = 'approved'
    and d.is_online = true
    and d.is_busy = false
    and p.status = 'active'
    and loc.updated_at > timezone('utc', now()) - make_interval(secs => v_settings.gps_stale_seconds)
    and not (d.id = any (p_exclude))
    and private.haversine_km(p_lat, p_lng, loc.latitude, loc.longitude) <= v_settings.match_radius_km
  order by private.haversine_km(p_lat, p_lng, loc.latitude, loc.longitude) asc
  limit 1;

  return v_id;
end;
$$;

create or replace function public.calculate_fare(p_distance_km numeric)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_settings public.platform_settings%rowtype;
  v_fare numeric;
begin
  select * into v_settings from public.platform_settings where id = 'default';
  v_fare := round(v_settings.base_fare + (p_distance_km * v_settings.price_per_km), 0);
  if v_fare < v_settings.min_fare then
    v_fare := v_settings.min_fare;
  end if;
  return v_fare;
end;
$$;

create or replace function public.get_platform_settings()
returns public.platform_settings
language sql
stable
security definer
set search_path = public
as $$
  select * from public.platform_settings where id = 'default';
$$;

-- ---------------------------------------------------------------------------
-- Ride RPCs
-- ---------------------------------------------------------------------------
create or replace function public.request_ride(
  p_pickup_address text,
  p_pickup_lat double precision,
  p_pickup_lng double precision,
  p_dropoff_address text,
  p_dropoff_lat double precision,
  p_dropoff_lng double precision,
  p_distance_km numeric,
  p_duration_min numeric,
  p_payment_method public.payment_method
)
returns public.rides
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_fare numeric;
  v_ride public.rides%rowtype;
  v_driver uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile.id is null or v_profile.role <> 'passenger' or v_profile.status <> 'active' then
    raise exception 'forbidden';
  end if;

  if exists (
    select 1 from public.rides
    where passenger_id = auth.uid()
      and status not in ('TRIP_COMPLETED', 'CANCELLED')
  ) then
    raise exception 'active_ride_exists';
  end if;

  v_fare := public.calculate_fare(p_distance_km);

  insert into public.rides (
    passenger_id, status, pickup_address, pickup_lat, pickup_lng,
    dropoff_address, dropoff_lat, dropoff_lng, distance_km, duration_min,
    fare_amount, payment_method
  ) values (
    auth.uid(), 'SEARCHING', p_pickup_address, p_pickup_lat, p_pickup_lng,
    p_dropoff_address, p_dropoff_lat, p_dropoff_lng, p_distance_km, p_duration_min,
    v_fare, p_payment_method
  ) returning * into v_ride;

  insert into public.payments (ride_id, passenger_id, amount, method, status, promptpay_payload)
  values (
    v_ride.id,
    auth.uid(),
    v_fare,
    p_payment_method,
    'pending',
    case when p_payment_method = 'promptpay'
      then 'promptpay:pending:' || v_ride.id::text
      else null end
  );

  perform private.append_history(v_ride.id, null, 'SEARCHING', 'created');

  v_driver := private.find_nearest_driver(p_pickup_lat, p_pickup_lng, '{}');
  if v_driver is not null then
    update public.rides
    set driver_id = v_driver,
        status = 'DRIVER_ASSIGNED',
        offered_driver_ids = array_append(offered_driver_ids, v_driver)
    where id = v_ride.id
    returning * into v_ride;

    update public.drivers set is_busy = true where id = v_driver;
    perform private.append_history(v_ride.id, 'SEARCHING', 'DRIVER_ASSIGNED', 'matched');
    perform private.notify_profile(
      (select profile_id from public.drivers where id = v_driver),
      'มีงานใหม่',
      'มีผู้โดยสารเรียกรถใกล้คุณ',
      'new_job',
      v_ride.id
    );
    perform private.notify_profile(auth.uid(), 'คนขับรับงานแล้ว', 'กำลังมอบหมายคนขับให้คุณ', 'driver_assigned', v_ride.id);
  end if;

  return v_ride;
end;
$$;

create or replace function public.retry_match(p_ride_id uuid)
returns public.rides
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride public.rides%rowtype;
  v_driver uuid;
  v_settings public.platform_settings%rowtype;
begin
  select * into v_ride from public.rides where id = p_ride_id for update;
  if v_ride.id is null then
    raise exception 'not_found';
  end if;
  if v_ride.passenger_id <> auth.uid() and not public.is_admin() then
    raise exception 'forbidden';
  end if;
  if v_ride.status <> 'SEARCHING' then
    return v_ride;
  end if;

  select * into v_settings from public.platform_settings where id = 'default';
  if v_ride.created_at < timezone('utc', now()) - make_interval(secs => v_settings.search_timeout_seconds) then
    update public.rides set status = 'CANCELLED', cancel_reason = 'timeout'
    where id = v_ride.id
    returning * into v_ride;
    update public.payments set status = 'cancelled' where ride_id = v_ride.id and status = 'pending';
    perform private.append_history(v_ride.id, 'SEARCHING', 'CANCELLED', 'search_timeout');
    return v_ride;
  end if;

  v_driver := private.find_nearest_driver(v_ride.pickup_lat, v_ride.pickup_lng, v_ride.offered_driver_ids);
  if v_driver is null then
    return v_ride;
  end if;

  update public.rides
  set driver_id = v_driver,
      status = 'DRIVER_ASSIGNED',
      offered_driver_ids = array_append(offered_driver_ids, v_driver)
  where id = v_ride.id
  returning * into v_ride;

  update public.drivers set is_busy = true where id = v_driver;
  perform private.append_history(v_ride.id, 'SEARCHING', 'DRIVER_ASSIGNED', 'matched');
  perform private.notify_profile(
    (select profile_id from public.drivers where id = v_driver),
    'มีงานใหม่',
    'มีผู้โดยสารเรียกรถใกล้คุณ',
    'new_job',
    v_ride.id
  );
  perform private.notify_profile(v_ride.passenger_id, 'คนขับรับงานแล้ว', 'พบคนขับแล้ว', 'driver_assigned', v_ride.id);
  return v_ride;
end;
$$;

create or replace function public.driver_accept_ride(p_ride_id uuid)
returns public.rides
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver_id uuid := private.driver_id_for(auth.uid());
  v_ride public.rides%rowtype;
  v_drv public.drivers%rowtype;
begin
  select * into v_drv from public.drivers where id = v_driver_id;
  if v_drv.id is null or v_drv.verification_status <> 'approved' or not v_drv.is_online then
    raise exception 'driver_not_eligible';
  end if;

  select * into v_ride from public.rides where id = p_ride_id for update;
  if v_ride.status <> 'DRIVER_ASSIGNED' or v_ride.driver_id <> v_driver_id then
    raise exception 'job_taken';
  end if;

  if not private.can_transition(v_ride.status, 'DRIVER_EN_ROUTE') then
    raise exception 'illegal_transition';
  end if;

  update public.rides set status = 'DRIVER_EN_ROUTE' where id = v_ride.id returning * into v_ride;
  perform private.append_history(v_ride.id, 'DRIVER_ASSIGNED', 'DRIVER_EN_ROUTE', 'accepted');
  perform private.notify_profile(v_ride.passenger_id, 'คนขับกำลังเดินทาง', 'คนขับกำลังมุ่งหน้าสู่จุดรับ', 'driver_en_route', v_ride.id);
  return v_ride;
end;
$$;

create or replace function public.driver_reject_ride(p_ride_id uuid)
returns public.rides
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver_id uuid := private.driver_id_for(auth.uid());
  v_ride public.rides%rowtype;
begin
  select * into v_ride from public.rides where id = p_ride_id for update;
  if v_ride.driver_id <> v_driver_id or v_ride.status <> 'DRIVER_ASSIGNED' then
    raise exception 'job_taken';
  end if;

  update public.drivers set is_busy = false where id = v_driver_id;
  update public.rides
  set driver_id = null, status = 'SEARCHING'
  where id = v_ride.id
  returning * into v_ride;

  perform private.append_history(v_ride.id, 'DRIVER_ASSIGNED', 'SEARCHING', 'driver_rejected');
  return public.retry_match(v_ride.id);
end;
$$;

create or replace function public.driver_update_ride_status(
  p_ride_id uuid,
  p_to public.ride_status
)
returns public.rides
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver_id uuid := private.driver_id_for(auth.uid());
  v_ride public.rides%rowtype;
  v_from public.ride_status;
begin
  if p_to not in ('DRIVER_ARRIVED', 'TRIP_STARTED', 'TRIP_COMPLETED') then
    raise exception 'illegal_transition';
  end if;

  select * into v_ride from public.rides where id = p_ride_id for update;
  if v_ride.driver_id <> v_driver_id then
    raise exception 'forbidden';
  end if;
  v_from := v_ride.status;
  if not private.can_transition(v_from, p_to) then
    raise exception 'illegal_transition';
  end if;

  update public.rides
  set status = p_to,
      started_at = case when p_to = 'TRIP_STARTED' then timezone('utc', now()) else started_at end,
      completed_at = case when p_to = 'TRIP_COMPLETED' then timezone('utc', now()) else completed_at end
  where id = v_ride.id
  returning * into v_ride;

  perform private.append_history(v_ride.id, v_from, p_to, 'driver_update');

  if p_to = 'DRIVER_ARRIVED' then
    perform private.notify_profile(v_ride.passenger_id, 'คนขับถึงจุดรับแล้ว', 'คนขับถึงจุดรับของคุณแล้ว', 'driver_arrived', v_ride.id);
  elsif p_to = 'TRIP_STARTED' then
    perform private.notify_profile(v_ride.passenger_id, 'เริ่มเดินทางแล้ว', 'การเดินทางเริ่มต้นแล้ว', 'trip_started', v_ride.id);
  elsif p_to = 'TRIP_COMPLETED' then
    update public.drivers set is_busy = false where id = v_driver_id;
    perform private.notify_profile(v_ride.passenger_id, 'เดินทางเสร็จแล้ว', 'งานเสร็จสมบูรณ์ กรุณาให้คะแนนคนขับ', 'trip_completed', v_ride.id);
    perform private.notify_profile(
      (select profile_id from public.drivers where id = v_driver_id),
      'งานสำเร็จ',
      'คุณจบงานเรียบร้อยแล้ว',
      'job_completed',
      v_ride.id
    );
  end if;

  return v_ride;
end;
$$;

create or replace function public.cancel_ride(p_ride_id uuid, p_reason text default null)
returns public.rides
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride public.rides%rowtype;
  v_from public.ride_status;
  v_driver_profile uuid;
begin
  select * into v_ride from public.rides where id = p_ride_id for update;
  if v_ride.id is null then
    raise exception 'not_found';
  end if;

  if not (
    v_ride.passenger_id = auth.uid()
    or v_ride.driver_id = private.driver_id_for(auth.uid())
    or public.is_admin()
  ) then
    raise exception 'forbidden';
  end if;

  v_from := v_ride.status;
  if v_from in ('TRIP_COMPLETED', 'CANCELLED') then
    raise exception 'illegal_transition';
  end if;
  if not private.can_transition(v_from, 'CANCELLED') then
    raise exception 'illegal_transition';
  end if;

  update public.rides
  set status = 'CANCELLED', cancel_reason = p_reason, cancelled_by = auth.uid()
  where id = v_ride.id
  returning * into v_ride;

  update public.payments set status = 'cancelled' where ride_id = v_ride.id and status = 'pending';

  if v_ride.driver_id is not null then
    update public.drivers set is_busy = false where id = v_ride.driver_id;
    select profile_id into v_driver_profile from public.drivers where id = v_ride.driver_id;
    perform private.notify_profile(v_driver_profile, 'ผู้โดยสารยกเลิก', 'งานถูกยกเลิก', 'ride_cancelled', v_ride.id);
  end if;
  perform private.notify_profile(v_ride.passenger_id, 'งานถูกยกเลิก', coalesce(p_reason, 'งานนี้ถูกยกเลิก'), 'ride_cancelled', v_ride.id);
  perform private.append_history(v_ride.id, v_from, 'CANCELLED', p_reason);
  perform private.write_audit('job_status_change', 'ride', v_ride.id, jsonb_build_object('to', 'CANCELLED'));
  return v_ride;
end;
$$;

create or replace function public.driver_confirm_cash_paid(p_ride_id uuid)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver_id uuid := private.driver_id_for(auth.uid());
  v_ride public.rides%rowtype;
  v_pay public.payments%rowtype;
begin
  select * into v_ride from public.rides where id = p_ride_id;
  if v_ride.driver_id <> v_driver_id and not public.is_admin() then
    raise exception 'forbidden';
  end if;
  if v_ride.status <> 'TRIP_COMPLETED' then
    raise exception 'ride_not_completed';
  end if;

  select * into v_pay from public.payments where ride_id = p_ride_id for update;
  if v_pay.method <> 'cash' then
    raise exception 'not_cash';
  end if;
  if v_pay.status = 'paid' then
    return v_pay;
  end if;

  update public.payments
  set status = 'paid', paid_at = timezone('utc', now())
  where id = v_pay.id
  returning * into v_pay;

  perform private.notify_profile(v_ride.passenger_id, 'ชำระเงินสำเร็จ', 'ยืนยันรับเงินสดแล้ว', 'payment_paid', v_ride.id);
  perform private.write_audit('payment_change', 'payment', v_pay.id, jsonb_build_object('status', 'paid', 'method', 'cash'));
  return v_pay;
end;
$$;

-- PromptPay verification must be called by a trusted backend (service role),
-- never from the browser. This function is revoked from authenticated/anon.
create or replace function public.verify_promptpay_payment(
  p_ride_id uuid,
  p_provider_ref text,
  p_success boolean
)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pay public.payments%rowtype;
  v_ride public.rides%rowtype;
begin
  select * into v_ride from public.rides where id = p_ride_id;
  select * into v_pay from public.payments where ride_id = p_ride_id for update;
  if v_pay.method <> 'promptpay' then
    raise exception 'not_promptpay';
  end if;

  if p_success then
    update public.payments
    set status = 'paid', provider_ref = p_provider_ref, paid_at = timezone('utc', now())
    where id = v_pay.id
    returning * into v_pay;
    perform private.notify_profile(v_ride.passenger_id, 'ชำระเงินสำเร็จ', 'PromptPay ยืนยันแล้ว', 'payment_paid', v_ride.id);
  else
    update public.payments
    set status = 'failed', provider_ref = p_provider_ref
    where id = v_pay.id
    returning * into v_pay;
  end if;

  perform private.write_audit('payment_change', 'payment', v_pay.id, jsonb_build_object('status', v_pay.status));
  return v_pay;
end;
$$;

create or replace function public.submit_rating(p_ride_id uuid, p_score integer, p_comment text default null)
returns public.ratings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride public.rides%rowtype;
  v_rating public.ratings%rowtype;
begin
  if p_score < 1 or p_score > 5 then
    raise exception 'invalid_score';
  end if;
  select * into v_ride from public.rides where id = p_ride_id;
  if v_ride.passenger_id <> auth.uid() then
    raise exception 'forbidden';
  end if;
  if v_ride.status <> 'TRIP_COMPLETED' or v_ride.driver_id is null then
    raise exception 'not_rateable';
  end if;

  insert into public.ratings (ride_id, from_profile_id, to_driver_id, score, comment)
  values (p_ride_id, auth.uid(), v_ride.driver_id, p_score, p_comment)
  returning * into v_rating;

  update public.drivers d
  set rating_count = d.rating_count + 1,
      rating_avg = ((d.rating_avg * d.rating_count) + p_score) / (d.rating_count + 1)
  where d.id = v_ride.driver_id;

  perform private.notify_profile(
    (select profile_id from public.drivers where id = v_ride.driver_id),
    'ได้รับคะแนน',
    'ผู้โดยสารให้คะแนนคุณ ' || p_score || ' ดาว',
    'rating',
    v_ride.id
  );
  return v_rating;
end;
$$;

create or replace function public.upsert_driver_location(
  p_lat double precision,
  p_lng double precision,
  p_accuracy double precision default null,
  p_heading double precision default null,
  p_speed double precision default null
)
returns public.driver_locations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver_id uuid := private.driver_id_for(auth.uid());
  v_drv public.drivers%rowtype;
  v_loc public.driver_locations%rowtype;
begin
  select * into v_drv from public.drivers where id = v_driver_id;
  if v_drv.id is null then
    raise exception 'not_driver';
  end if;
  if v_drv.verification_status <> 'approved' or not v_drv.is_online then
    raise exception 'driver_not_eligible';
  end if;

  insert into public.driver_locations (driver_id, latitude, longitude, accuracy, heading, speed, updated_at)
  values (v_driver_id, p_lat, p_lng, p_accuracy, p_heading, p_speed, timezone('utc', now()))
  on conflict (driver_id) do update
    set latitude = excluded.latitude,
        longitude = excluded.longitude,
        accuracy = excluded.accuracy,
        heading = excluded.heading,
        speed = excluded.speed,
        updated_at = excluded.updated_at
  returning * into v_loc;
  return v_loc;
end;
$$;

create or replace function public.set_driver_online(p_online boolean)
returns public.drivers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_drv public.drivers%rowtype;
begin
  select * into v_drv from public.drivers where profile_id = auth.uid();
  if v_drv.id is null then
    raise exception 'not_driver';
  end if;
  if p_online and v_drv.verification_status <> 'approved' then
    raise exception 'not_approved';
  end if;

  update public.drivers
  set is_online = p_online,
      is_busy = case when p_online then is_busy else false end
  where id = v_drv.id
  returning * into v_drv;
  return v_drv;
end;
$$;

create or replace function public.submit_driver_profile(
  p_brand text,
  p_model text,
  p_color text,
  p_plate text,
  p_national_id_last4 text
)
returns public.drivers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_drv public.drivers%rowtype;
begin
  select * into v_drv from public.drivers where profile_id = auth.uid();
  if v_drv.id is null then
    insert into public.drivers (profile_id) values (auth.uid()) returning * into v_drv;
    insert into public.vehicles (driver_id) values (v_drv.id);
  end if;

  update public.vehicles
  set brand = p_brand, model = p_model, color = p_color, plate_number = p_plate
  where driver_id = v_drv.id;

  update public.drivers
  set national_id_last4 = p_national_id_last4,
      verification_status = case
        when verification_status in ('rejected') then 'pending'
        else verification_status
      end
  where id = v_drv.id
  returning * into v_drv;

  insert into public.notifications (profile_id, title, body, type)
  select p.id, 'มี Driver สมัครใหม่', 'มีเอกสารรอตรวจ', 'driver_pending'
  from public.profiles p
  where p.role = 'admin' and p.status = 'active';

  return v_drv;
end;
$$;

create or replace function public.create_sos(p_ride_id uuid, p_lat double precision, p_lng double precision)
returns public.sos_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride public.rides%rowtype;
  v_sos public.sos_events%rowtype;
begin
  select * into v_ride from public.rides where id = p_ride_id;
  if v_ride.id is null then
    raise exception 'not_found';
  end if;
  if v_ride.passenger_id <> auth.uid() and v_ride.driver_id <> private.driver_id_for(auth.uid()) then
    raise exception 'forbidden';
  end if;
  if v_ride.status in ('TRIP_COMPLETED', 'CANCELLED', 'SEARCHING') then
    raise exception 'illegal_transition';
  end if;

  insert into public.sos_events (ride_id, profile_id, latitude, longitude)
  values (p_ride_id, auth.uid(), p_lat, p_lng)
  returning * into v_sos;

  insert into public.notifications (profile_id, title, body, type, ride_id)
  select p.id, 'SOS', 'มีเหตุฉุกเฉินระหว่างงาน', 'sos', p_ride_id
  from public.profiles p
  where p.role = 'admin' and p.status = 'active';

  return v_sos;
end;
$$;

-- Admin RPCs
create or replace function public.admin_set_driver_status(
  p_driver_id uuid,
  p_status public.driver_status,
  p_reason text default null
)
returns public.drivers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_drv public.drivers%rowtype;
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  update public.drivers
  set verification_status = p_status,
      rejection_reason = p_reason,
      is_online = case when p_status = 'approved' then is_online else false end
  where id = p_driver_id
  returning * into v_drv;

  if p_status = 'approved' then
    perform private.notify_profile(v_drv.profile_id, 'อนุมัติแล้ว', 'คุณสามารถออนไลน์รับงานได้', 'driver_approved', null);
    perform private.write_audit('admin_approve_driver', 'driver', v_drv.id, '{}'::jsonb);
  elsif p_status = 'rejected' then
    perform private.notify_profile(v_drv.profile_id, 'เอกสารไม่ผ่าน', coalesce(p_reason, 'กรุณาอัปโหลดใหม่'), 'driver_rejected', null);
    perform private.write_audit('admin_reject_driver', 'driver', v_drv.id, jsonb_build_object('reason', p_reason));
  elsif p_status = 'suspended' then
    perform private.notify_profile(v_drv.profile_id, 'บัญชีถูกระงับ', coalesce(p_reason, 'บัญชีคนขับถูกระงับ'), 'driver_suspended', null);
    perform private.write_audit('admin_suspend_user', 'driver', v_drv.id, jsonb_build_object('reason', p_reason));
  end if;
  return v_drv;
end;
$$;

create or replace function public.admin_set_account_status(p_profile_id uuid, p_status public.account_status)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p public.profiles%rowtype;
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  update public.profiles set status = p_status where id = p_profile_id returning * into v_p;
  if p_status = 'suspended' then
    update public.drivers set is_online = false, is_busy = false where profile_id = p_profile_id;
    perform private.write_audit('admin_suspend_user', 'profile', p_profile_id, '{}'::jsonb);
  else
    perform private.write_audit('admin_restore_user', 'profile', p_profile_id, '{}'::jsonb);
  end if;
  return v_p;
end;
$$;

create or replace function public.admin_update_settings(
  p_base_fare numeric,
  p_price_per_km numeric,
  p_min_fare numeric,
  p_match_radius_km numeric,
  p_gps_stale_seconds integer,
  p_search_timeout_seconds integer
)
returns public.platform_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s public.platform_settings%rowtype;
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  update public.platform_settings
  set base_fare = p_base_fare,
      price_per_km = p_price_per_km,
      min_fare = p_min_fare,
      match_radius_km = p_match_radius_km,
      gps_stale_seconds = p_gps_stale_seconds,
      search_timeout_seconds = p_search_timeout_seconds
  where id = 'default'
  returning * into v_s;
  perform private.write_audit('settings_change', 'platform_settings', null, to_jsonb(v_s));
  return v_s;
end;
$$;

-- Nearby win stands
create or replace function public.nearby_win_stands(p_lat double precision, p_lng double precision, p_limit integer default 10)
returns table (
  id uuid,
  name text,
  address text,
  latitude double precision,
  longitude double precision,
  distance_km double precision
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.name, s.address, s.latitude, s.longitude,
         private.haversine_km(p_lat, p_lng, s.latitude, s.longitude) as distance_km
  from public.win_stands s
  where s.is_active = true
  order by 6 asc
  limit greatest(1, least(coalesce(p_limit, 10), 50));
$$;

create or replace function public.admin_live_drivers()
returns table (
  driver_id uuid,
  profile_id uuid,
  full_name text,
  verification_status public.driver_status,
  is_online boolean,
  is_busy boolean,
  rating_avg numeric,
  brand text,
  model text,
  color text,
  plate_number text,
  latitude double precision,
  longitude double precision,
  gps_updated_at timestamptz,
  gps_stale boolean,
  current_ride_id uuid
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_stale integer;
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  select gps_stale_seconds into v_stale from public.platform_settings where id = 'default';

  return query
  select
    d.id,
    d.profile_id,
    pr.full_name,
    d.verification_status,
    d.is_online,
    d.is_busy,
    d.rating_avg,
    v.brand,
    v.model,
    v.color,
    v.plate_number,
    loc.latitude,
    loc.longitude,
    loc.updated_at,
    (loc.updated_at is null or loc.updated_at < timezone('utc', now()) - make_interval(secs => v_stale)) as gps_stale,
    r.id
  from public.drivers d
  join public.profiles pr on pr.id = d.profile_id
  left join public.vehicles v on v.driver_id = d.id
  left join public.driver_locations loc on loc.driver_id = d.id
  left join public.rides r on r.driver_id = d.id and r.status not in ('TRIP_COMPLETED', 'CANCELLED');
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.drivers enable row level security;
alter table public.vehicles enable row level security;
alter table public.driver_documents enable row level security;
alter table public.driver_locations enable row level security;
alter table public.platform_settings enable row level security;
alter table public.rides enable row level security;
alter table public.ride_status_history enable row level security;
alter table public.payments enable row level security;
alter table public.ratings enable row level security;
alter table public.notifications enable row level security;
alter table public.chat_messages enable row level security;
alter table public.favorite_places enable row level security;
alter table public.support_tickets enable row level security;
alter table public.audit_logs enable row level security;
alter table public.win_stands enable row level security;
alter table public.sos_events enable row level security;
alter table public.push_subscriptions enable row level security;

-- Profiles
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin() or exists (
    select 1 from public.rides r
    join public.drivers d on d.id = r.driver_id
    where (r.passenger_id = auth.uid() and d.profile_id = profiles.id)
       or (d.profile_id = auth.uid() and r.passenger_id = profiles.id)
  ));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid() and role = (select role from public.profiles p where p.id = auth.uid()));

-- Drivers / vehicles / locations readable to counterpart on active ride + admin
create policy drivers_select on public.drivers for select to authenticated
  using (
    profile_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.rides r
      where r.driver_id = drivers.id and r.passenger_id = auth.uid()
    )
  );

create policy vehicles_select on public.vehicles for select to authenticated
  using (
    exists (select 1 from public.drivers d where d.id = vehicles.driver_id and d.profile_id = auth.uid())
    or public.is_admin()
    or exists (
      select 1 from public.rides r
      where r.driver_id = vehicles.driver_id and r.passenger_id = auth.uid()
    )
  );

create policy documents_own on public.driver_documents for select to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.drivers d where d.id = driver_documents.driver_id and d.profile_id = auth.uid())
  );
create policy documents_insert_own on public.driver_documents for insert to authenticated
  with check (
    exists (select 1 from public.drivers d where d.id = driver_documents.driver_id and d.profile_id = auth.uid())
  );

create policy locations_select on public.driver_locations for select to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.drivers d where d.id = driver_locations.driver_id and d.profile_id = auth.uid())
    or exists (
      select 1 from public.rides r
      where r.driver_id = driver_locations.driver_id
        and r.passenger_id = auth.uid()
        and r.status not in ('TRIP_COMPLETED', 'CANCELLED', 'SEARCHING')
    )
  );

create policy settings_select on public.platform_settings for select to authenticated using (true);

create policy rides_select on public.rides for select to authenticated
  using (
    passenger_id = auth.uid()
    or driver_id = private.driver_id_for(auth.uid())
    or public.is_admin()
  );

create policy history_select on public.ride_status_history for select to authenticated
  using (
    exists (
      select 1 from public.rides r
      where r.id = ride_status_history.ride_id
        and (r.passenger_id = auth.uid() or r.driver_id = private.driver_id_for(auth.uid()) or public.is_admin())
    )
  );

create policy payments_select on public.payments for select to authenticated
  using (passenger_id = auth.uid() or public.is_admin() or exists (
    select 1 from public.rides r
    where r.id = payments.ride_id and r.driver_id = private.driver_id_for(auth.uid())
  ));

create policy ratings_select on public.ratings for select to authenticated
  using (
    from_profile_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.drivers d where d.id = ratings.to_driver_id and d.profile_id = auth.uid())
  );

create policy notifications_own on public.notifications for select to authenticated
  using (profile_id = auth.uid() or public.is_admin());
create policy notifications_update_own on public.notifications for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy notifications_admin_insert on public.notifications for insert to authenticated
  with check (public.is_admin());

create policy chat_select on public.chat_messages for select to authenticated
  using (
    exists (
      select 1 from public.rides r
      where r.id = chat_messages.ride_id
        and (r.passenger_id = auth.uid() or r.driver_id = private.driver_id_for(auth.uid()) or public.is_admin())
    )
  );
create policy chat_insert on public.chat_messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.rides r
      where r.id = chat_messages.ride_id
        and r.status not in ('CANCELLED')
        and (r.passenger_id = auth.uid() or r.driver_id = private.driver_id_for(auth.uid()))
    )
  );
create policy chat_update_read on public.chat_messages for update to authenticated
  using (
    exists (
      select 1 from public.rides r
      where r.id = chat_messages.ride_id
        and (r.passenger_id = auth.uid() or r.driver_id = private.driver_id_for(auth.uid()))
    )
  );

create policy favorites_own on public.favorite_places for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy tickets_own_select on public.support_tickets for select to authenticated
  using (profile_id = auth.uid() or public.is_admin());
create policy tickets_insert on public.support_tickets for insert to authenticated
  with check (profile_id = auth.uid());
create policy tickets_admin_update on public.support_tickets for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy audit_admin on public.audit_logs for select to authenticated
  using (public.is_admin());

create policy stands_select on public.win_stands for select to authenticated using (true);
create policy stands_admin on public.win_stands for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy sos_select on public.sos_events for select to authenticated
  using (
    profile_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.rides r
      where r.id = sos_events.ride_id
        and (r.passenger_id = auth.uid() or r.driver_id = private.driver_id_for(auth.uid()))
    )
  );
create policy sos_admin_update on public.sos_events for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy push_own on public.push_subscriptions for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select on public.drivers to authenticated;
grant select on public.vehicles to authenticated;
grant select, insert on public.driver_documents to authenticated;
grant select on public.driver_locations to authenticated;
grant select on public.platform_settings to authenticated;
grant select on public.rides to authenticated;
grant select on public.ride_status_history to authenticated;
grant select on public.payments to authenticated;
grant select on public.ratings to authenticated;
grant select, insert, update on public.notifications to authenticated;
grant update on public.sos_events to authenticated;
grant select, insert, update on public.chat_messages to authenticated;
grant select, insert, update, delete on public.favorite_places to authenticated;
grant select, insert on public.support_tickets to authenticated;
grant update on public.support_tickets to authenticated;
grant select on public.audit_logs to authenticated;
grant select, insert, update, delete on public.win_stands to authenticated;
grant select on public.sos_events to authenticated;
grant select, insert, delete on public.push_subscriptions to authenticated;

revoke all on function public.verify_promptpay_payment(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.verify_promptpay_payment(uuid, text, boolean) to service_role;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_driver() to authenticated;
grant execute on function public.calculate_fare(numeric) to authenticated;
grant execute on function public.get_platform_settings() to authenticated, anon;
grant execute on function public.request_ride(text, double precision, double precision, text, double precision, double precision, numeric, numeric, public.payment_method) to authenticated;
grant execute on function public.retry_match(uuid) to authenticated;
grant execute on function public.driver_accept_ride(uuid) to authenticated;
grant execute on function public.driver_reject_ride(uuid) to authenticated;
grant execute on function public.driver_update_ride_status(uuid, public.ride_status) to authenticated;
grant execute on function public.cancel_ride(uuid, text) to authenticated;
grant execute on function public.driver_confirm_cash_paid(uuid) to authenticated;
grant execute on function public.submit_rating(uuid, integer, text) to authenticated;
grant execute on function public.upsert_driver_location(double precision, double precision, double precision, double precision, double precision) to authenticated;
grant execute on function public.set_driver_online(boolean) to authenticated;
grant execute on function public.submit_driver_profile(text, text, text, text, text) to authenticated;
grant execute on function public.create_sos(uuid, double precision, double precision) to authenticated;
grant execute on function public.admin_set_driver_status(uuid, public.driver_status, text) to authenticated;
grant execute on function public.admin_set_account_status(uuid, public.account_status) to authenticated;
grant execute on function public.admin_update_settings(numeric, numeric, numeric, numeric, integer, integer) to authenticated;
grant execute on function public.nearby_win_stands(double precision, double precision, integer) to authenticated;
grant execute on function public.admin_live_drivers() to authenticated;

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('driver-documents', 'driver-documents', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy storage_docs_read on storage.objects for select to authenticated
  using (
    bucket_id = 'driver-documents'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = auth.uid()::text
    )
  );
create policy storage_docs_write on storage.objects for insert to authenticated
  with check (
    bucket_id = 'driver-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy storage_docs_update on storage.objects for update to authenticated
  using (
    bucket_id = 'driver-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'driver-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy storage_avatars_read on storage.objects for select to public
  using (bucket_id = 'avatars');
create policy storage_avatars_write on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy storage_avatars_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

insert into public.platform_settings (id) values ('default') on conflict (id) do nothing;
