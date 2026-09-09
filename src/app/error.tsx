"use client";

import { SystemStatus } from "@/components/ui/system-status";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-cream px-4">
      <SystemStatus
        kind="error"
        context="general"
        title="Se nos trabó la salida"
        body="Algo inesperado pasó en la app. Puedes reintentar sin perder el ritmo de la fila."
        detail={error.message}
        onRetry={reset}
      />
    </main>
  );
}
