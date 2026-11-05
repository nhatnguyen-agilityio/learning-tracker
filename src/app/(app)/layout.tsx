import type { ReactNode } from "react";
import { AppBottomNav, AppSidebar } from "@/components/app-nav";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh min-h-0 w-full">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
          <div className="mx-auto flex max-w-160 flex-col gap-4 px-4 py-6 min-[900px]:px-6 min-[900px]:py-8">
            {children}
          </div>
        </main>
        <AppBottomNav />
      </div>
    </div>
  );
}
