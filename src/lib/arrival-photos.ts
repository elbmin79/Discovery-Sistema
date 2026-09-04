import { jornadaOf } from "./school";
import { getSupabaseAdmin, isSupabaseConfigured } from "./supabase/admin";

export const ARRIVAL_BUCKET = "arrival-photos";

export async function storeArrivalPhoto(photo: string | undefined, tripId: string, arrivedAt: string) {
  if (!photo || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(photo) || photo.length > 7_000_000) return undefined;
  const bytes = Buffer.from(photo.split(",")[1], "base64");
  if (bytes.length > 5_242_880 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return undefined;
  if (!isSupabaseConfigured()) return photo;
  const path = `${jornadaOf(arrivedAt)}/${tripId}.jpg`;
  try {
    const { error } = await getSupabaseAdmin().storage.from(ARRIVAL_BUCKET).upload(path, bytes, { contentType: "image/jpeg", upsert: false });
    if (error && !("statusCode" in error && String(error.statusCode) === "409")) {
      console.error("No se pudo guardar la foto de llegada", error.message);
      return undefined;
    }
    return path;
  } catch {
    console.error("Storage no disponible para la foto de llegada");
    return undefined;
  }
}
