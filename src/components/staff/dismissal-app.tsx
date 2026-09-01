"use client";

import { useSession } from "@/hooks/use-session";
import { StaffLogin } from "@/components/staff/staff-login";
import { DismissalBoard } from "@/components/staff/dismissal-board";

export function DismissalApp() {
  const { session, setSession, clearSession } = useSession("staff");

  if (!session) {
    return <StaffLogin onSignedIn={setSession} />;
  }

  return <DismissalBoard session={session} onLogout={clearSession} />;
}
