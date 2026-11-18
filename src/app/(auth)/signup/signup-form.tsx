"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { ConsentCheckbox } from "@/components/auth/consent-checkbox";
import { FormError } from "@/components/auth/form-error";
import { GoogleButton } from "@/components/auth/google-button";
import { OrDivider } from "@/components/auth/or-divider";
import { PasswordField } from "@/components/auth/password-field";
import { SubmitButton } from "@/components/auth/submit-button";
import { TextField } from "@/components/auth/text-field";
import { type SignUpInput, signUpSchema } from "@/lib/validation/auth";
import { signUp } from "../actions";

const fields = ["displayName", "email", "password", "consent"] as const;

export function SignUpForm() {
  const [formError, setFormError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors },
  } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    // Check a field when the user leaves it, then re-check as they fix it.
    mode: "onTouched",
    defaultValues: { displayName: "", email: "", password: "", consent: false },
  });

  // Create account stays disabled until the consent box is ticked (auth-screens.md).
  // useWatch (not watch) so the React Compiler can still optimise this component.
  const consented = useWatch({ control, name: "consent" });

  const onSubmit = (values: SignUpInput) => {
    setFormError(undefined);
    startTransition(async () => {
      // On success the action redirects to /check-email and doesn't return.
      const result = await signUp(values);
      if (result.formError) setFormError(result.formError);
      // Show server-side field errors and focus the first one.
      const firstBad = fields.find((f) => result.fieldErrors?.[f]);
      for (const f of fields) {
        const message = result.fieldErrors?.[f];
        if (message) setError(f, { message }, { shouldFocus: f === firstBad });
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <GoogleButton label="Sign up with Google" />
      <OrDivider label="or use email" />

      <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <TextField
            id="displayName"
            label="What should we call you?"
            autoComplete="nickname"
            placeholder="e.g. Ana"
            error={errors.displayName?.message}
            {...register("displayName")}
          />
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
            autoComplete="new-password"
            hint="At least 8 characters, with a number."
            error={errors.password?.message}
            {...register("password")}
          />
        </div>

        <ConsentCheckbox error={errors.consent?.message} {...register("consent")} />

        <FormError message={formError} />
        {/* Week 8: the Turnstile bot check goes here, right above the main button. */}
        <SubmitButton pending={pending} pendingLabel="Creating account…" disabled={!consented}>
          Create account
        </SubmitButton>
      </form>
    </div>
  );
}
