// The content area of every app page: up to about 1100px wide on desktop,
// 16px side padding on phones (app-shell.md §5).
export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col gap-4 px-4 py-4 md:gap-6 md:px-8 md:py-8">
      {children}
    </main>
  );
}
