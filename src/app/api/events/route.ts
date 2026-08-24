import { getMemoryStore, isStoreShared, readSnapshot } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (snapshot: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(snapshot)}\n\n`));
      };

      send(await readSnapshot());

      let unsubscribe = () => {};
      let poll: ReturnType<typeof setInterval> | undefined;

      if (isStoreShared()) {
        poll = setInterval(() => {
          readSnapshot()
            .then(send)
            .catch(() => undefined);
        }, 2000);
      } else {
        unsubscribe = getMemoryStore().subscribe(send);
      }

      const ping = setInterval(() => {
        controller.enqueue(encoder.encode(`: ping\n\n`));
      }, 12000);

      const stop = () => {
        clearInterval(ping);
        if (poll) clearInterval(poll);
        unsubscribe();
        controller.close();
      };

      request.signal.addEventListener("abort", stop);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
