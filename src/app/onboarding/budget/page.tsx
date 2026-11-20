import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { OnboardingSkeleton } from "@/components/onboarding/onboarding-skeleton";
import { OnboardingFrame } from "@/components/onboarding/onboarding-frame";
import { getCurrentBudget } from "@/lib/current-budget";
import { isOnboarded } from "@/lib/onboarding";
import { todayInManila } from "@/lib/periods";
import { requireConsentedUser } from "@/lib/require-app-user";
import type { BudgetInput, Frequency } from "@/lib/validation/budget";
import { BudgetForm } from "./budget-form";

export const metadata: Metadata = { title: "Your budget · Chiwawallet" };

export default function BudgetStepPage() {
  // Cache Components: the login check reads cookies, so it sits in <Suspense>.
  return (
    <Suspense fallback={<OnboardingSkeleton step={1} />}>
      <BudgetStep />
    </Suspense>
  );
}

async function BudgetStep() {
  const { profile } = await requireConsentedUser();
  const budget = await getCurrentBudget();
  if (isOnboarded(budget)) redirect("/dashboard");

  // Coming back with Back: the saved values. First visit: the spec's defaults.
  const defaults: BudgetInput = {
    name: budget?.name ?? "My budget",
    frequency: (budget?.frequency as Frequency | undefined) ?? "semi_monthly",
    payDay1: budget ? budget.pay_day_1 : 15,
    payDay2: budget ? budget.pay_day_2 : 30,
    payWeekday: budget?.pay_weekday ?? null,
    weekStart: profile.week_start === "sunday" ? "sunday" : "monday",
  };

  const name = profile.display_name;
  return (
    <OnboardingFrame
      step={1}
      title={name ? `Hi ${name}! Let's set up your budget.` : "Let's set up your budget."}
      subtitle="We'll plan around the days you get paid."
      subtitleDesktop="We'll plan around the days you get paid, not the calendar month."
    >
      {/* Today in Manila, read after the login check so it's per request. */}
      <BudgetForm defaults={defaults} today={todayInManila(new Date())} />
    </OnboardingFrame>
  );
}
