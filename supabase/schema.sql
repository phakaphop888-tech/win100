-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Profiles Table
create table public.profiles (
    id uuid references auth.users on delete cascade primary key,
    full_name text not null,
    phone text not null,
    role text not null check (role in ('user', 'driver', 'admin')),
    avatar_url text,
    status text default 'active' check (status in ('active', 'suspended', 'banned')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Drivers Table
create table public.drivers (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null unique,
    vehicle_brand text not null,
    vehicle_model text not null,
    vehicle_color text not null,
    license_plate text not null,
    province text not null,
    approval_status text not null default 'pending' check (approval_status in ('pending', 'approved', 'rejected', 'suspended')),
    online_status text not null default 'offline' check (online_status in ('online', 'offline')),
    identity_number text not null,
    date_of_birth date not null,
    address text not null,
    district text not null,
    postal_code text not null,
    id_card_document text not null,
    selfie_document text not null,
    vehicle_document text not null,
    rejection_reason text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Jobs Table
create table public.jobs (
    id uuid default uuid_generate_v4() primary key,
    customer_id uuid references public.profiles(id) not null,
    driver_id uuid references public.drivers(id),
    pickup text not null,
    destination text not null,
    pickup_latitude double precision not null,
    pickup_longitude double precision not null,
    destination_latitude double precision not null,
    destination_longitude double precision not null,
    note text,
    price decimal(10,2) not null,
    status text not null default 'waiting' check (status in ('waiting', 'assigned', 'accepted', 'traveling', 'arrived', 'completed', 'cancelled')),
    cancelled_by text check (cancelled_by in ('user', 'driver', 'admin')),
    cancel_reason text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    accepted_at timestamp with time zone,
    completed_at timestamp with time zone,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Job Locations Table (GPS Real-time Tracking)
create table public.job_locations (
    id uuid default uuid_generate_v4() primary key,
    job_id uuid references public.jobs(id) on delete cascade not null,
    user_id uuid references public.profiles(id) not null,
    latitude double precision not null,
    longitude double precision not null,
    accuracy double precision,
    heading double precision,
    speed double precision,
    recorded_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index idx_job_locations_job_id on public.job_locations(job_id);
create index idx_job_locations_recorded_at on public.job_locations(recorded_at);

-- 5. Earnings Table
create table public.earnings (
    id uuid default uuid_generate_v4() primary key,
    driver_id uuid references public.drivers(id) not null,
    job_id uuid references public.jobs(id) not null unique,
    amount decimal(10,2) not null,
    status text not null default 'completed' check (status in ('pending', 'completed', 'refunded')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. Notifications Table
create table public.notifications (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    title text not null,
    message text not null,
    is_read boolean default false not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. Settings Table
create table public.settings (
    id uuid default uuid_generate_v4() primary key,
    setting_key text unique not null,
    setting_value text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Helper Function: Safe Role Fetching (Prevents Recursive RLS)
create or replace function public.get_my_role()
returns text
security definer
set search_path = public
language sql as $$
    select role from public.profiles where id = auth.uid();
$$;

-- Function & Trigger: Automatic Profile Generation After Signup
create or replace function public.handle_new_user()
returns trigger
security definer
set search_path = public
language plpgsql as $$
begin
    insert into public.profiles (id, full_name, phone, role, status)
    values (
        new.id,
        coalesce(new.raw_user_meta_data->>'full_name', 'User'),
        coalesce(new.raw_user_meta_data->>'phone', '-'),
        coalesce(new.raw_user_meta_data->>'role', 'user'),
        'active'
    );
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user();