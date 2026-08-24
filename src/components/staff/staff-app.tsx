"use client";

import { useSession } from "@/hooks/use-session";
import { StaffBoard } from "@/components/staff/staff-board";
import { StaffLogin } from "@/components/staff/staff-login";

export function StaffApp() {
  const { session, setSession, clearSession } = useSession("staff");

  if (!session) {
    return <StaffLogin onSignedIn={setSession} />;
  }

  return <StaffBoard session={session} onLogout={clearSession} onSwitch={setSession} />;
}
