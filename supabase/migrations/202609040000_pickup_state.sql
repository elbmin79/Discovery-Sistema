create table if not exists public.pickup_state (
  id text primary key,
  snapshot jsonb not null,
  version bigint not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.pickup_state enable row level security;
grant all on public.pickup_state to service_role;
