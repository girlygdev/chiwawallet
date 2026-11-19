import { redirect } from "next/navigation";
import { countIncomeSources, getCurrentBudget } from "@/lib/current-budget";
import { isOnboarded, ONBOARDING_PATHS } from "@/lib/onboarding";
import { describeSchedule, scheduleFromBudget } from "@/lib/periods";
import { requireConsentedUser } from "@/lib/require-app-user";
import { OnboardingFrame } from "./onboarding-frame";

// Temporary stand-in for steps 2 and 3 until 2d-2 and 2d-3 build them, so
// Continue and Back can be tried now. Delete when both steps exist.
export async function StepPlaceholder({ step }: { step: 2 | 3 }) {
  await requireConsentedUser();
  const budget = await getCurrentBudget();
  if (!budget) redirect(ONBOARDING_PATHS.budget);
  if (isOnboarded(budget)) redirect("/dashboard");
  if (step === 3 && (await countIncomeSources(budget.id)) === 0) redirect(ONBOARDING_PATHS.income);

  return (
    <OnboardingFrame
      step={step}
      title={step === 2 ? "Where does your money come from?" : "Where are you starting from?"}
      subtitle="This step is coming next."
      backHref={step === 2 ? ONBOARDING_PATHS.budget : ONBOARDING_PATHS.income}
      doneDetails={[describeSchedule(scheduleFromBudget(budget))]}
    >
      <p className="text-[15px] text-text-3">This feature will come to you soon.</p>
    </OnboardingFrame>
  );
}
