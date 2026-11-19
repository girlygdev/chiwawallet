// "Good morning / afternoon / evening" by Manila time (app-shell.md §3).
// The server may run in another time zone (Vercel uses UTC), so the hour is
// always read in Asia/Manila, never from the machine's own clock settings.

const manilaHour = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Manila",
  hour: "numeric",
  hourCycle: "h23", // 0–23, so midnight is 0, not 24
});

export function getGreeting(now: Date): string {
  const hour = Number(manilaHour.formatToParts(now).find((part) => part.type === "hour")?.value);
  if (hour < 12) return "Good morning"; // 00:00–11:59
  if (hour < 18) return "Good afternoon"; // 12:00–17:59
  return "Good evening"; // 18:00–23:59
}
