import { isSchoolBrandId } from "@/lib/school-brand";
import { mutateStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { brand?: unknown };
    if (!isSchoolBrandId(body.brand)) {
      return Response.json({ error: "Elige Discovery o Altius." }, { status: 400 });
    }
    const snapshot = await mutateStore((store) => store.setSchoolBrand(body.brand));
    return Response.json(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo cambiar la escuela.";
    return Response.json({ error: message }, { status: 400 });
  }
}
