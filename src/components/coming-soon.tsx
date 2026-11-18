import Link from "next/link";

// Placeholder for pages planned for a later week (Privacy Notice and Terms come in Week 8).
export function ComingSoon({ title }: { title: string }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-5 px-6 py-10 text-center">
      {/* Decorative: the page title already names the screen */}
      {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, no optimisation needed */}
      <img src="/logo-mark.svg" alt="" width={96} height={96} />
      <h1 className="font-display text-[28px] leading-[1.1] font-semibold text-ink">
        {title}
      </h1>
      <p className="text-[15px] text-text-3">This feature will come to you soon.</p>
      <Link href="/" className="font-extrabold text-green-600 hover:text-green-800">
        Back to home
      </Link>
    </main>
  );
}
