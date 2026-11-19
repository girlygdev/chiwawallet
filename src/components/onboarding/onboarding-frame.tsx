import { ArrowLeft, Check } from "lucide-react";
import Link from "next/link";
import { Logo, Wordmark } from "@/components/auth/logo";
import { ONBOARDING_PATHS } from "@/lib/onboarding";
import { cn } from "@/lib/utils";
import { StepHeading } from "./step-heading";

const STEPS = [
  { name: "Your budget", about: "How often you get paid", href: ONBOARDING_PATHS.budget },
  { name: "Income", about: "Where your money comes from", href: ONBOARDING_PATHS.income },
  { name: "Starting point", about: "What you have right now", href: ONBOARDING_PATHS.start },
];

type Props = {
  step: 1 | 2 | 3;
  title: string;
  subtitle: string;
  /** A longer subtitle for desktop, when the spec has one (onboarding.md §3–4). */
  subtitleDesktop?: string;
  /** Mobile top bar: the previous step's link. Step 1 shows the logo instead. */
  backHref?: string;
  /** What was chosen in finished steps, for the desktop rail's detail lines. */
  doneDetails?: string[];
  children: React.ReactNode;
};

// The page around every onboarding step (onboarding.md §2): no app bottom bar
// or sidebar. Under 1024px: top bar, progress bar, title. From 1024px: a mint
// step rail on the left and the step on the right.
export function OnboardingFrame({
  step,
  title,
  subtitle,
  subtitleDesktop,
  backHref,
  doneDetails = [],
  children,
}: Props) {
  return (
    <div className="flex min-h-dvh flex-1 bg-bg">
      <StepRail step={step} doneDetails={doneDetails} />

      <main className="flex min-w-0 flex-1 flex-col gap-[18px] px-5 pt-4 pb-[calc(24px+env(safe-area-inset-bottom))] lg:gap-8 lg:px-[clamp(20px,4vw,64px)] lg:py-12">
        {/* Mobile top bar and progress. */}
        <div className="flex flex-col gap-3 lg:hidden">
          <div className="flex h-11 items-center justify-between">
            {backHref ? (
              <Link
                href={backHref}
                aria-label="Back"
                className="-ml-2 flex size-11 items-center justify-center rounded-full text-ink outline-link focus-visible:outline-2"
              >
                <ArrowLeft aria-hidden size={22} />
              </Link>
            ) : (
              <Logo size={36} />
            )}
            <p className="text-[13px] font-extrabold text-text-3">Step {step} of 3</p>
          </div>
          {/* Hidden from screen readers: "Step N of 3" above says the same. */}
          <div aria-hidden className="flex gap-1.5">
            {STEPS.map((s, i) => (
              <span
                key={s.href}
                className={cn("h-1.5 flex-1 rounded-full", i < step ? "bg-green-500" : "bg-line")}
              />
            ))}
          </div>
        </div>

        <header className="flex max-w-[720px] flex-col gap-1">
          <p className="hidden text-[13px] font-extrabold tracking-wide text-text-3 uppercase lg:block">
            Step {step} of 3
          </p>
          <StepHeading>{title}</StepHeading>
          <p className="text-[15px] text-text-3 lg:text-[17px]">
            <span className={cn(subtitleDesktop && "lg:hidden")}>{subtitle}</span>
            {subtitleDesktop && <span className="hidden lg:inline">{subtitleDesktop}</span>}
          </p>
        </header>

        {children}
      </main>
    </div>
  );
}

// Desktop step list (onboarding.md §2 "Step list"). Finished steps link back.
function StepRail({ step, doneDetails }: { step: number; doneDetails: string[] }) {
  return (
    <aside className="hidden w-[300px] shrink-0 flex-col gap-8 bg-mint px-7 py-8 lg:flex">
      <div className="flex items-center gap-2">
        <Logo size={40} decorative />
        <Wordmark className="text-[22px] leading-none" />
      </div>

      <nav aria-label="Setup steps">
        <ol className="flex flex-col gap-1.5">
          {STEPS.map((s, i) => {
            const number = i + 1;
            const state = number < step ? "done" : number === step ? "current" : "later";
            const row = (
              <>
                <span
                  className={cn(
                    "flex size-[30px] shrink-0 items-center justify-center rounded-full text-sm font-extrabold",
                    state === "done" && "bg-green-500 text-white",
                    state === "current" && "bg-green-600 text-white",
                    state === "later" && "bg-line text-text-2",
                  )}
                >
                  {state === "done" ? <Check aria-hidden size={16} strokeWidth={3} /> : number}
                </span>
                <span className="flex flex-col">
                  <span className={cn("font-extrabold", state === "later" ? "text-text-2" : "text-ink")}>
                    {s.name}
                    {state === "done" && <span className="sr-only"> (done)</span>}
                  </span>
                  <span className="text-[13px] text-text-3">
                    {state === "done" ? (doneDetails[i] ?? s.about) : s.about}
                  </span>
                </span>
              </>
            );
            const rowClass = "flex items-center gap-3 rounded-[14px] px-3.5 py-3";
            return (
              <li key={s.href}>
                {state === "done" ? (
                  <Link
                    href={s.href}
                    className={cn(rowClass, "outline-link hover:bg-surface/60 focus-visible:outline-2")}
                  >
                    {row}
                  </Link>
                ) : (
                  <div
                    aria-current={state === "current" ? "step" : undefined}
                    className={cn(rowClass, state === "current" && "border-2 border-ink bg-surface")}
                  >
                    {row}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      <p className="mt-auto text-[13px] text-text-3">You can change any of this later in Settings.</p>
    </aside>
  );
}
