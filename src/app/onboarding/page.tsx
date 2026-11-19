import { redirect } from "next/navigation";
import { Suspense } from "react";
import { countIncomeSources, getCurrentBudget } from "@/lib/current-budget";
import { nextOnboardingStep, ONBOARDING_PATHS } from "@/lib/onboarding";
import { requireConsentedUser } from "@/lib/require-app-user";

// /onboarding: sends the user to the first unfinished step (onboarding.md §1),
// or to the dashboard when setup is done. App pages send users here.
export default function OnboardingPage() {
  return (
    <Suspense>
      <ResumeOnboarding />
    </Suspense>
  );
}

async function ResumeOnboarding(): Promise<never> {
  await requireConsentedUser();
  const budget = await getCurrentBudget();
  const incomeCount = budget ? await countIncomeSources(budget.id) : 0;
  const step = nextOnboardingStep({ budget, incomeCount });
  redirect(step === "done" ? "/dashboard" : ONBOARDING_PATHS[step]);
}
