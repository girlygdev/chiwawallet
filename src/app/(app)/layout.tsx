import { BottomBar } from "@/components/shell/bottom-bar";
import { Sidebar } from "@/components/shell/sidebar";

// The frame around every logged-in page (app-shell.md): the sidebar from
// 768px up, the bottom bar below that. Each page brings its own header and
// content, and checks the login itself (see requireAppUser).
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 bg-bg">
      <Sidebar />
      {/* Bottom padding = the bottom bar's height, so the last row is never
          hidden behind it on phones. */}
      <div className="flex min-w-0 flex-1 flex-col pb-[calc(84px+env(safe-area-inset-bottom))] md:pb-0">
        {children}
      </div>
      <BottomBar />
    </div>
  );
}
