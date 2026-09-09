import { mutateStore } from "@/lib/store";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      studentIds?: string[];
      note?: string;
    };
    if (!Array.isArray(body.studentIds) || body.studentIds.length === 0) {
      throw new Error("Selecciona al menos un alumno.");
    }
    return Response.json(
      await mutateStore((store) => store.removeStudentsFromTrip(id, body.studentIds!, body.note)),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo quitar al alumno.";
    return Response.json({ error: message }, { status: 400 });
  }
}
