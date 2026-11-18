"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { ConsentCheckbox } from "@/components/auth/consent-checkbox";
import { FormError } from "@/components/auth/form-error";
import { SubmitButton } from "@/components/auth/submit-button";
import { TextField } from "@/components/auth/text-field";
import { type ConsentInput, consentSchema } from "@/lib/validation/auth";
import { giveConsent } from "../actions";

const fields = ["displayName", "consent"] as const;

// `suggestedName` is the first name from the Google profile; the user can change it.
export function ConsentForm({ suggestedName }: { suggestedName: string }) {
  const [formError, setFormError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors },
  } = useForm<ConsentInput>({
    resolver: zodResolver(consentSchema),
    mode: "onTouched",
    defaultValues: { displayName: suggestedName, consent: false },
  });

  // Continue stays disabled until the box is ticked, like Create account.
  const consented = useWatch({ control, name: "consent" });

  const onSubmit = (values: ConsentInput) => {
    setFormError(undefined);
    startTransition(async () => {
      // On success the action redirects to /dashboard.
      const result = await giveConsent(values);
      if (result.formError) setFormError(result.formError);
      const firstBad = fields.find((f) => result.fieldErrors?.[f]);
      for (const f of fields) {
        const message = result.fieldErrors?.[f];
        if (message) setError(f, { message }, { shouldFocus: f === firstBad });
      }
    });
  };

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <TextField
        id="displayName"
        label="What should we call you?"
        autoComplete="nickname"
        placeholder="e.g. Ana"
        error={errors.displayName?.message}
        {...register("displayName")}
      />
      <ConsentCheckbox error={errors.consent?.message} {...register("consent")} />
      <FormError message={formError} />
      <SubmitButton pending={pending} pendingLabel="Saving…" disabled={!consented}>
        Continue
      </SubmitButton>
    </form>
  );
}
