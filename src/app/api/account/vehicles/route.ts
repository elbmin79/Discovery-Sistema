import { getStore } from "@/lib/store";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (body.action === "remove") {
      return Response.json(getStore().removeVehicle(body.id));
    }
    return Response.json(getStore().saveVehicle(body));
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo guardar el vehículo.";
    return Response.json({ error: message }, { status: 400 });
  }
}
