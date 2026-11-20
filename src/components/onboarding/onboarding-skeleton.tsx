import { Skeleton, SkeletonRegion } from "@/components/skeleton";
import { cn } from "@/lib/utils";

// Shown while an onboarding step loads its data from the server. Same layout
// as OnboardingFrame (mobile top bar and progress; desktop mint step rail),
// so nothing jumps when the real step arrives.
// `step` fills the progress bar; leave it out when the step isn't known yet
// (/onboarding works out which step to send you to).
export function OnboardingSkeleton({ step }: { step?: 1 | 2 | 3 }) {
  return (
    <SkeletonRegion className="flex min-h-dvh flex-1 bg-bg">
      {/* Desktop step rail */}
      <div className="hidden w-[300px] shrink-0 flex-col gap-8 bg-mint px-7 py-8 lg:flex">
        <Skeleton className="h-10 w-40 rounded-full" />
        <div className="flex flex-col gap-1.5">
          {[1, 2, 3].map((n) => (
            <div key={n} className="flex items-center gap-3 px-3.5 py-3">
              <Skeleton className="size-[30px] shrink-0 rounded-full" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-[18px] px-5 pt-4 pb-[calc(24px+env(safe-area-inset-bottom))] lg:gap-8 lg:px-[clamp(20px,4vw,64px)] lg:py-12">
        {/* Mobile top bar and progress */}
        <div className="flex flex-col gap-3 lg:hidden">
          <div className="flex h-11 items-center justify-between">
            <Skeleton className="size-9 rounded-full" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="flex gap-1.5">
            {[1, 2, 3].map((n) => (
              // The finished part of the bar stays green, like the real one.
              <span
                key={n}
                className={cn("h-1.5 flex-1 rounded-full", step && n <= step ? "bg-green-500" : "bg-line")}
              />
            ))}
          </div>
        </div>

        {/* Title and subtitle */}
        <div className="flex max-w-[720px] flex-col gap-2">
          <Skeleton className="hidden h-3.5 w-24 lg:block" />
          <Skeleton className="h-8 w-4/5 max-w-[480px]" />
          <Skeleton className="h-4 w-3/5 max-w-[360px]" />
        </div>

        {/* Form cards and the main button */}
        <div className="flex max-w-[720px] flex-col gap-4">
          <Skeleton className="h-[148px] rounded-xl" />
          <Skeleton className="h-[104px] rounded-xl" />
        </div>
        <Skeleton className="mt-auto h-[54px] w-full max-w-[720px] rounded-md lg:mt-0 lg:w-48" />
      </div>
    </SkeletonRegion>
  );
}

// "You're all set!" loading: the done page's centered layout (mint card on desktop).
export function OnboardingDoneSkeleton() {
  return (
    <SkeletonRegion className="flex min-h-dvh flex-1 flex-col bg-bg px-5 pt-10 pb-[calc(24px+env(safe-area-inset-bottom))] lg:items-center lg:justify-center lg:bg-mint lg:py-12">
      <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col items-center gap-5 lg:max-w-[520px] lg:flex-none lg:rounded-xl lg:bg-surface lg:p-10">
        <Skeleton className="size-[176px] rounded-full lg:size-[140px]" />
        <div className="flex w-full flex-col items-center gap-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        <Skeleton className="h-[120px] w-full rounded-xl" />
        <Skeleton className="mt-auto h-[54px] w-full rounded-md lg:mt-2" />
      </div>
    </SkeletonRegion>
  );
}
