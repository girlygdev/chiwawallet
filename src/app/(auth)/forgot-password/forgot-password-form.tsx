"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { FormError } from "@/components/auth/form-error";
import { SubmitButton } from "@/components/auth/submit-button";
import { TextField } from "@/components/auth/text-field";
import { type ForgotPasswordInput, forgotPasswordSchema } from "@/lib/validation/auth";
import { requestPasswordReset } from "../actions";

export function ForgotPasswordForm() {
  const [formError, setFormError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: "onTouched",
    defaultValues: { email: "" },
  });

  const onSubmit = (values: ForgotPasswordInput) => {
    setFormError(undefined);
    startTransition(async () => {
      // Always redirects to Check your email unless the input was invalid
      // or there were too many tries.
      const result = await requestPasswordReset(values);
      if (result.formError) setFormError(result.formError);
      if (result.fieldErrors?.email) {
        setError("email", { message: result.fieldErrors.email }, { shouldFocus: true });
      }
    });
  };

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
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
      <FormError message={formError} />
      {/* Week 8: the Turnstile bot check goes here, right above the main button. */}
      <SubmitButton pending={pending} pendingLabel="Sending…">
        Send reset link
      </SubmitButton>
    </form>
  );
}
