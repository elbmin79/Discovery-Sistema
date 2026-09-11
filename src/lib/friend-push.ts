import { broadcastSchoolPush } from "@/lib/broadcast-push";
import { parentName } from "@/lib/parent-home";
import type { Snapshot } from "@/lib/types";

function kidNames(snapshot: Snapshot, studentIds: string[]) {
  return studentIds
    .map((id) => snapshot.students.find((student) => student.id === id))
    .filter((student): student is NonNullable<typeof student> => Boolean(student))
    .map((student) => parentName(student))
    .join(", ");
}

/** Demo: avisa a todos los dispositivos suscritos cuando hay recogida de hijo ajeno. */
export async function pushFriendPickupRequested(snapshot: Snapshot, tripId: string) {
  const trip = snapshot.trips.find((item) => item.id === tripId);
  if (!trip) return;
  const friendRequests = snapshot.requests.filter(
    (request) =>
      request.tripId === tripId &&
      request.authorization &&
      request.status !== "cancelled" &&
      request.status !== "delivered",
  );
  if (!friendRequests.length) return;
  const kids = kidNames(
    snapshot,
    friendRequests.map((request) => request.studentId),
  );
  const requester = snapshot.guardians.find((item) => item.id === trip.guardianId);
  const who = requester ? `${requester.firstName} ${requester.lastName}` : trip.pickerName;
  await broadcastSchoolPush({
    kind: "friend_request",
    tag: `amigo-pedir-${tripId}`,
    title: `Recogida amiga: ${kids}`,
    body: `${who} quiere recoger a ${kids}. Abre la app para autorizar o cancelar.`,
    url: "/familia",
  });
}

export async function pushFriendPickupDelivered(snapshot: Snapshot, tripId: string, studentIds: string[]) {
  if (!studentIds.length) return;
  const trip = snapshot.trips.find((item) => item.id === tripId);
  if (!trip) return;
  const kids = kidNames(snapshot, studentIds);
  if (!kids) return;
  await broadcastSchoolPush({
    kind: "friend_delivered",
    tag: `amigo-entregado-${tripId}-${studentIds.join("-")}`,
    title: `Ya salió: ${kids}`,
    body: `${trip.pickerName} ya recogió a ${kids} en la escuela.`,
    url: "/familia",
  });
}
