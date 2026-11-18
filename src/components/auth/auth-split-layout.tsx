import { PiggyBank, ReceiptText, Wallet } from "lucide-react";
import { Logo, Wordmark } from "./logo";

// The design doc doesn't list the feature rows' text; this copy is a placeholder to review.
const features = [
  { icon: Wallet, text: "See what's Safe to spend every payday" },
  { icon: ReceiptText, text: "Match each bill to the right paycheck" },
  { icon: PiggyBank, text: "Grow savings pots and pay off debts" },
];

// Split-screen auth layout (auth-screens.md §2) used by Log in and Sign up.
// Under 1024px only the form column shows, full screen on `bg`.
// From 1024px the mint pitch panel sits on the left and the form on white on the right.
// `compact` = 32px top padding on mobile instead of 40px (Sign up, which has the most fields).
export function AuthSplitLayout({
  children,
  compact = false,
}: {
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className="flex flex-1 flex-wrap bg-bg lg:bg-surface">
      <PitchPanel />
      <main
        className={`flex flex-[1_1_520px] flex-col px-6 pb-7 lg:items-center lg:justify-center lg:py-12 ${compact ? "pt-8" : "pt-10"}`}
      >
        <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col lg:flex-none">
          {children}
        </div>
      </main>
    </div>
  );
}

function PitchPanel() {
  return (
    <aside
      aria-label="About Chiwawallet"
      className="hidden flex-[1_1_520px] flex-col gap-8 bg-mint px-[clamp(24px,5vw,72px)] py-12 lg:flex"
    >
      <div className="flex items-center gap-3">
        <Logo size={56} decorative />
        <Wordmark className="text-[26px]" />
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="font-display text-[44px] leading-[1.05] font-semibold text-ink">
          Budget by payday, not by month.
        </h2>
        <p className="max-w-[460px] text-[17px] leading-[1.5] text-text-2">
          Plan every 15th and 30th, pay bills from the right paycheck, and watch
          your savings grow. <strong className="font-extrabold text-ink">Sit. Stay. Save.</strong>
        </p>
      </div>

      <ul className="flex flex-col gap-3">
        {features.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-3 text-[15px] font-bold text-ink">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-surface text-link">
              <Icon aria-hidden="true" className="size-5" />
            </span>
            {text}
          </li>
        ))}
      </ul>

      {/* Example only: static sample, not real data. The one sticker element in this area. */}
      <div
        aria-label="Example: Safe to spend ₱12,450 for Nov 15 to 29"
        role="img"
        className="mt-auto max-w-[360px] rounded-xl border-2 border-sticker bg-green-700 p-5 text-white shadow-sticker-lg"
      >
        <p className="text-[13px] font-extrabold tracking-[0.5px] uppercase">Safe to spend</p>
        <p className="font-display text-[42px] leading-[1.1] font-semibold">₱12,450</p>
        <p className="text-[13px] font-semibold">Nov 15 – 29</p>
      </div>
    </aside>
  );
}
