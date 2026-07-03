import { Sidebar } from "@/components/Sidebar";
import { Providers } from "@/components/providers";
import BetaNotice from "@/components/BetaNotice";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className="flex h-screen bg-slate-50 dark:bg-[#07070f] overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <BetaNotice />
          {children}
        </main>
      </div>
    </Providers>
  );
}
