import { describe, expect, it } from "vitest";
import { anonClient, signUpUser } from "./helpers";

const PERMISSION_DENIED = "42501";
const INVALID_PARAMETER = "22023";

describe("record_consent", () => {
  it("records the name, consent time and version for a Google-style user", async () => {
    // Google sign-ups start with no name and no consent.
    const user = await signUpUser();

    const { error } = await user.client.rpc("record_consent", {
      name: "  Ana  ",
      version: "2026-11-14",
    });
    expect(error).toBeNull();

    const { data } = await user.client
      .from("profiles")
      .select("display_name, consent_at, consent_version")
      .single();
    expect(data?.display_name).toBe("Ana");
    expect(data?.consent_at).not.toBeNull();
    expect(data?.consent_version).toBe("2026-11-14");
  });

  it("records a newer version when the user agrees again", async () => {
    const user = await signUpUser({
      display_name: "Ana",
      consent_at: new Date().toISOString(),
      consent_version: "2026-11-14",
    });

    await user.client.rpc("record_consent", { name: "Ana", version: "2027-01-01" });

    const { data } = await user.client.from("profiles").select("consent_version").single();
    expect(data?.consent_version).toBe("2027-01-01");
  });

  it("only changes the caller's own profile", async () => {
    const userA = await signUpUser();
    const userB = await signUpUser();

    await userA.client.rpc("record_consent", { name: "User A", version: "2026-11-14" });

    const { data: b } = await userB.client
      .from("profiles")
      .select("display_name, consent_at")
      .single();
    expect(b).toEqual({ display_name: null, consent_at: null });
  });

  it("rejects a version that isn't a date", async () => {
    const user = await signUpUser();
    const { error } = await user.client.rpc("record_consent", { name: "Ana", version: "latest" });
    expect(error?.code).toBe(INVALID_PARAMETER);
  });

  it("rejects an empty or too-long name", async () => {
    const user = await signUpUser();
    const empty = await user.client.rpc("record_consent", { name: "   ", version: "2026-11-14" });
    const long = await user.client.rpc("record_consent", {
      name: "a".repeat(41),
      version: "2026-11-14",
    });
    expect(empty.error?.code).toBe(INVALID_PARAMETER);
    expect(long.error?.code).toBe(INVALID_PARAMETER);
  });

  it("can't be called by a logged-out visitor", async () => {
    const { error } = await anonClient().rpc("record_consent", {
      name: "Ana",
      version: "2026-11-14",
    });
    expect(error?.code).toBe(PERMISSION_DENIED);
  });
});
