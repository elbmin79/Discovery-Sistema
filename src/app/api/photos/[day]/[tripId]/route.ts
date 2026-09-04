import { serverSession } from "@/lib/auth/server-session";
import { ARRIVAL_BUCKET } from "@/lib/arrival-photos";
import { validJornada } from "@/lib/history";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
import { readSnapshot } from "@/lib/store";
import { retentionCutoff } from "@/lib/store/history-maintenance";

export async function GET(request: Request, context: { params: Promise<{ day: string; tripId: string }> }) {
  const session = serverSession(request);
  if (session?.role !== "staff") return new Response(null, { status: 401 });
  const { day, tripId } = await context.params;
  if (!validJornada(day) || day < retentionCutoff() || !/^[a-zA-Z0-9_-]+\.jpg$/.test(tripId) || !isSupabaseConfigured()) return new Response(null, { status: 404 });
  if (!session.isAdmin && !(await readSnapshot()).trips.some((trip) => trip.arrivalPhoto === `${day}/${tripId}`)) return new Response(null, { status: 403 });
  const { data, error } = await getSupabaseAdmin().storage.from(ARRIVAL_BUCKET).createSignedUrl(`${day}/${tripId}`, 60);
  if (error || !data) return new Response(null, { status: 404 });
  return new Response(null, { status: 302, headers: { Location: data.signedUrl, "Cache-Control": "private, no-store" } });
}
