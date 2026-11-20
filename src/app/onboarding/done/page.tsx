import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { OnboardingDoneSkeleton } from "@/components/onboarding/onboarding-skeleton";
import { FirstPeriodCard } from "@/components/onboarding/first-period-card";
import { StepHeading } from "@/components/onboarding/step-heading";
import { getFirstPeriodInfo } from "@/lib/onboarding-data";
import { requireAppUser } from "@/lib/require-app-user";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "You're all set · Chiwawallet" };

export default function DonePage() {
  // Cache Components: the login check reads cookies, so it sits in <Suspense>.
  return (
    <Suspense fallback={<OnboardingDoneSkeleton />}>
      <Done />
    </Suspense>
  );
}

// "You're all set!" (onboarding.md §6). Phones: full screen. From 1024px: the
// same content as a centered card on mint (plan review 4.10).
async function Done() {
  // Only for users who finished setup; anyone else goes back to onboarding.
  const { budget } = await requireAppUser();
  const info = await getFirstPeriodInfo();
  if (!info) throw new Error("Finished setup but no budget found.");

  // The saved answer to "Has your pay already arrived?" for this period.
  const supabase = await createClient();
  const { data: period } = await supabase
    .from("budget_periods")
    .select("first_pay_received")
    .eq("budget_id", budget.id)
    .eq("start_date", info.period.start)
    .maybeSingle();

  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-bg px-5 pt-10 pb-[calc(24px+env(safe-area-inset-bottom))] lg:items-center lg:justify-center lg:bg-mint lg:py-12">
      <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col items-center gap-5 text-center lg:max-w-[520px] lg:flex-none lg:rounded-xl lg:border-2 lg:border-sticker lg:bg-surface lg:p-10 lg:shadow-sticker-lg">
        <span className="flex size-[176px] items-center justify-center rounded-full bg-mint lg:size-[140px] lg:bg-bg">
          {/* Decorative: the heading says what happened. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, no optimisation needed */}
          <img src="/logo-mark.svg" alt="" width={140} height={140} className="lg:size-[110px]" />
        </span>
        <div className="flex flex-col gap-2">
          <StepHeading>You&apos;re all set!</StepHeading>
          <p className="text-[15px] text-text-3">Your budget is ready. Here&apos;s your first payday period.</p>
        </div>

        {/* The sticker card is this screen's one hero element; on desktop the
            whole card already has the sticker, so the inner card goes flat. */}
        <FirstPeriodCard
          heading="First period"
          tag={info.tag}
          start={info.period.start}
          end={info.period.end}
          paydayLabel={info.paydayLabel}
          expectedIncome={info.expectedIncome}
          openingBalance={budget.opening_balance}
          payReceived={period?.first_pay_received ?? false}
          className="w-full text-left shadow-sticker lg:border-[1.5px] lg:border-line lg:shadow-none"
        />

        <p className="w-full rounded-[14px] bg-warn-bg px-4 py-3 text-left text-sm font-bold text-warn-fg">
          Tip: tap the + button anytime to log an expense in seconds.
        </p>

        <Link
          href="/dashboard"
          className="mt-auto flex h-[54px] w-full items-center justify-center rounded-md bg-primary text-[17px] font-extrabold text-primary-foreground outline-link hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 lg:mt-2"
        >
          Go to my dashboard
        </Link>
      </div>
    </main>
  );
}
