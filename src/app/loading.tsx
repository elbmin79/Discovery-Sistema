import { SystemStatus } from "@/components/ui/system-status";

export default function Loading() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-cream px-4">
      <SystemStatus kind="loading" context="general" />
    </main>
  );
}
