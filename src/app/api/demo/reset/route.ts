import { mutateStore } from "@/lib/store";

export async function POST() {
  return Response.json(await mutateStore((store) => store.reset()));
}
