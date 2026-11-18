"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { FormError } from "@/components/auth/form-error";
import { GoogleButton } from "@/components/auth/google-button";
import { OrDivider } from "@/components/auth/or-divider";
import { PasswordField } from "@/components/auth/password-field";
import { SubmitButton } from "@/components/auth/submit-button";
import { TextField } from "@/components/auth/text-field";
import { type LogInInput, logInSchema } from "@/lib/validation/auth";
import { logIn } from "../actions";

const fields = ["email", "password"] as const;

// Task 3f connects the Google button.
export function LoginForm() {
  const [formError, setFormError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LogInInput>({
    resolver: zodResolver(logInSchema),
    mode: "onTouched",
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = (values: LogInInput) => {
    setFormError(undefined);
    startTransition(async () => {
      // On success the action redirects to /dashboard and doesn't return.
      const result = await logIn(values);
      if (result.formError) setFormError(result.formError);
      const firstBad = fields.find((f) => result.fieldErrors?.[f]);
      for (const f of fields) {
        const message = result.fieldErrors?.[f];
        if (message) setError(f, { message }, { shouldFocus: f === firstBad });
      }
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <GoogleButton label="Continue with Google" />
      <OrDivider label="or" />

      <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <div className="flex flex-col gap-3.5">
          <TextField
            id="email"
            type="email"
            label="Email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            error={errors.email?.message}
            {...register("email")}
          />
          <PasswordField
            id="password"
            label="Password"
            autoComplete="current-password"
            error={errors.password?.message}
            labelAside={
              <Link
                href="/forgot-password"
                className="text-sm font-bold text-link outline-link hover:text-link-hover focus-visible:outline-2"
              >
                Forgot password?
              </Link>
            }
            {...register("password")}
          />
        </div>

        <FormError message={formError} />
        {/* Week 8: the Turnstile bot check goes here, right above the main button. */}
        <SubmitButton pending={pending} pendingLabel="Logging in…">
          Log in
        </SubmitButton>
      </form>
    </div>
  );
}
