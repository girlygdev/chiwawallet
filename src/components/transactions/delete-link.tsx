"use client";

// Edit transaction's "Delete" link at the bottom of the sheet (activity.md
// fix #6), styled like Delete income source: red text, only for destroying.
export function DeleteLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-11 self-center rounded-md px-3 text-[15px] font-extrabold text-danger outline-link focus-visible:outline-2"
    >
      Delete transaction
    </button>
  );
}
