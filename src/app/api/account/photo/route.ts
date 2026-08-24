import { getStore } from "@/lib/store";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { studentId: string; photoUrl: string };
    return Response.json(getStore().updateStudentPhoto(body.studentId, body.photoUrl));
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo guardar la foto.";
    return Response.json({ error: message }, { status: 400 });
  }
}
