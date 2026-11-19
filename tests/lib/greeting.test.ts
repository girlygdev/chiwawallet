import { describe, expect, it } from "vitest";
import { getGreeting } from "@/lib/greeting";

// Manila is UTC+8 all year (no daylight saving), so each case gives the UTC
// time that matches a Manila time.
const manila = (time: string) => new Date(`2026-11-20T${time}+08:00`);

describe("getGreeting", () => {
  it.each([
    ["00:00", "Good morning"],
    ["06:30", "Good morning"],
    ["11:59", "Good morning"],
    ["12:00", "Good afternoon"],
    ["17:59", "Good afternoon"],
    ["18:00", "Good evening"],
    ["23:59", "Good evening"],
  ])("%s in Manila → %s", (time, greeting) => {
    expect(getGreeting(manila(time))).toBe(greeting);
  });

  it("uses Manila time, not UTC", () => {
    // 02:00 UTC is 10:00 in Manila: morning there, even though it's 2 a.m. in UTC.
    expect(getGreeting(new Date("2026-11-20T02:00:00Z"))).toBe("Good morning");
    // 10:00 UTC is 18:00 in Manila.
    expect(getGreeting(new Date("2026-11-20T10:00:00Z"))).toBe("Good evening");
  });
});
