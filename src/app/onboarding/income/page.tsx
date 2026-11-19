import { Suspense } from "react";
import { StepPlaceholder } from "@/components/onboarding/step-placeholder";

// Placeholder until task 2d-2 builds this step.
export default function Page() {
  return (
    <Suspense>
      <StepPlaceholder step={2} />
    </Suspense>
  );
}
