import { LogOut } from "lucide-react";
import { logOut } from "@/app/(auth)/actions";

// Secondary Log out button for More (mobile) and Settings (desktop), per
// more-and-categories.md and settings.md. A real <form> posting to the
// Server Action, so it works before JavaScript loads. Logs out this device only.
export function LogOutButton() {
  return (
    <form action={logOut}>
      <button
        type="submit"
        className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-line bg-surface text-base font-bold text-ink outline-link hover:bg-mint focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <LogOut aria-hidden size={20} />
        Log out
      </button>
    </form>
  );
}
