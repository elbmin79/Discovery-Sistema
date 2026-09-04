create table if not exists public.pickup_history (
  trip_id text primary key,
  jornada date not null,
  code text not null,
  guardian_id text,
  picker_name text, picker_relation text, picker_kind text,
  vehicle_label text, vehicle_color text, plate text, tag_id text,
  student_names text[] not null default '{}',
  level text, zone_name text,
  method text, arrival_via text, departed_via text,
  requested_at timestamptz, arrived_at timestamptz,
  delivered_at timestamptz, departed_at timestamptz, cancelled_at timestamptz,
  delivered_by text, status text not null, wait_minutes int,
  photo_path text,
  detail jsonb,
  record jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists pickup_history_jornada_idx on public.pickup_history (jornada desc, arrived_at desc nulls last, trip_id);
create index if not exists pickup_history_guardian_idx on public.pickup_history (guardian_id, jornada desc);
alter table public.pickup_history enable row level security;
revoke all on public.pickup_history from anon, authenticated;
grant all on public.pickup_history to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('arrival-photos', 'arrival-photos', false, 5242880, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.pickup_late_history (
  id text primary key,
  jornada date not null,
  record jsonb not null
);
create index if not exists pickup_late_history_jornada_idx on public.pickup_late_history (jornada desc);
alter table public.pickup_late_history enable row level security;
revoke all on public.pickup_late_history from anon, authenticated;
grant all on public.pickup_late_history to service_role;

create or replace function public.commit_pickup_state(expected_version bigint, next_snapshot jsonb, archive_rows jsonb, late_rows jsonb)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare item jsonb;
begin
  perform 1 from public.pickup_state where id = 'live' and version = expected_version for update;
  if not found then return false; end if;
  for item in select value from jsonb_array_elements(archive_rows) loop
    insert into public.pickup_history (
      trip_id, jornada, code, guardian_id, picker_name, picker_relation, picker_kind,
      vehicle_label, vehicle_color, plate, tag_id, student_names, level, zone_name,
      method, arrival_via, departed_via, requested_at, arrived_at, delivered_at,
      departed_at, cancelled_at, delivered_by, status, wait_minutes, photo_path, detail, record
    ) values (
      item->>'tripId', (item->>'jornada')::date, item->>'code', item->>'guardianId',
      item->>'pickerName', item->>'pickerRelation', item->>'pickerKind',
      item->>'vehicleLabel', item->>'vehicleColor', item->>'plate', item->>'tagId',
      array(select jsonb_array_elements_text(item->'studentNames')), item->>'level', item->>'zoneName',
      item->>'method', item->>'arrivalVia', item->>'departedVia',
      (item->>'requestedAt')::timestamptz, (item->>'arrivedAt')::timestamptz,
      (item->>'deliveredAt')::timestamptz, (item->>'departedAt')::timestamptz,
      (item->>'cancelledAt')::timestamptz, item->>'deliveredBy', item->>'status',
      (item->>'waitMinutes')::int, item->>'photoPath', item->'detail', item
    ) on conflict (trip_id) do nothing;
  end loop;
  for item in select value from jsonb_array_elements(late_rows) loop
    insert into public.pickup_late_history (id, jornada, record)
    values (item->>'id', (item->>'jornada')::date, item)
    on conflict (id) do nothing;
  end loop;
  update public.pickup_state set snapshot = next_snapshot, version = expected_version + 1,
    updated_at = (next_snapshot->>'updatedAt')::timestamptz where id = 'live';
  return true;
end;
$$;
revoke all on function public.commit_pickup_state(bigint, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.commit_pickup_state(bigint, jsonb, jsonb, jsonb) to service_role;
