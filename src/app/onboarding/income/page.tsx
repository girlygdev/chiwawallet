import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { OnboardingSkeleton } from "@/components/onboarding/onboarding-skeleton";
import { OnboardingFrame } from "@/components/onboarding/onboarding-frame";
import { getCurrentBudget } from "@/lib/current-budget";
import { isOnboarded, ONBOARDING_PATHS } from "@/lib/onboarding";
import { describeSchedule, scheduleFromBudget } from "@/lib/periods";
import { requireConsentedUser } from "@/lib/require-app-user";
import { createClient } from "@/lib/supabase/server";
import { IncomeStep } from "./income-step";

export const metadata: Metadata = { title: "Income · Chiwawallet" };

export default function IncomeStepPage({ searchParams }: PageProps<"/onboarding/income">) {
  // Cache Components: the login check reads cookies, so it sits in <Suspense>.
  return (
    <Suspense fallback={<OnboardingSkeleton step={2} />}>
      <IncomeStepContent searchParams={searchParams} />
    </Suspense>
  );
}

async function IncomeStepContent({ searchParams }: Pick<PageProps<"/onboarding/income">, "searchParams">) {
  await requireConsentedUser();
  const budget = await getCurrentBudget();
  if (!budget) redirect(ONBOARDING_PATHS.budget);
  if (isOnboarded(budget)) redirect("/dashboard");

  const supabase = await createClient();
  const { data: sources, error } = await supabase
    .from("income_sources")
    .select("id, name, amount, amount_varies, pay_slot")
    .eq("budget_id", budget.id)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Couldn't load income sources: ${error.message}`, { cause: error });

  const schedule = scheduleFromBudget(budget);
  // Set by saveBudget() when a frequency change moved one-payday income.
  const moved = Number((await searchParams).moved) || 0;

  return (
    <OnboardingFrame
      step={2}
      title="Where does your money come from?"
      subtitle="Add each income and the payday it lands on."
      subtitleDesktop="Add each income and the payday it lands on. Different amounts on each payday are fine."
      backHref={ONBOARDING_PATHS.budget}
      doneDetails={[describeSchedule(schedule)]}
    >
      {moved > 0 && sources.length > 0 && (
        <p role="status" className="max-w-[680px] rounded-[14px] bg-info-bg px-4 py-3 text-sm font-bold text-info-fg">
          You now have one payday, so {moved === 1 ? "1 income" : `${moved} incomes`} moved to Every payday.
          Check the amounts below.
        </p>
      )}
      <IncomeStep sources={sources} schedule={schedule} />
    </OnboardingFrame>
  );
}
