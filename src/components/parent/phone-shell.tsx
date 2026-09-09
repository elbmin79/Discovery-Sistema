import type { ReactNode } from "react";

export function PhoneShell({ children, paper = false }: { children: ReactNode; paper?: boolean }) {
  return (
    <div className="min-h-dvh bg-forest-deep md:flex md:items-center md:justify-center md:p-6">
      <div className={`relative mx-auto flex min-h-dvh w-full max-w-md flex-col ${paper ? "bg-[#fbfaf7]" : "bg-cream"} md:min-h-[844px] md:max-h-[844px] md:overflow-hidden md:rounded-[2rem] md:border md:border-forest-soft`}>
        {children}
      </div>
    </div>
  );
}
