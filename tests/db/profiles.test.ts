import { beforeAll, describe, expect, it } from "vitest";
import { anonClient, signUpUser, type TestUser } from "./helpers";

// Postgres error codes the tests expect.
const PERMISSION_DENIED = "42501";
const CHECK_VIOLATION = "23514";

describe("profiles: created on sign-up", () => {
  it("copies the name and records consent for an email sign-up", async () => {
    const user = await signUpUser({ display_name: "Ana", consent_at: new Date().toISOString() });
    const { data, error } = await user.client.from("profiles").select("*").single();

    expect(error).toBeNull();
    expect(data).toMatchObject({
      user_id: user.id,
      display_name: "Ana",
      week_start: "monday",
      theme: "system",
      bill_reminders: true,
      payday_summary: true,
      mid_period_checkin: false,
      is_demo: false,
    });
    expect(data.consent_at).not.toBeNull();
  });

  it("leaves name and consent empty for a Google-style sign-up", async () => {
    const user = await signUpUser();
    const { data } = await user.client.from("profiles").select("display_name, consent_at").single();
    expect(data).toEqual({ display_name: null, consent_at: null });
  });

  it("trims and shortens a name sent straight to the sign-up API", async () => {
    const user = await signUpUser({ display_name: `  ${"a".repeat(50)}  ` });
    const { data } = await user.client.from("profiles").select("display_name").single();
    expect(data?.display_name).toBe("a".repeat(40));
  });

  it("keeps the consent version sent with consent", async () => {
    const user = await signUpUser({
      display_name: "Ana",
      consent_at: new Date().toISOString(),
      consent_version: "2026-11-14",
    });
    const { data } = await user.client.from("profiles").select("consent_version").single();
    expect(data?.consent_version).toBe("2026-11-14");
  });

  it("drops a consent version that isn't a date, without blocking sign-up", async () => {
    const user = await signUpUser({
      display_name: "Ana",
      consent_at: new Date().toISOString(),
      consent_version: "latest",
    });
    const { data } = await user.client.from("profiles").select("consent_version").single();
    expect(data?.consent_version).toBeNull();
  });

  it("ignores a consent version sent without consent", async () => {
    const user = await signUpUser({ consent_version: "2026-11-14" });
    const { data } = await user.client.from("profiles").select("consent_at, consent_version").single();
    expect(data).toEqual({ consent_at: null, consent_version: null });
  });

  it("records the database's time, not a consent time sent by the user", async () => {
    const user = await signUpUser({ display_name: "Ana", consent_at: "2000-01-01T00:00:00Z" });
    const { data } = await user.client.from("profiles").select("consent_at").single();
    expect(new Date(data?.consent_at).getFullYear()).toBeGreaterThan(2000);
  });
});

describe("profiles: Row Level Security", () => {
  let userA: TestUser;
  let userB: TestUser;

  beforeAll(async () => {
    userA = await signUpUser({ display_name: "User A", consent_at: new Date().toISOString() });
    userB = await signUpUser({ display_name: "User B", consent_at: new Date().toISOString() });
  });

  it("user A only sees their own profile", async () => {
    const { data, error } = await userA.client.from("profiles").select("user_id");
    expect(error).toBeNull();
    expect(data).toEqual([{ user_id: userA.id }]);
  });

  it("user A can't read user B's profile", async () => {
    const { data } = await userA.client.from("profiles").select("*").eq("user_id", userB.id);
    expect(data).toEqual([]);
  });

  it("user A can't change user B's profile", async () => {
    const { data } = await userA.client
      .from("profiles")
      .update({ display_name: "Hacked" })
      .eq("user_id", userB.id)
      .select();
    expect(data).toEqual([]);

    const { data: b } = await userB.client.from("profiles").select("display_name").single();
    expect(b?.display_name).toBe("User B");
  });

  it("a logged-out visitor can't read any profile", async () => {
    const { data, error } = await anonClient().from("profiles").select("*");
    // No grant for anon: Postgres refuses the query outright.
    expect(data).toBeNull();
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it("user A can change their own name, week start, theme and notifications", async () => {
    const { data, error } = await userA.client
      .from("profiles")
      .update({
        display_name: "Ana B.",
        week_start: "sunday",
        theme: "dark",
        bill_reminders: false,
        payday_summary: false,
        mid_period_checkin: true,
      })
      .eq("user_id", userA.id)
      .select("display_name, week_start, theme, bill_reminders, payday_summary, mid_period_checkin")
      .single();

    expect(error).toBeNull();
    expect(data).toEqual({
      display_name: "Ana B.",
      week_start: "sunday",
      theme: "dark",
      bill_reminders: false,
      payday_summary: false,
      mid_period_checkin: true,
    });
  });

  it.each([
    ["is_demo", { is_demo: true }],
    ["consent_at", { consent_at: "2000-01-01T00:00:00Z" }],
    ["consent_version", { consent_version: "2000-01-01" }],
    ["user_id", { user_id: "00000000-0000-0000-0000-000000000000" }],
    ["created_at", { created_at: "2000-01-01T00:00:00Z" }],
  ])("user A can't change their own %s", async (_field, change) => {
    const { error } = await userA.client.from("profiles").update(change).eq("user_id", userA.id);
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it("only allows monday or sunday as the week start", async () => {
    const { error } = await userA.client
      .from("profiles")
      .update({ week_start: "tuesday" })
      .eq("user_id", userA.id);
    expect(error?.code).toBe(CHECK_VIOLATION);
  });

  it("user A can't create another profile", async () => {
    const { error } = await userA.client.from("profiles").insert({ user_id: userA.id });
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it("user A can't delete their profile", async () => {
    const { error } = await userA.client.from("profiles").delete().eq("user_id", userA.id);
    expect(error?.code).toBe(PERMISSION_DENIED);
  });
});
