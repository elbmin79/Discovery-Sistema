import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";

function sql(query: string) {
  return execFileSync("docker", ["exec", "-i", "discovery-history-postgres", "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-tA"], { input: query, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
}

test("Postgres archive transaction handles retries, duplication, and rollback", () => {
  sql(`do $$ begin create role anon; exception when duplicate_object then null; end $$;
    do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
    do $$ begin create role service_role bypassrls; exception when duplicate_object then null; end $$;
    create schema if not exists storage;
    create table if not exists storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table if not exists public.pickup_state (id text primary key, snapshot jsonb, version bigint, updated_at timestamptz);
    grant all on public.pickup_state to service_role;`);
  sql(readFileSync("supabase/migrations/202609040001_pickup_history.sql", "utf8"));
  sql("drop function if exists public.query_pickup_history(date,date,int,int,jsonb);");
  sql(readFileSync("supabase/migrations/202609040002_history_query.sql", "utf8"));
  sql("truncate public.pickup_state, public.pickup_history, public.pickup_late_history; insert into public.pickup_state values ('live', '{\"trips\":[{\"id\":\"test-trip\"}]}', 1, now());");
  const row = JSON.stringify([{ tripId: "test-trip", jornada: "2026-09-03", code: "1234", studentNames: ["Alumno"], status: "delivered", photoPath: "2026-09-03/test-trip.jpg", detail: { events: [], requests: [] } }]);
  const snapshot = JSON.stringify({ trips: [], updatedAt: new Date().toISOString() });
  const late = JSON.stringify([{ id: "late-test", jornada: "2026-09-02", notice: { note: "Tráfico" } }]);
  const commit = (version: number) => sql(`select public.commit_pickup_state(${version}, '${snapshot}', '${row}', '${late}');`);
  assert.equal(commit(0), "f");
  assert.equal(sql("select count(*) from pickup_history;"), "0");
  assert.equal(commit(1), "t");
  assert.equal(sql("select snapshot->'trips' from pickup_state;"), "[]");
  assert.equal(sql("select count(*) from pickup_history;"), "1");
  assert.equal(sql("select count(*) from pickup_late_history;"), "1");
  assert.equal(commit(1), "f");
  assert.equal(commit(2), "t");
  assert.equal(sql("select count(*) from pickup_history;"), "1");
  assert.throws(() => sql(`select public.commit_pickup_state(3, '${snapshot}', '[{"tripId":"invalid","jornada":"bad-date"}]', '[]');`));
  assert.equal(sql("select version from pickup_state;"), "3");
  assert.equal(sql("select count(*) from pickup_history;"), "1");
  assert.equal(sql("select public from storage.buckets where id='arrival-photos';"), "f");
  assert.equal(sql("select has_table_privilege('anon','public.pickup_history','select');"), "f");
  assert.equal(sql("select has_function_privilege('anon','public.commit_pickup_state(bigint,jsonb,jsonb,jsonb)','execute');"), "f");
  const page = JSON.parse(sql(`select query_pickup_history('2026-09-01','2026-09-03',200,0,'[{"tripId":"live","jornada":"2026-09-03","status":"arrived","requestedAt":"2026-09-03T22:00:00Z","live":true}]');`));
  assert.equal(page.total, 2);
  assert.equal(page.summary.delivered, 1);
  assert.equal(page.rows[0].live, true);
  assert.equal(page.days[1].latePickups.length, 1);
  const past = JSON.parse(sql("select query_pickup_history('2026-09-02','2026-09-02',200,0,'[]');"));
  assert.equal(past.total, 0);
  assert.equal(past.days.length, 1);
});
