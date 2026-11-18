"use client";

import Link from "next/link";
import { GoogleButton } from "@/components/auth/google-button";
import { OrDivider } from "@/components/auth/or-divider";
import { PasswordField } from "@/components/auth/password-field";
import { SubmitButton } from "@/components/auth/submit-button";
import { TextField } from "@/components/auth/text-field";

// UI only for now (task 3b). Task 3d connects this form to Supabase,
// and task 3f connects the Google button.
export function LoginForm() {
  return (
    <div className="flex flex-col gap-5">
      <GoogleButton label="Continue with Google" />
      <OrDivider label="or" />

      {/* preventDefault stops the browser from submitting the fields itself
          (a plain GET would put the password in the URL) until 3d adds the action. */}
      <form noValidate onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-5">
        <div className="flex flex-col gap-3.5">
          <TextField
            id="email"
            name="email"
            type="email"
            label="Email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            required
          />
          <PasswordField
            id="password"
            name="password"
            label="Password"
            autoComplete="current-password"
            required
            labelAside={
              <Link
                href="/forgot-password"
                className="text-sm font-bold text-link outline-link hover:text-link-hover focus-visible:outline-2"
              >
                Forgot password?
              </Link>
            }
          />
        </div>

        {/* Week 8: the Turnstile bot check goes here, right above the main button. */}
        <SubmitButton pendingLabel="Logging in…">Log in</SubmitButton>
      </form>
    </div>
  );
}
