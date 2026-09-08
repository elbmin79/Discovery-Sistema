create or replace function public.query_pickup_history(range_from date, range_to date, page_limit int, page_offset int, live_rows jsonb, live_lates jsonb default '[]')
returns jsonb
language sql stable security invoker
set search_path = public
as $$
  with candidates as (
    select trip_id, jornada, record from public.pickup_history where jornada between range_from and range_to
    union all
    select value->>'tripId', (value->>'jornada')::date, value from jsonb_array_elements(live_rows)
    where (value->>'jornada')::date between range_from and range_to
      and not exists (select 1 from public.pickup_history where trip_id = value->>'tripId')
  ), totals as (
    select jornada, jsonb_build_object(
      'total', count(*),
      'delivered', count(*) filter (where record->>'status' = 'delivered'),
      'cancelled', count(*) filter (where record->>'status' = 'cancelled'),
      'averageWait', round(avg((record->>'waitMinutes')::numeric))
    ) as summary from candidates group by jornada
  ), paged as (
    select * from candidates
    order by jornada desc, coalesce(record->>'arrivedAt', record->>'requestedAt') desc nulls last, trip_id
    limit page_limit offset page_offset
  ), lates as (
    select jornada, record from public.pickup_late_history where jornada between range_from and range_to
    union all
    select (value->>'jornada')::date, value from jsonb_array_elements(live_lates)
    where (value->>'jornada')::date between range_from and range_to
      and not exists (select 1 from public.pickup_late_history where id = value->>'id')
  ), days as (
    select jornada from paged union select jornada from lates
  )
  select jsonb_build_object(
    'from', range_from, 'to', range_to,
    'total', (select count(*) from candidates),
    'summary', (select jsonb_build_object('total', count(*),
      'delivered', count(*) filter (where record->>'status' = 'delivered'),
      'cancelled', count(*) filter (where record->>'status' = 'cancelled'),
      'averageWait', round(avg((record->>'waitMinutes')::numeric))) from candidates),
    'rows', coalesce((select jsonb_agg(record order by jornada desc, coalesce(record->>'arrivedAt', record->>'requestedAt') desc nulls last, trip_id) from paged), '[]'::jsonb),
    'latePickups', coalesce((select jsonb_agg(record order by jornada desc) from lates), '[]'::jsonb),
    'days', coalesce((select jsonb_agg(jsonb_build_object('jornada', days.jornada,
      'summary', coalesce((select summary from totals where totals.jornada = days.jornada), '{"total":0,"delivered":0,"cancelled":0}'::jsonb),
      'rows', coalesce((select jsonb_agg(record order by coalesce(record->>'arrivedAt', record->>'requestedAt') desc nulls last, trip_id) from paged where paged.jornada = days.jornada), '[]'::jsonb),
      'latePickups', coalesce((select jsonb_agg(record) from lates where lates.jornada = days.jornada), '[]'::jsonb)
    ) order by days.jornada desc) from days), '[]'::jsonb)
  );
$$;
revoke all on function public.query_pickup_history(date, date, int, int, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.query_pickup_history(date, date, int, int, jsonb, jsonb) to service_role;
