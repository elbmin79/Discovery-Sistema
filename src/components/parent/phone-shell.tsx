import type { ReactNode } from "react";

export function PhoneShell({ children, paper = false }: { children: ReactNode; paper?: boolean }) {
  return (
    <div className="h-dvh bg-forest-deep md:flex md:h-auto md:min-h-dvh md:items-center md:justify-center md:p-6">
      <div
        className={`relative mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden ${
          paper ? "bg-[#fbfaf7]" : "bg-cream"
        } md:h-[844px] md:max-h-[844px] md:min-h-0 md:rounded-[2rem] md:border md:border-forest-soft`}
      >
        {children}
      </div>
    </div>
  );
}
