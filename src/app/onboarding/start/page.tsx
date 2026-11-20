import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { OnboardingSkeleton } from "@/components/onboarding/onboarding-skeleton";
import { OnboardingFrame } from "@/components/onboarding/onboarding-frame";
import { isOnboarded, ONBOARDING_PATHS } from "@/lib/onboarding";
import { getFirstPeriodInfo } from "@/lib/onboarding-data";
import { requireConsentedUser } from "@/lib/require-app-user";
import { StartForm } from "./start-form";

export const metadata: Metadata = { title: "Starting point · Chiwawallet" };

export default function StartStepPage() {
  // Cache Components: the login check reads cookies, so it sits in <Suspense>.
  return (
    <Suspense fallback={<OnboardingSkeleton step={3} />}>
      <StartStep />
    </Suspense>
  );
}

async function StartStep() {
  await requireConsentedUser();
  const info = await getFirstPeriodInfo();
  if (!info) redirect(ONBOARDING_PATHS.budget);
  if (isOnboarded(info.budget)) redirect("/dashboard");
  if (info.incomeCount === 0) redirect(ONBOARDING_PATHS.income);

  return (
    <OnboardingFrame
      step={3}
      title="Where are you starting from?"
      subtitle="Total money you have right now: bank, cash and e-wallets."
      backHref={ONBOARDING_PATHS.income}
      doneDetails={info.doneDetails}
    >
      <StartForm
        period={info.period}
        tag={info.tag}
        paydayDate={info.paydayDate}
        paydayLabel={info.paydayLabel}
        expectedIncome={info.expectedIncome}
      />
    </OnboardingFrame>
  );
}
