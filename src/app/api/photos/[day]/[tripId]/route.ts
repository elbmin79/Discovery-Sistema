import { serverSession } from "@/lib/auth/server-session";
import { ARRIVAL_BUCKET } from "@/lib/arrival-photos";
import { validJornada } from "@/lib/history";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
import { readSnapshot } from "@/lib/store";
import { retentionCutoff } from "@/lib/store/history-maintenance";

export async function GET(request: Request, context: { params: Promise<{ day: string; tripId: string }> }) {
  const { day, tripId } = await context.params;
  if (!validJornada(day) || day < retentionCutoff() || !/^[a-zA-Z0-9_-]+\.jpg$/.test(tripId) || !isSupabaseConfigured()) {
    return new Response(null, { status: 404 });
  }

  const path = `${day}/${tripId}`;
  const snapshot = await readSnapshot();
  const live = snapshot.trips.some((trip) => trip.arrivalPhoto === path);
  if (!live) {
    const session = serverSession(request);
    if (session?.role !== "staff" || !session.isAdmin) {
      return new Response(null, { status: 401 });
    }
  }

  const { data, error } = await getSupabaseAdmin().storage.from(ARRIVAL_BUCKET).download(path);
  if (error || !data) return new Response(null, { status: 404 });
  const bytes = Buffer.from(await data.arrayBuffer());
  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, max-age=60",
    },
  });
}
