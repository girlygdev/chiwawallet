import { Skeleton, SkeletonRegion } from "@/components/skeleton";
import { CATEGORY_COLORS, CATEGORY_ICONS } from "@/lib/validation/category";

// New and Edit category while the budget (and, for Edit, the category) loads:
// grey blocks the shape of CategoryForm, so the page doesn't jump when it
// arrives. `withDelete` adds Edit's Delete category link.
export function CategoryFormSkeleton({ withDelete = false }: { withDelete?: boolean }) {
  return (
    <SkeletonRegion className="flex w-full max-w-xl flex-col gap-5">
      {/* Preview card */}
      <Skeleton className="h-[106px] rounded-2xl" />

      {/* Name */}
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-4 w-14" />
        <Skeleton className="h-[50px] rounded-md" />
      </div>

      {/* Which 50/30/20 group? */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-44" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-14 rounded-[14px]" />
        ))}
      </div>

      {/* Icon grid, same count and columns as the form */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-10" />
        <div className="grid grid-cols-5 gap-2">
          {CATEGORY_ICONS.map((icon) => (
            <Skeleton key={icon.name} className="h-[52px] rounded-[14px]" />
          ))}
        </div>
      </div>

      {/* Colours */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-12" />
        <div className="flex flex-wrap gap-3">
          {CATEGORY_COLORS.map((color) => (
            <Skeleton key={color.name} className="size-[46px] rounded-full" />
          ))}
        </div>
      </div>

      {/* Save button, then Delete category on Edit */}
      <Skeleton className="h-14 rounded-md" />
      {withDelete && <Skeleton className="h-6 w-36 self-center" />}
    </SkeletonRegion>
  );
}
